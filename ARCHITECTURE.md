# Flowpocus 实时协同架构

## 技术栈

| 层级 | 技术选型 |
|------|----------|
| **前端框架** | Next.js 16 + React 19 |
| **图形编辑器** | @xyflow/react (React Flow) |
| **CRDT 算法** | Yjs |
| **WebSocket 客户端** | @hocuspocus/provider |
| **后端框架** | Hono on Node.js (@hono/node-server + ws) |
| **协同服务器** | Hocuspocus 4 |
| **数据库** | PostgreSQL (node-postgres) + Drizzle ORM |
| **多实例** | 默认每个画布单一 owner（数据库租约 + 实例间转发），可选 Redis Pub/Sub |
| **构建** | Turborepo；backend 与 CLI 用 tsdown 打包 |

## 目录结构

```
flowpocus/
├── apps/
│   ├── backend/                     # Hono + Hocuspocus 后端
│   │   └── src/
│   │       ├── index.ts             # 入口 (HTTP + WebSocket 接入)
│   │       ├── commands/            # Server-owned Canvas Commands
│   │       │   ├── canvas-command.ts # Executor、mutation 与幂等 receipt
│   │       │   └── service.ts       # Hocuspocus direct connection 生命周期
│   │       ├── collaboration/
│   │       │   └── hocuspocus.ts    # 鉴权、owner 租约、Database extension、持久化
│   │       ├── mcp/
│   │       │   └── server.ts        # 由 command contract 生成 MCP tools
│   │       ├── routes/              # Hono API 路由
│   │       │   ├── health.ts
│   │       │   ├── canvases.ts      # Canvas CRUD
│   │       │   ├── commands.ts      # Command discovery/execute HTTP adapter
│   │       │   └── mcp.ts           # Streamable HTTP MCP 入口
│   │       ├── placement/           # 多实例模式: owner 租约 / Redis (见 docs/adr/0001)
│   │       └── lib/
│   │           └── logger.ts
│   ├── cli/                         # 只调用 server contract 的 agent CLI
│   └── web/                         # Next.js 前端
│       ├── app/
│       │   ├── page.tsx             # 首页
│       │   └── canvas/
│       │       ├── page.tsx         # 重定向到 /canvas/showcase
│       │       └── [id]/page.tsx    # 画布页
│       ├── components/
│       │   ├── providers.tsx        # next-themes
│       │   └── canvas/
│       │       └── canvas-editor.tsx
│       ├── hooks/collaboration/     # Yjs 协同 hook
│       │   ├── use-yjs-collaboration.ts
│       │   └── types.ts
│       └── lib/auth.ts              # 开发用 mock token
└── packages/
    ├── canvas/                      # React Flow 节点、插件与 hooks
    │   └── src/
    │       ├── components/nodes/    # text / image / video 节点
    │       ├── components/plugins/  # toolbar、user-cursors、connection-status、focus overlay
    │       ├── hooks/               # 快捷键、focus mode
    │       └── lib/node-factory.ts
    ├── commands/                    # 共享 Zod command contracts
    │   └── src/
    │       ├── canvas.ts            # Input、request、receipt 与 metadata
    │       └── ids.ts               # base62 短 ID
    ├── database/                    # Drizzle + PostgreSQL
    │   └── src/
    │       ├── client.ts
    │       └── schema/canvases.ts
    └── ui/                          # shadcn/ui (Base UI) 组件与主题 token
```

## 核心设计模式

### 1. 双向同步与循环阻断

```
React Flow onNodesChange / onEdgesChange
        │ applyNodeChanges → updateNodes / updateEdges
        ▼
setNodes / setEdges            (本地 state 立即更新)
        │
        ▼
Y.Doc.transact(fn, origin: clientId)
  ├─ 去掉 selected / dragging 等本地字段
  ├─ JSON 比较，跳过未变化的节点和边
  └─ 删除已不存在的 id
        │
        ▼
Y.Map.observe(transaction)
  └─ origin === clientId 时跳过，只把远端变更写回 React state
```

**关键点**：
- 本地变更先更新 React state，再同步写入 Y.Doc，没有额外的防抖层
- 写入前剔除 `selected`、`dragging`，选中状态改走 awareness，不进入共享文档
- 逐项 JSON 比较，未变化的条目不产生 Yjs update
- Yjs 事务标记 `origin: clientId`，`observe` 回调据此跳过自身产生的变更，阻断循环

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
| `yjsUpdate` | BLOB | **写模型** - CRDT 二进制状态 (Source of Truth) |

```typescript
// store 回调中同时写入两套数据
await db.update(canvases).set({
  nodes: Array.from(nodesMap.values()),    // JSON 读模型
  edges: Array.from(edgesMap.values()),
  yjsUpdate: Buffer.from(state),            // 二进制写模型
  version: sql`${canvases.version} + 1`,    // 单调修订号，原子自增
})
```

