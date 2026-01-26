<script lang="ts">
  import { useSvelteFlow } from "@xyflow/svelte";
  import type { UserPresence } from "../../types/collaboration";

  interface Props {
    users?: UserPresence[]
  }

  let { users = [] }: Props = $props()

  const { flowToScreenPosition } = useSvelteFlow()

  const cursorStyle = (cursor: { x: number; y: number }) => {
    const screenPos = flowToScreenPosition(cursor)
    return `transform: translate(${screenPos.x}px, ${screenPos.y}px);`
  }
</script>

<div class="pointer-events-none absolute inset-0 z-50 overflow-hidden">
  {#each users as user (user.id)}
    {#if user.cursor}
      <div class="absolute transition-transform duration-75" style={cursorStyle(user.cursor)}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          style={`color: ${user.color}`}
          aria-hidden="true"
        >
          <path
            d="M0 0L16 6L9 9L6 16L0 0Z"
            fill="currentColor"
            stroke="white"
            stroke-width="1"
          />
        </svg>
        <div
          class="ml-4 mt-1 whitespace-nowrap rounded px-1.5 py-0.5 text-xs text-white shadow-sm"
          style={`background-color: ${user.color}`}
        >
          {user.name}
        </div>
      </div>
    {/if}
  {/each}
</div>
