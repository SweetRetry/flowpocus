---
name: reactflow-practices
description: >-
  使用 @xyflow/react v13 实现、排查或从 v12 迁移节点编辑器：自定义 node／edge／Handle、连接规则、状态订阅、性能与样式。仅用于当前任务涉及 React Flow 的代码或行为。
---

# React Flow Practices

API 名称、参数与默认值以项目已安装版本的类型定义（`node_modules/@xyflow/react/dist/index.d.ts`，共享类型在 `@xyflow/system`）为准，其次是 reactflow.dev 的 API Reference；Learn 与 examples 只说明推荐做法，不覆盖 API 事实。凭记忆写不出确切签名时先查类型定义。记忆里的写法多来自 v11／v12；代码或记忆中出现 `applyNodeChanges`、`useStore`、`colorMode`、`*ClickDistance` 这类 v12 API 时，先读 [`migrate-v13.md`](migrate-v13.md)。

## 排查顺序

先确认安装版本、受影响路径与可复现行为，再查与问题直接相关的基础条件：样式表是否加载、画布容器是否有尺寸、组件是否在 `ReactFlowProvider` 内、node／edge `type` 是否与注册表 key 一致（不一致时静默回退为默认节点，不报错）、状态归谁所有。沿实际数据流或交互路径定位根因；先修 contract 或状态模型错误，再处理表现层。完成后用原复现路径验证业务行为、交互与持久化结果，不只检查组件是否渲染。

## 状态与订阅

- `useNodesState`／`useEdgesState` 只适合起步；状态有外部所有者时，由所有者生成 nodes／edges，`onNodesChange` 等回调把变更写回所有者，不让 React Flow 内部状态成为第二份真相。
- 一次性读取用 `useReactFlow().getNodes()／getEdges()`，它不触发重渲染；在 `useCallback`／`useEffect` 中使用时把实例列入依赖。持续订阅才用 hook。
- 高频组件只订阅渲染所需的最小 slice：单个节点或边用 `useNode(id)`／`useEdge(id)`，几个节点的 `data` 用 `useNodesData(ids)`（位置、选中、测量变化不触发它），连接用 `useNodeConnections()`，自身 id 用 `useNodeId()`。`useNodes()`／`useEdges()` 拖拽时每帧变化，只留给确实要渲染整张图的组件。选中 id 列表这类派生状态放进应用自己的 store，在变更回调里维护。
- 内部状态按领域拆成 `useNodesStore`、`useEdgesStore`、`useViewportStore`、`useOptionsStore`、`useConnectionStore`、`useSelectionStore`。选所读字段所在的那一个并传 selector；selector 返回新对象或数组时包一层 `useShallow(selector)`，需要自定义比较时用 `useEqualSelector(selector, isEqual)`。`useReactFlowStoreApi`、`useInternalNode` 绑定内部实现，有公开 API 时用公开 API。
- 等节点首次测量完成再自动布局，用 `useNodesInitialized()`。
- `width`／`height` 是期望尺寸，`measured` 是运行时测量值。测量值、选中、拖拽中等瞬时状态不写进业务数据或持久化结构。
- 父子节点用 `parentId`，`extent: 'parent'` 限制拖拽边界；节点数组顺序随意，父节点可排在子节点之后。改挂父节点用 `useReactFlow().changeParent(nodeId, parentId | null)`，不手算相对坐标。父子关系、拖拽边界和持久化结构按同一数据模型处理。

## 变更

- `onNodesChange`／`onEdgesChange` 收到 `NodeChangeset`／`EdgeChangeset`。`changes.applyTo(nodes)` 返回新数组；筛选用 `getForNode(id)`、`getByType('position')`，拦截某些变更时先 `removeForNode(id)` 或 `remove(change)` 再 `applyTo`。`addEdge` 处理 `onConnect`。所有更新保持不可变。
- 重连边用 `onReconnect` + `reconnectEdge(oldEdge, connection, edges, options?)`；`shouldReplaceId` 默认 `true`，边 id 被外部引用时传 `false`。它只处理端点重连，编辑 edge 数据走所有者的写入路径。
- `getIncomers`／`getOutgoers`／`getConnectedEdges` 用于环检测、依赖传播与级联分析，传 node 对象而非 id 字符串。环检测在 `isValidConnection` 里通过 `getNodes()`／`getEdges()` 取最新图，不在闭包中捕获某次渲染的 nodes／edges。
- `onConnectEnd`／`onReconnectEnd` 的 `connectionState.to` 已是 flow 坐标，在落点建节点时直接使用。

