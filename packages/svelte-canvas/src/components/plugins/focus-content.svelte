<script lang="ts">
  import { useSvelteFlow } from "@xyflow/svelte";
  import { useFocusModeState } from "../../hooks/use-focus-mode";
  import FocusImageContent from "../nodes/image/focus-image-content.svelte";
  import FocusTextContent from "../nodes/text/focus-text-content.svelte";
  import FocusVideoContent from "../nodes/video/focus-video-content.svelte";

  const focusInfoStore = useFocusModeState()
  const { getNode } = useSvelteFlow()

  const focusInfo = $derived($focusInfoStore)
  const node = $derived(focusInfo ? getNode(focusInfo.nodeId) : undefined)
</script>

{#if node}
  {#if node.type === "text"}
    <FocusTextContent />
  {:else if node.type === "image"}
    <FocusImageContent />
  {:else if node.type === "video"}
    <FocusVideoContent />
  {:else}
    <div class="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
      Unsupported node type
    </div>
  {/if}
{/if}
