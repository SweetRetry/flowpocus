<script lang="ts">
  import { marked } from "marked";
  import DOMPurify from "dompurify";
  import { cn } from "../../../lib/utils";

  interface Props {
    content: string
    onContentChange?: (content: string) => void
    variant?: "node" | "focus"
  }

  let { content, onContentChange, variant = "node" }: Props = $props()

  let isEditing = $state(false)
  let editContent = $state("")

  const renderer = new marked.Renderer()
  renderer.link = (href, title, text) => {
    const safeHref = href ?? ""
    const safeTitle = title ? ` title="${title}"` : ""
    return `<a href="${safeHref}"${safeTitle} target="_blank" rel="noopener noreferrer" class="text-primary underline hover:no-underline">${text}</a>`
  }

  $effect(() => {
    if (!isEditing) {
      editContent = content
    }
  })

  const renderedHtml = $derived(
    typeof window === "undefined"
      ? ""
      : DOMPurify.sanitize(marked.parse(content || "_Empty_", { renderer }) as string)
  )

  const isFocus = $derived(variant === "focus")

  const handleClick = () => {
    editContent = content
    isEditing = true
  }

  const handleBlur = () => {
    isEditing = false
    onContentChange?.(editContent)
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      isEditing = false
      editContent = content
    }
  }
</script>

{#if isEditing}
  <textarea
    class={cn(
      "nodrag nowheel h-full w-full resize-none bg-transparent text-foreground outline-none",
      isFocus ? "bg-card p-6" : "p-3"
    )}
    bind:value={editContent}
    onblur={handleBlur}
    onkeydown={handleKeyDown}
  ></textarea>
{:else}
  <div
    class={cn(
      "prose prose-sm dark:prose-invert h-full w-full max-w-none cursor-text overflow-auto text-foreground",
      isFocus ? "bg-card p-6" : "p-3"
    )}
    onclick={handleClick}
    onkeydown={handleClick}
    role="button"
    tabindex="0"
  >
    {@html renderedHtml}
  </div>
{/if}
