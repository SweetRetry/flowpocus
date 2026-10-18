# Hocuspocus 持久化：DB 还是 S3

状态：待决策。当前结论是继续存 DB，S3 留给版本历史与快照归档。

## 问题

Hocuspocus 的 `store` 回调每次拿到的是整份文档状态（`Y.encodeStateAsUpdate`），不是增量。
防抖 3s、最长 15s 强制写一次。所以真正的问题是：

> 每 3–15 秒整份覆盖写一次 blob，放哪里合适？

## 决策变量

节点数不是直接变量，只是推算快照大小的代理。真正决定选型的是两个数：

1. **快照大小**：单份文档编码后的字节数。
2. **写带宽**：`活跃文档数 × 快照大小 ÷ 写入间隔`。

## 实测：节点数与快照大小

测量条件：yjs 13.6.33，React Flow 结构的节点以普通对象存入 `Y.Map("nodes")`，
边存入 `Y.Map("edges")`，每个节点一条边。"改 100 次"指每个节点整体覆盖写 100 次，模拟拖拽。

| 节点数 | 节点文本 | 新建 | 每节点改 100 次后 |
|---|---|---|---|
| 1,000 | 50B | 204KB | 1.17MB |
| 1,000 | 2KB | 2.1MB | 3.1MB |
| 10,000 | 50B | 2.1MB | 11.9MB |
| 10,000 | 2KB | 21MB | 31MB |

结论：

- 新建文档的大小约等于等价 JSON，每个节点结构开销约 200B。大小主要由节点内容决定，不是节点数。
- 文档只增不减。每次覆盖写留下约 10B 墓碑，和内容大小无关（1000 节点 × 100 次 ≈ +960KB）。
  长期使用的画布大小 ≈ 当前内容 + 10B × 历史总写入次数。
- 拖拽时是每帧写还是松手写一次，差别是数量级的。这一点是从机制推断，未测前端实际写入频率。
- 双写的 nodes/edges JSON read model 和 Yjs blob 体量相当，DB 里的总量要再乘 2。

### 复现脚本

保存到 `apps/backend/measure-yjs-size.mjs`（该目录能解析到 `yjs`），执行 `node measure-yjs-size.mjs`，
跑完删掉。

```js
import * as Y from "yjs"

const kb = (n) => `${(n / 1024).toFixed(1)}KB`

function run(N, contentLen, editsPerNode) {
  const doc = new Y.Doc()
  const nodes = doc.getMap("nodes")
  const edges = doc.getMap("edges")
  const mk = (i, x, y) => ({
    id: `n${i}`, type: "text", position: { x, y }, width: 240, height: 120,
    data: { label: `Node ${i}`, content: "x".repeat(contentLen) },
  })
  doc.transact(() => { for (let i = 0; i < N; i++) nodes.set(`n${i}`, mk(i, i * 10, i * 5)) })
  doc.transact(() => {
    for (let i = 1; i < N; i++) edges.set(`e${i}`, { id: `e${i}`, source: `n${i - 1}`, target: `n${i}` })
  })
  const fresh = Y.encodeStateAsUpdate(doc).length
  for (let k = 0; k < editsPerNode; k++)
    doc.transact(() => { for (let i = 0; i < N; i++) nodes.set(`n${i}`, mk(i, i * 10 + k, i * 5 + k)) })
  const edited = Y.encodeStateAsUpdate(doc).length
  console.log(`N=${N} content=${contentLen}B edits=${editsPerNode} fresh=${kb(fresh)} edited=${kb(edited)}`)
}

for (const N of [1000, 10000]) for (const c of [50, 2000]) run(N, c, 0), run(N, c, 100)
```

## 选型阈值

阈值是经验判断，未压测。

| 快照大小 | 选择 |
|---|---|
| < 1MB | DB。1000 节点的轻量画布在这一档。 |
| 1–10MB | 仍是 DB，但要算写带宽。 |
| > 10MB，或写带宽到每秒几十 MB | blob 放 S3，元数据与 read model 留 DB。 |

写带宽示例（估算）：

- 100 活跃文档 × 2MB ÷ 15s ≈ 13MB/s。Postgres 可承受。
- 1000 活跃文档 × 2MB ÷ 15s ≈ 133MB/s。WAL 与表膨胀成为问题。

## DB 与 S3 对比

| 维度 | DB（Postgres `bytea`） | S3 |
|---|---|---|
| 和 read model 原子性 | 同一事务 | 做不到。先 PUT 对象再更新 DB 指针，中间崩溃即不一致 |
| 写延迟 | 内网毫秒级 | 单次 PUT 约几十到两百毫秒（经验值） |
| 并发写保护 | 行锁 | 条件写 `If-Match`，需自管 ETag |
| 大对象成本 | 整行重写，WAL 放大 | 便宜，按次计费 |
| 运维 | 已有 | 多一个依赖，本地需 MinIO |

## 真正的成本来源

贵的是"每次整份覆盖写"这个模式，不是存储位置。把整份快照搬到 S3 只是把写放大挪了地方，
还丢掉了和 read model 的事务原子性。

规模上来后的目标形态是改写入模型：

1. **增量日志进 DB**。每次变更追加一条小 update（几十到几百字节），写成本与文档大小无关。
2. **定期压缩出快照到 S3**。每 N 条或每 M 分钟合并一次，写到带版本号的 key
   （如 `canvases/{id}/snapshots/{seq}.bin`），再在 DB 里原子切换指针并截断已合并的日志。
3. **加载**：读 S3 快照，回放其后的增量。

收益：写放大消失，S3 自然成为版本历史。代价：需要压缩任务、孤儿对象清理、加载路径多一次回放。

## 何时重新评估

出现任意一条就回到本文：

- 单文档快照常态超过几 MB。
- 写带宽超过每秒几十 MB。
- 要做版本历史或时间回溯。
- 节点开始内嵌大内容（长文本、base64 图片）。

## 已落地的相关决策

- `version` 改为 SQL 原子自增，作为单调修订号，不做乐观锁。`store` 写入的是合并后的完整文档，
  冲突时拒写会丢编辑；跨节点互斥由 Redis extension 的 store 锁负责。
- `yjs_update` 从 base64 TEXT 改为 BLOB，省去约 33% 体积与每次编解码。