## 自定义 node 与 edge

- `nodeTypes`／`edgeTypes` 在模块顶层定义，动态时用 `useMemo`。
- 应用启用 React Compiler 时，自定义组件、回调与对象 props 由编译器自动 memo。未启用时手动保持：自定义 node／edge 用 `memo` 包裹，传给 `<ReactFlow />` 的回调用 `useCallback`，对象与数组 props（`snapGrid`、`defaultEdgeOptions`、`fitViewOptions`）用 `useMemo` 或提到模块顶层。每次 render 新建这些值会触发全图重渲染。
- 表格、图表、富文本等重型内容拆成独立 `memo` 子组件，不随位置变化重渲染。
- 节点内的可交互控件加 `nodrag`，浮层与边标签加 `nopan`，内部滚动容器加 `nowheel`。
- 自定义边：path util（`getBezierPath`、`getSmoothStepPath`、`getStraightPath`）生成路径，`<BaseEdge />` 渲染，并把 `sourcePosition`／`targetPosition` 传给 path util，否则接入角度错误。HTML 标签放进 `<EdgeLabelRenderer />`，绝对定位并设 `pointerEvents: 'all'`，可交互时加 `nodrag nopan`。
- `NodeResizer` 只改 React Flow 中的尺寸；业务数据需要同步尺寸时自行写回。

## Handle 与连接规则

- 同一节点有多个同类型 Handle 时每个都要唯一 `id`，边的 `sourceHandle`／`targetHandle` 与之对应；连错 Handle 或连线错位时先查这里。
- 隐藏 Handle 用 `visibility` 或 `opacity`，保持其可测量。
- 增删 Handle 或程序化改变其位置后调用 `useUpdateNodeInternals()(nodeId)`；"DOM 在但连线位置不对"通常是漏了这一步。
- 局部连接约束优先放在 Handle 上：`isConnectable`、`isConnectableStart`、`isConnectableEnd`、`isValidConnection`。整图规则（如防环）放在 `<ReactFlow isValidConnection>`。按连接数限制时用 `useNodeConnections({ handleType, handleId })` 计数后设置 `isConnectable`；命令式读取用 `useReactFlow().getNodeConnections({ nodeId, type, handleId })`。

## 性能

React Flow 13 本身已用 React Compiler 编译并按领域拆分 store，无关节点一起重渲染时多半源于应用侧。先用 React DevTools Profiler 录制拖拽一个节点，确认是否有无关节点一起重渲染。若有，按顺序查：订阅范围、引用稳定性、selector 是否每次返回新对象，最后才补局部 `memo`。若没有，查节点内部的重型 UI 与样式成本（阴影、渐变、持续动画）。大图可用 `hidden` 折叠子树。没有当前项目的 profiling 数据时不给 FPS 或节点数量阈值。

## 样式

- 加载 `@xyflow/react/style.css`。需要从零定制时改用 `base.css`；要官方 xyflow 外观时用 `xy-theme.css` 替代 `style.css`，它已包含 `base.css`。
- 库样式位于 `@layer xyflow`，未分层的规则总是胜过它。与 Tailwind 等分层 CSS 共存时，在主样式表最前声明 `@layer theme, base, xyflow, components, utilities;`，并确保该样式表先于 React Flow 样式加载，因为 layer 顺序由首次出现决定。
- 明暗模式自动跟随祖先元素上的 `dark`／`light` class 或 `data-theme`，没有时跟随系统。只有页面没有主题标记又要固定模式时才传 `forceColorMode`。自定义 CSS 可用 `light-dark()`，它跟随 flow 容器的 `color-scheme`。
- 主题定制改不带 `-default` 后缀的 `--xy-*` 变量，内部类名只做局部微调；本仓库的约定见 `AGENTS.md`。

## 输出

先给根因与最小修复，再给依据与验证结果。只有用户需要追溯时才区分官方 API 事实、官方示例与工程归纳；示例写法是一种参考实现。
