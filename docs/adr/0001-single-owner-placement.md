---
status: accepted
---

# 多实例默认每个画布单一 owner，Redis 广播降为可选模式

多实例部署默认使用 `CLUSTER_MODE=owner`。一个画布的 live Y.Doc 只在一个后端实例（owner）上加载。其他实例收到这个画布的 WebSocket、Canvas Command 或 live 读请求时，转发给 owner，不在本地再加载一份。归属关系由数据库里每个画布一行的租约（`canvas_leases`）决定，并藏在 `CanvasPlacement` 接口后面（`apps/backend/src/placement`）。原来的 Redis 广播保留为 `CLUSTER_MODE=redis`，同样作为一个 `CanvasPlacement` 实现。它让每个实例都把自己当作 owner，再挂上 Redis 扩展。Durable Objects 这类自带"单实例放置"的平台，以后可以作为第三种实现接入，而不是改协同核心。

## 为什么默认不用 Redis

`redis` 模式用的是 `@hocuspocus/extension-redis`。同一个画布可以同时在多个实例上加载，靠 Redis Pub/Sub 互相广播 Yjs 更新。默认改为 owner 的理由如下。这些都是设计层面的判断，不是线上测到的瓶颈。

1. **同一份文档有多个副本。** 每个副本都会把合并后的完整文档写回数据库，正确性依赖 Redis 上的 Redlock 去串行化 `store`。单 owner 下只有一个实例会写，租约本身就是写权。
2. **加载要等对端。** 扩展加载文档时先用 `PUBSUB NUMSUB` 探测对端，有对端就阻塞等它回传状态。单 owner 下加载就是一次数据库读。
3. **广播流量随实例数放大。** 每条更新和 awareness 都要发给所有打开该文档的实例。单 owner 下更新只在一个进程内广播。
4. **Canvas Command 会再造一个副本。** direct connection 在哪个实例收到请求就在哪个实例加载文档。单 owner 下 command 和 live 读都落在 owner 上，`_serverCommands` 的幂等判断只有一个来源。
5. **少运维一个组件。** 多实例只依赖已有的数据库。
6. **与平台模型一致。** Figma 按文档分进程，Durable Objects 按 ID 保证全局单实例，Hocuspocus 的扩展性指南也建议按文档标识拆分实例。这一层做成接口，以后可以直接对接这类平台。

## 什么时候应该切到 redis 模式

出现任意一条就考虑切换：

- **单个画布超出一个实例的容量。** 例如一张画布同时有上千个连接，或更新频率让单进程 CPU 打满。单 owner 方案无法把一个画布拆到多台机器上，Redis 广播可以。
- **实例之间网络不通。** 转发要求每个实例能通过 `INSTANCE_URL` 访问其他实例。如果部署平台不提供实例间的内网互通，转发就做不了。
- **owner 切换造成的断线让用户无法接受。** 例如要求滚动发布时完全不断线。owner 优雅退出时会立刻释放租约，客户端会重连一次。崩溃时画布最多有 TTL（30 秒）不可用，再加上客户端的重连退避。在模拟丢租约的端到端测试里，从断开到重新同步超过了 30 秒，大部分时间花在 `HocuspocusProvider` 的重连退避上。
- **转发多出的一跳延迟变得明显。** 先在负载均衡上按 `/collaboration/:canvasId` 做一致性哈希，让大多数连接直接落在 owner 上。这样还不够的话，再考虑 Redis。

切换方法是在所有实例上设置 `CLUSTER_MODE=redis` 和 `REDIS_URL`。同一个集群里不能混用两种模式。owner 实例会把流量转发给租约持有者，redis 实例会自己加载一份副本，并且不检查租约。切换时整个集群必须一起重启。

`redis` 模式不在 CI 里运行，因为 CI 没有 Redis。改动 `placement/`、`ownershipExtension` 或转发逻辑后，要用真实的 Redis 手动跑一遍多实例端到端测试。

## 放弃的其他方案

- **彻底删除 Redis。** 能少维护一个依赖，但"什么时候应该切到 redis 模式"里列出的场景，单 owner 模式解决不了。它在接口里只是一个约 40 行的实现，留着的成本很低。
- **PostgreSQL LISTEN/NOTIFY 代替 Redis。** NOTIFY 的 payload 上限 8000 字节，而且只能是文本，Yjs 的大更新放不下。所有 NOTIFY 都在提交时争同一把全局锁。也没有和 `NUMSUB` 对应的跨会话订阅计数。它省掉了 Redis，但保留了多副本的全部问题。
- **只在负载均衡上做一致性哈希，不用租约。** 扩缩容或发布时哈希环会变化，同一个画布会短暂出现在两个实例上，两边都会写库。租约是正确性保证。哈希只是减少转发的优化，可以叠加使用。

## 后果

- 每个实例都要配置 `INSTANCE_URL`，并且这个地址必须能被其他实例访问。默认值 `http://localhost:$PORT` 只适合单机。
- 写库带 fencing。租约条件（`EXISTS canvas_leases ... owner_id = 本实例`）直接写在 `store` 的 UPDATE 语句里，检查和写入是同一条语句。丢了租约的实例写库时匹配不到行，只会记一条告警。它的客户端会在下一次续约时被断开，重连后把本地 Y.Doc 里的编辑同步给新 owner。早先的实现是先检查、再写入。一个在两步之间卡住超过 TTL 的旧 owner，会在新 owner 写完并卸载之后，用旧状态覆盖库里的数据。`lease.test.ts` 里有这个时序的测试。
- 这个 fence 的原子性依赖 SQLite 串行化写入。换成 PostgreSQL 时，在 READ COMMITTED 下子查询看到的是语句开始时的快照，需要给租约行加 `FOR SHARE`，或者改成单调递增的 fencing token。
- 第二种平台实现会检验这个接口。Durable Objects 这类平台同时换掉了运行时（例如 Workers 跑不了 `better-sqlite3` 和 Node 的 `ws`），所以 `CanvasPlacement` 只是归属这一层的接缝，不是整套后端的移植层。
