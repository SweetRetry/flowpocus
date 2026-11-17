---
name: reactflow-practices
description: >-
  使用 @xyflow/react v12+ 实现、迁移或排查节点编辑器：自定义 node／edge／Handle、连接规则、状态订阅、性能与样式。仅用于当前任务涉及 React Flow 的代码或行为。
---

# React Flow Practices

API 名称、参数与 deprecated 状态以项目已安装版本的类型定义（`node_modules/@xyflow/react/dist/esm`）为准，其次是 reactflow.dev 的 API Reference；Learn 与 examples 只说明推荐做法，不覆盖 API 事实。凭记忆写不出确切签名时先查类型定义。

## 排查顺序

先确认安装版本、受影响路径与可复现行为，再查与问题直接相关的基础条件：样式表是否加载、画布容器是否有尺寸、组件是否在 `ReactFlowProvider` 内、node／edge `type` 是否与注册表 key 一致（不一致时静默回退为默认节点，不报错）、状态归谁所有。沿实际数据流或交互路径定位根因；先修 contract 或状态模型错误，再处理表现层。完成后用原复现路径验证业务行为、交互与持久化结果，不只检查组件是否渲染。

## 状态与订阅

- `useNodesState`／`useEdgesState` 只适合起步；状态有外部所有者时，由所有者生成 nodes／edges，`onNodesChange` 等回调把变更写回所有者，不让 React Flow 内部状态成为第二份真相。
- 一次性读取用 `useReactFlow().getNodes()／getEdges()`，它不触发重渲染；在 `useCallback`／`useEffect` 中使用时把实例列入依赖。持续订阅才用 hook。
- 高频组件只订阅渲染所需的最小 slice：读某几个节点的 `data` 用 `useNodesData(ids)`，读连接用 `useNodeConnections()`，取自身 id 用 `useNodeId()`。不在节点或面板里订阅整个 `nodes`／`edges`（含 `useNodes()`／`useEdges()`），拖拽时它们每帧变化。
- `useStore` 必须传 selector；selector 返回新对象或数组时配 `shallow` 比较。`useStoreApi`、`useInternalNode` 绑定内部实现，有公开 API 时不用。
- 等节点首次测量完成再自动布局，用 `useNodesInitialized()`。
- `width`／`height` 是期望尺寸，`measured` 是运行时测量值。测量值、选中、拖拽中等瞬时状态不写进业务数据或持久化结构。
- 父子节点用 `parentId`（v12 前叫 `parentNode`），父节点在数组中必须排在子节点之前；`extent: 'parent'` 限制拖拽边界。父子关系、拖拽边界和持久化结构按同一数据模型处理。

## 变更 util

- `applyNodeChanges`／`applyEdgeChanges` 应用回调变更，`addEdge` 处理 `onConnect`。所有更新保持不可变。
- 重连边用 `onReconnect` + `reconnectEdge(oldEdge, connection, edges, options?)`（v12 前叫 `onEdgeUpdate`／`updateEdge`）；`shouldReplaceId` 默认 `true`，边 id 被外部引用时传 `false`。它只处理端点重连，不是编辑 edge 数据的通用入口。
- `getIncomers`／`getOutgoers`／`getConnectedEdges` 用于环检测、依赖传播与级联分析，传 node 对象而非 id 字符串。环检测在 `isValidConnection` 里通过 `getNodes()`／`getEdges()` 取最新图，不在闭包中捕获某次渲染的 nodes／edges。

## 自定义 node 与 edge

- `nodeTypes`／`edgeTypes` 在模块顶层定义，动态时用 `useMemo`；传给 `<ReactFlow />` 的回调与对象 props（`snapGrid`、`defaultEdgeOptions`、`fitViewOptions`）保持稳定引用。每次 render 新建这些值会触发全图重渲染，`nodeTypes` 还会让 React Flow 报警告。
- 自定义 node／edge 组件用 `memo` 包裹；表格、图表、富文本等重型内容拆成独立 `memo` 子组件，不随位置变化重渲染。
- 节点内的可交互控件加 `nodrag`，浮层与边标签加 `nopan`，内部滚动容器加 `nowheel`。
- 自定义边：path util（`getBezierPath`、`getSmoothStepPath`、`getStraightPath`）生成路径，`<BaseEdge />` 渲染，并把 `sourcePosition`／`targetPosition` 传给 path util，否则接入角度错误。HTML 标签放进 `<EdgeLabelRenderer />`，绝对定位并设 `pointerEvents: 'all'`，可交互时加 `nodrag nopan`。
- `NodeResizer` 只改 React Flow 中的尺寸；业务数据需要同步尺寸时自行写回。

## Handle 与连接规则

- 同一节点有多个同类型 Handle 时每个都要唯一 `id`，边的 `sourceHandle`／`targetHandle` 与之对应；连错 Handle 或连线错位时先查这里。
- 隐藏 Handle 用 `visibility` 或 `opacity`，不用 `display: none`，否则无法测量位置。
- 增删 Handle 或程序化改变其位置后调用 `useUpdateNodeInternals()(nodeId)`；"DOM 在但连线位置不对"通常是漏了这一步。
- 局部连接约束优先放在 Handle 上：`isConnectable`、`isConnectableStart`、`isConnectableEnd`、`isValidConnection`。整图规则（如防环）放在 `<ReactFlow isValidConnection>`。按连接数限制时用 `useNodeConnections` 计数后设置 `isConnectable`，不臆造 Handle 回调签名。
- `useHandleConnections` 已废弃，新代码与迁移都改用 `useNodeConnections`。

## 性能

先用 React DevTools Profiler 录制拖拽一个节点，确认是否有无关节点一起重渲染。若有，按顺序查：订阅范围、引用稳定性、selector 是否每次返回新对象，最后才补局部 `memo`。若没有，查节点内部的重型 UI 与样式成本（阴影、渐变、持续动画）。大图可用 `hidden` 折叠子树。没有当前项目的 profiling 数据时不给 FPS 或节点数量阈值。

## 样式

加载 `@xyflow/react/dist/style.css`，需要从零定制时改用 `base.css`。明暗主题用 `colorMode`（`light`／`dark`／`system`）。主题定制改 `--xy-*` CSS 变量，不大面积覆盖内部类名；本仓库的约定见 `AGENTS.md`。

## 输出

先给根因与最小修复，再给依据与验证结果。只有用户需要追溯时才区分官方 API 事实、官方示例与工程归纳；不把示例写法说成唯一合法实现。
