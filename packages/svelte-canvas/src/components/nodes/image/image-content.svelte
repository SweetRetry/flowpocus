<script lang="ts">
  import { cn } from "../../../lib/utils"

  interface Props {
    imageUrl?: string
    label?: string
    variant?: "node" | "focus"
  }

  let { imageUrl, label, variant = "node" }: Props = $props()
</script>

{#if !imageUrl}
  <div class="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
    No image
  </div>
{:else}
  <img
    src={imageUrl}
    alt={label ?? "Image"}
    class={cn("h-full w-full", variant === "focus" ? "object-contain" : "object-cover")}
    draggable={false}
  />
{/if}
