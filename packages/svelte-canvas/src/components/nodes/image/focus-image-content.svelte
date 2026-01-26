<script lang="ts">
  import { useSvelteFlow } from "@xyflow/svelte"
  import { useFocusModeState } from "../../../hooks/use-focus-mode"
  import ImageContent from "./image-content.svelte"

  const focusInfoStore = useFocusModeState()
  const { getNode } = useSvelteFlow()

  const focusInfo = $derived($focusInfoStore)
  const node = $derived(focusInfo ? getNode(focusInfo.nodeId) : undefined)
</script>

<ImageContent
  imageUrl={(node?.data?.imageUrl as string) ?? undefined}
  label={(node?.data?.label as string) ?? undefined}
  variant="focus"
/>
