<script lang="ts">
  import Button from "@workspace/svelte-ui/components/button";
  import { Image, Redo2, Type, Undo2, Video } from "lucide-svelte";

  interface Props {
    canUndo: boolean
    canRedo: boolean
    onUndo: () => void
    onRedo: () => void
    onAddImageNode: () => void
    onAddVideoNode: () => void
    onAddTextNode: () => void
  }

  let {
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    onAddImageNode,
    onAddVideoNode,
    onAddTextNode
  }: Props = $props()
</script>

<div class="flex items-center gap-1 rounded-lg border bg-background p-1 shadow-sm">
  <Button
    variant="ghost"
    size="icon"
    onclick={onUndo}
    disabled={!canUndo}
    aria-label="Undo (Ctrl+Z)"
    title="Undo (Ctrl+Z)"
  >
    <Undo2 class="size-[18px]" />
  </Button>

  <Button
    variant="ghost"
    size="icon"
    onclick={onRedo}
    disabled={!canRedo}
    aria-label="Redo (Ctrl+Shift+Z)"
    title="Redo (Ctrl+Shift+Z)"
  >
    <Redo2 class="size-[18px]" />
  </Button>

  <div class="mx-1 h-6 w-px bg-border"></div>

  <Button variant="ghost" size="sm" onclick={onAddImageNode} title="Add Image">
    <Image class="size-4" />
    Image
  </Button>

  <Button variant="ghost" size="sm" onclick={onAddVideoNode} title="Add Video">
    <Video class="size-4" />
    Video
  </Button>

  <Button variant="ghost" size="sm" onclick={onAddTextNode} title="Add Text">
    <Type class="size-4" />
    Text
  </Button>
</div>
