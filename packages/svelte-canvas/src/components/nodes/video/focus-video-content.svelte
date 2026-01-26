<script lang="ts">
  import { useSvelteFlow } from "@xyflow/svelte"
  import { useFocusModeState } from "../../../hooks/use-focus-mode"
  import VideoContent from "./video-content.svelte"

  const focusInfoStore = useFocusModeState()
  const { getNode } = useSvelteFlow()

  const focusInfo = $derived($focusInfoStore)
  const node = $derived(focusInfo ? getNode(focusInfo.nodeId) : undefined)
</script>

<VideoContent videoUrl={(node?.data?.videoUrl as string) ?? undefined} variant="focus" />
