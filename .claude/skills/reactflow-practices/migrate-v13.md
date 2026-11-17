# 从 v12 迁移到 v13

来源是 reactflow.dev 的 Migrate to React Flow 13 与 `@xyflow/react` 13.0.0 CHANGELOG，名称已对照 13.0.1 类型定义核实。逐条检查受影响代码，每条都有明确的替代写法。迁移完成的标准是：本表左列的名称在源码中搜不到，且 typecheck 通过。

| v12 | v13 |
|---|---|
| `applyNodeChanges(changes, nodes)`／`applyEdgeChanges` | `changes.applyTo(nodes)`，两个函数已不再导出 |
| `NodeDimensionChange`、`NodePositionChange`、`Node*／Edge*SelectionChange`、`*RemoveChange`、`*AddChange`、`*ReplaceChange` | 节点与边共用 `DimensionChange`、`PositionChange`、`SelectionChange`、`RemoveChange`、`AddChange`、`ReplaceChange`；联合类型 `NodeChange`／`EdgeChange` 保留 |
| `useStore(selector, shallow)` | 对应领域的 `use*Store(selector)`，比较函数改为 `useShallow(selector)` 或 `useEqualSelector(selector, isEqual)` |
| `useStoreApi()` | `useReactFlowStoreApi()`，子 store 经 `nodesStore.getState()` 等访问 |
| `colorMode` prop | 删除。跟随祖先 `dark`／`light` class 或 `data-theme`，否则跟随系统；固定模式用 `forceColorMode` |
| `@xyflow/react/dist/style.css` | `@xyflow/react/style.css`（旧路径仍可用）；分层 CSS 项目补上 `@layer` 顺序声明 |
| `nodeClickDistance` | 删除，用 `nodeDragThreshold` |
| `paneClickDistance` | `paneDragThreshold`，默认 `1` |
| `fitViewOptions.padding: 0.1` | 无单位数字现在表示像素。v12 的 `0.1` 约等于 `'4.5%'`；默认值为 `'5%'` |
| `await fitView()`／`setCenter()` 被打断时一直 pending | resolve 为 `false`，依赖结果的代码检查返回值 |
| `onConnectEnd`／`onReconnectEnd` 里对 `to` 调 `screenToFlowPosition` | `to` 已是 flow 坐标，删掉转换 |
| `useHandleConnections`、`getHandleConnections({ id })` | `useNodeConnections`、`getNodeConnections({ nodeId, type, handleId })` |
| `HandleConnection` 类型 | `NodeConnection` |
| 测量几何类型 `Handle` | `HandleBounds` |
| `elevateEdgesOnSelect` 默认 `false` | 默认 `true`，选中的边浮到节点上方；采用官方默认 |
| `.react-flow__pane.draggable { cursor }` | 光标样式移到 `::before`，选择器改为 `.react-flow__pane.draggable::before` |
| 父节点必须排在子节点之前 | 不再要求 |

运行环境：React 18 及以上；项目直接使用 Zustand 时升级到 5；UMD 构建已移除。
