# Flowpocus 实时协同架构

## 技术栈

| 层级 | 技术选型 |
|------|----------|
| **前端框架** | Next.js 16 + React 19 |
| **图形编辑器** | @xyflow/react (React Flow) |
| **CRDT 算法** | Yjs |
| **WebSocket 客户端** | y-websocket |
| **后端框架** | Hono (Bun Runtime) |
| **协同服务器** | Hocuspocus |
| **数据库** | SQLite + Drizzle ORM |
| **集群同步** | Redis Pub/Sub (可选扩展) |

## 目录结构

```
flowpocus/
├── apps/
│   ├── backend/                    # Hono + Hocuspocus 后端
│   │   └── src/
│   │       ├── index.ts            # 入口 (HTTP + WebSocket)
│   │       ├── commands/            # Server-owned Canvas Commands
│   │       │   ├── canvas-command.ts # Executor、mutation 与幂等 receipt
│   │       │   └── service.ts       # Hocuspocus direct connection 生命周期
│   │       ├── collaboration/      # Hocuspocus 协同模块
│   │       │   └── hocuspocus.ts   # 服务器配置与持久化
│   │       ├── routes/             # Hono API 路由
│   │       │   ├── health.ts
│   │       │   ├── canvases.ts     # Canvas CRUD
│   │       │   └── commands.ts     # Command discovery/execute HTTP adapter
│   │       └── lib/                # 工具库
│   │           ├── logger.ts
│   │           └── redis.ts
│   ├── cli/                        # 只调用 server contract 的 agent CLI
│   └── web/                        # Next.js 前端
│       ├── app/
│       │   └── canvas/[id]/page.tsx
│       ├── components/
│       │   └── canvas/             # Canvas 编辑器组件
│       │       ├── canvas-editor.tsx
│       │       ├── user-cursors.tsx
│       │       ├── connection-status.tsx
│       │       └── toolbar.tsx
│       └── hooks/
│           └── collaboration/      # Yjs 协同 hooks
│               ├── use-yjs-collaboration.ts
│               ├── change-buffer.ts
│               └── types.ts
└── packages/
    ├── commands/                   # 共享 Zod command contracts
    │   └── src/canvas.ts           # Input、request、receipt 与 metadata
    ├── database/                   # Drizzle + SQLite
    │   └── src/
    │       ├── client.ts
    │       └── schema/
    │           ├── users.ts
    │           └── canvases.ts
    └── api-client/                 # Hono 类型安全客户端
```

## 核心设计模式

### 1. 双向同步与循环阻断

```
┌─────────────────────────────────────────────────────────────┐
│                    React Flow (UI)                          │
│                         ▲                                   │
│                         │ setNodes/setEdges                 │
│                         │ (only for remote changes)         │
│    ┌────────────────────┴────────────────────┐             │
│    │                                          │             │
│    │  onNodesChange ──────► ChangeBuffer ────►│             │
│    │  (filter local-only)     (100ms debounce)│             │
│    │                                          │             │
│    │                                          ▼             │
│    │                                    Y.Doc.transact()    │
│    │                                    origin: clientId    │
│    │                                          │             │
│    │                                          ▼             │
│    │  observe() ◄──────────────────── Y.Map.observe()      │
│    │  (skip if origin === self)                             │
│    └────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────┘
```

**关键点**：
- `onNodesChange` 过滤掉 `select` 等仅影响本地 UI 的变更
- 使用 `ChangeBuffer` 聚合高频拖拽操作 (100ms debounce)
- Yjs 事务标记 `origin: clientId` 用于追踪变更来源
- `observe` 回调跳过自身产生的变更，阻断循环

### 2. 隔离的撤销/重做 (Scoped Undo)

```typescript
const undoManager = new Y.UndoManager([nodesMap, edgesMap], {
  trackedOrigins: new Set([clientIdRef.current]),  // 只追踪当前用户
})
```

