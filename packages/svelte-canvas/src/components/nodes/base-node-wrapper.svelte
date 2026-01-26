<script lang="ts">
  import { Handle, NodeResizer, Position } from "@xyflow/svelte";
  import type { ComponentProps, Snippet } from "svelte";
  import { cn } from "../../lib/utils";
  import { useFocusModeActions } from "../../hooks/use-focus-mode";

  type NodeResizerProps = ComponentProps<typeof NodeResizer>

  interface ResizeOptions extends Omit<NodeResizerProps, "isVisible"> {
    enabled?: boolean
  }

  interface Props {
    nodeId: string
    selected: boolean
    label?: string
    width?: number
    height?: number
    containerClassName?: string
    resizeOptions?: ResizeOptions | false
    children: Snippet
  }

  const defaultResizeOptions: ResizeOptions = {
    enabled: true,
    minWidth: 100,
    minHeight: 50,
    lineClass: "!border-primary",
    handleClass: "!h-2.5 !w-2.5 !rounded-sm !border-2 !border-primary !bg-background"
  }

  let {
    nodeId,
    selected,
    label,
    width,
    height,
    containerClassName,
    resizeOptions = defaultResizeOptions,
    children
  }: Props = $props()

  const { enterFocusMode } = useFocusModeActions()

  let container: HTMLDivElement | null = $state(null)

  const mergedResizeOptions = $derived(
    resizeOptions === false
      ? null
      : ({ ...defaultResizeOptions, ...resizeOptions } as ResizeOptions)
  )

  const handleDoubleClick = () => {
    if (!container) return
    const rect = container.getBoundingClientRect()
    enterFocusMode({
      nodeId,
      startX: rect.left + rect.width / 2,
      startY: rect.top + rect.height / 2
    })
  }
</script>

<div class="relative h-full w-full">
  {#if mergedResizeOptions?.enabled}
    <NodeResizer isVisible={selected} {...mergedResizeOptions} />
  {/if}

  {#if label}
    <div class="absolute -top-6 left-0 truncate text-xs text-muted-foreground">{label}</div>
  {/if}

  <div
    bind:this={container}
    ondblclick={handleDoubleClick}
    class={cn(
      "overflow-hidden rounded-lg border-2 shadow-sm transition-shadow cursor-pointer w-full h-full",
      selected ? "border-ring shadow-md" : "border-border",
      containerClassName
    )}
    role="button"
    tabindex="0"
    onkeydown={(e) => e.key === "Enter" && handleDoubleClick()}
  >
    <Handle type="target" position={Position.Left} class="!bg-muted-foreground" />

    {@render children()}

    <Handle type="source" position={Position.Right} class="!bg-muted-foreground" />
  </div>
</div>
