<script lang="ts">
  import { cn } from "../../../lib/utils"

  interface Props {
    videoUrl?: string
    variant?: "node" | "focus"
  }

  let { videoUrl, variant = "node" }: Props = $props()

  const isFocus = $derived(variant === "focus")
</script>

{#if !videoUrl}
  <div class="flex h-full w-full items-center justify-center bg-secondary text-muted-foreground">
    No video
  </div>
{:else}
  <video
    src={videoUrl}
    class={cn(
      "h-full w-full",
      isFocus ? "object-contain" : "object-cover pointer-events-none"
    )}
    controls={isFocus}
    autoplay
    muted
    loop
    playsinline
  ></video>
{/if}