### 4. WebSocket 接入

`@hono/node-server` 2 自带 WebSocket 支持，`serve({ websocket: { server: wss } })` 配合
`upgradeWebSocket` 完成升级。Hocuspocus 4 的 `handleConnection` 接收 web 标准 `Request`，
并把消息与关闭事件交给集成方转发：

```typescript
upgradeWebSocket((c) => {
  let connection: ReturnType<Hocuspocus["handleConnection"]> | undefined
  return {
    onOpen(_event, ws) {
      connection = hocuspocus.handleConnection(ws.raw, c.req.raw, { documentName, token })
    },
    onMessage(event) {
      connection?.handleMessage(new Uint8Array(event.data as ArrayBuffer))
    },
    onClose(event) {
      connection?.handleClose({ code: event.code, reason: event.reason })
    },
  }
})
```

Hocuspocus 4 不再发送 WebSocket 层 ping，连接靠入站消息保活。客户端 awareness 约每 15 秒
续期一次，低于服务端 30 秒的空闲超时。

### 5. Server-owned Canvas Commands

Canvas command 的 Zod schema 与 request/receipt type 维护在 `packages/commands`；executor、业务
校验、幂等和 mutation 只维护在 server。HTTP 与 `apps/cli` 都是 transport adapter，不接收任意
Y.Doc updater，也不复制 command 实现。

| 层 | 所有权 |
|---|---|
| `packages/commands` | command name、Zod input/request/receipt schema、description |
| `apps/backend/src/commands` | executor、业务状态变更、幂等、direct connection 生命周期 |
| `apps/backend/src/routes/commands.ts` | HTTP decoding、错误到 status code 的映射 |
| `apps/backend/src/mcp/server.ts` | 由 command contract 生成 MCP tool，错误映射为 `isError` tool result |
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
| GET | `/docs` | Swagger UI |
| GET | `/openapi.json` | OpenAPI 描述 |
| GET | `/api/canvases` | 列出所有画布 |
| POST | `/api/canvases` | 创建画布 |
| GET | `/api/canvases/:id` | 获取画布详情 (JSON 读模型，可能滞后) |
| GET | `/api/canvases/:id/document` | 从 owner 读取 live nodes/edges |
| PATCH | `/api/canvases/:id` | 更新画布元数据 |
| DELETE | `/api/canvases/:id` | 删除画布 |
| GET | `/api/commands` | 查询 server command 及其 input schema |
| POST | `/api/commands/:canvasId` | 执行 typed Canvas Command |
| POST | `/mcp` | MCP Streamable HTTP 入口 (stateless, JSON response) |
| WS | `/collaboration/:canvasId` | WebSocket 协同入口 |

## 运行

```bash
# 安装依赖，启动 PostgreSQL 并执行 migration
pnpm install
docker compose up -d
pnpm db:migrate

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

远程 Agent 也可以通过 MCP 连接同一条 server command 路径。`/mcp` 暴露 `list_canvases`、
`get_canvas` (读取 live Y.Doc) 以及 `packages/commands` 中每个 command 对应的 tool：

```bash
claude mcp add --transport http flowpocus http://localhost:3001/mcp
```

## 多实例

`CLUSTER_MODE` 选择多实例模式，默认 `owner`。

**owner 模式。** 每个画布同一时刻只在一个实例（owner）上加载。owner 在 `canvas_leases` 表里持有租约，每 10 秒续约一次，30 秒不续即过期。其他实例收到该画布的 WebSocket 时原样转发到 owner；收到 Canvas Command 或 live 读时调用 owner 的 HTTP 接口。决策与回退到 Redis 的条件见 `docs/adr/0001-single-owner-placement.md`。

每个实例需要唯一的 `INSTANCE_ID`，以及其他实例可访问的 `INSTANCE_URL`：

```bash
PORT=3001 INSTANCE_ID=a INSTANCE_URL=http://10.0.0.5:3001 pnpm dev:backend
PORT=3001 INSTANCE_ID=b INSTANCE_URL=http://10.0.0.6:3001 pnpm dev:backend
```

负载均衡可选择按 `/collaboration/:canvasId` 路径做一致性哈希，减少转发；正确性不依赖它。

**redis 模式。** 每个实例都直接加载收到的画布，副本之间通过 Redis Pub/Sub 同步，`store` 由 Redis 扩展的锁串行化。适合单个画布超出一个实例容量、或实例之间网络不通的部署。

```bash
CLUSTER_MODE=redis REDIS_URL=redis://localhost:6379 pnpm dev:backend
```

同一集群内所有实例必须使用同一种模式。
