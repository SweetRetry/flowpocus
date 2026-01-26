<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte"
  import { useSvelteFlow } from "@xyflow/svelte"
  import { useFocusModeActions, useFocusModeState } from "../../hooks/use-focus-mode"
  import FocusContent from "./focus-content.svelte"

  const focusInfoStore = useFocusModeState()
  const { exitFocusMode } = useFocusModeActions()
  const { getNode } = useSvelteFlow()

  let visible = $state(false)
  let expanded = $state(false)
  let currentFocus: { nodeId: string; startX: number; startY: number } | null = $state(null)
  let closeTimeout: ReturnType<typeof setTimeout> | undefined

  const focusInfo = $derived($focusInfoStore)
  const node = $derived(focusInfo ? getNode(focusInfo.nodeId) : undefined)

  // Calculate container dimensions based on node aspect ratio
  const containerStyle = $derived.by(() => {
    if (!node) return { width: "80vw", height: "80vh" }

    const nodeWidth = node.measured?.width ?? node.width ?? 0
    const nodeHeight = node.measured?.height ?? node.height ?? 0

    if (nodeWidth <= 0 || nodeHeight <= 0) {
      return { width: "80vw", height: "80vh" }
    }

    const aspectRatio = nodeWidth / nodeHeight
    const maxW = 80 // vw
    const maxH = 80 // vh

    // Determine which dimension is the constraint
    // If aspect ratio > viewport aspect ratio, width is the constraint
    // We use CSS clamp to handle this dynamically
    if (aspectRatio > 1) {
      // Landscape: constrain by width first
      return {
        width: `min(${maxW}vw, ${maxH}vh * ${aspectRatio})`,
        height: `min(${maxH}vh, ${maxW}vw / ${aspectRatio})`,
      }
    } else {
      // Portrait: constrain by height first
      return {
        width: `min(${maxW}vw, ${maxH}vh * ${aspectRatio})`,
        height: `min(${maxH}vh, ${maxW}vw / ${aspectRatio})`,
      }
    }
  })

  $effect(() => {
    if (focusInfo) {
      currentFocus = focusInfo
      visible = true
      tick().then(() => {
        expanded = true
      })
    } else if (visible) {
      expanded = false
      clearTimeout(closeTimeout)
      closeTimeout = setTimeout(() => {
        visible = false
        currentFocus = null
      }, 200)
    }
  })

  const handleBackdropClick = (event: MouseEvent) => {
    if (event.target === event.currentTarget) {
      exitFocusMode()
    }
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      exitFocusMode()
    }
  }

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  })

  onDestroy(() => {
    clearTimeout(closeTimeout)
  })
</script>

{#if visible && currentFocus}
  <div
    class="fixed inset-0 z-[9999]"
    style={expanded
      ? "background-color: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px); transition: background-color 0.3s ease;"
      : "background-color: rgba(0, 0, 0, 0); transition: background-color 0.3s ease;"}
    onclick={handleBackdropClick}
    onkeydown={handleKeyDown}
    role="dialog"
    tabindex="-1"
  >
    <div
      class="absolute overflow-hidden"
      style={expanded
        ? `width: ${containerStyle.width}; height: ${containerStyle.height}; left: 50%; top: 50%; transform: translate(-50%, -50%); transition: all 0.3s ease-out;`
        : `width: 0; height: 0; left: ${currentFocus.startX}px; top: ${currentFocus.startY}px; transform: translate(-50%, -50%); transition: all 0.3s ease-out;`}
    >
      <FocusContent />
    </div>
  </div>
{/if}
