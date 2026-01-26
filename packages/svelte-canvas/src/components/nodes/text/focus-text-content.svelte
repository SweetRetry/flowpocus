<script lang="ts">
  import { useSvelteFlow } from "@xyflow/svelte"
  import { useFocusModeState } from "../../../hooks/use-focus-mode"
  import TextContent from "./text-content.svelte"

  const focusInfoStore = useFocusModeState()
  const { getNode, updateNodeData } = useSvelteFlow()

  const focusInfo = $derived($focusInfoStore)
  const node = $derived(focusInfo ? getNode(focusInfo.nodeId) : undefined)
  const content = $derived((node?.data?.content as string) ?? "")

  const handleContentChange = (newContent: string) => {
    if (!focusInfo) return
    updateNodeData(focusInfo.nodeId, { content: newContent })
  }
</script>

<TextContent {content} onContentChange={handleContentChange} variant="focus" />