用户 A 的 Undo 不会影响用户 B 的修改。

### 3. 双写存储策略 (CQRS-Lite)

| 字段 | 类型 | 用途 |
|------|------|------|
| `nodes/edges` | JSON | **读模型** - HTTP API 快速查询、首屏渲染 |
| `yjsUpdate` | Base64 | **写模型** - CRDT 二进制状态 (Source of Truth) |

```typescript
// store 回调中同时写入两套数据
await db.update(canvases).set({
  nodes: Array.from(nodesMap.values()),    // JSON 读模型
  edges: Array.from(edgesMap.values()),
  yjsUpdate: Buffer.from(state).toString("base64"),  // 二进制写模型
  version: (existing?.version ?? 0) + 1,
})
```

### 4. Server-owned Canvas Commands

Canvas command 的 Zod schema 与 request/receipt type 维护在 `packages/commands`；executor、业务
校验、幂等和 mutation 只维护在 server。HTTP 与 `apps/cli` 都是 transport adapter，不接收任意
Y.Doc updater，也不复制 command 实现。

| 层 | 所有权 |
|---|---|
| `packages/commands` | command name、Zod input/request/receipt schema、description |
| `apps/backend/src/commands` | executor、业务状态变更、幂等、direct connection 生命周期 |
| `apps/backend/src/routes/commands.ts` | HTTP decoding、canvas existence、错误到 status code 的映射 |
| `apps/cli` | Commander UX、transport-level Zod validation、HTTP 调用与 JSON 输出 |

```typescript
export async function executeCanvasCommand(
  canvasId: string,
  request: CanvasCommandRequest
): Promise<CanvasCommandReceipt> {
  const connection = await hocuspocus.openDirectConnection(canvasId, {
    actor: { type: "server-command", commandId: request.commandId },
  })
  let receipt: CanvasCommandReceipt

  try {
    await connection.transact((document) => {
      receipt = executeCanvasCommandInDocument(document, canvasId, request)
    })
  } finally {
    await connection.disconnect()
  }

  return receipt
}
```

实际实现通过 Hocuspocus `openDirectConnection` 写入当前 Y.Doc，因此在线浏览器会收到相同的
协同更新，Database extension 也沿同一生命周期持久化。`commandId` 记录在 Y.Doc：相同请求可
安全重放，不同 payload 复用同一 ID 会被拒绝。

```text
Local Agent -> apps/cli -> HTTP command route -> server command registry
                                               -> Hocuspocus direct connection
                                               -> Y.Doc -> broadcast + persistence
```

## API 端点

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/api/canvases` | 列出所有画布 |
| POST | `/api/canvases` | 创建画布 |
| GET | `/api/canvases/:id` | 获取画布详情 (JSON) |
| PATCH | `/api/canvases/:id` | 更新画布元数据 |
| DELETE | `/api/canvases/:id` | 删除画布 |
| GET | `/api/commands` | 查询 server command 及其 input schema |
| POST | `/api/commands/:canvasId` | 执行 typed Canvas Command |
| WS | `/collaboration/:canvasId` | WebSocket 协同入口 |

## 运行

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 访问
# - 前端: http://localhost:3000
# - 后端: http://localhost:3001
# - 画布: http://localhost:3000/canvas/{canvasId}
```

本地 Agent 可先发现 schema，再用 CLI 创建与协同客户端等价的节点：

```bash
pnpm dev:cli commands list
pnpm dev:cli commands execute create_node \
  --canvas-id <canvasId> \
  --command-id <stable-command-id> \
  --input '{"type":"text","position":{"x":120,"y":80},"content":"Agent note"}'
```

## Redis 扩展 (可选)

设置 `REDIS_URL` 环境变量启用多实例同步：

```bash
REDIS_URL=redis://localhost:6379 pnpm dev:backend
```

启用后，多个 Hocuspocus 实例可通过 Redis Pub/Sub 实现状态同步，支持水平扩展。
