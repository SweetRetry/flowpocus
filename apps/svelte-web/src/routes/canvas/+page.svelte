<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { SvelteFlowProvider } from "@xyflow/svelte";
  import CanvasEditorInner from "@workspace/svelte-canvas/components/canvas-editor-inner";
  import { getMockSession } from "$lib/auth";

  const DEFAULT_CANVAS_ID = "showcase_svelte"

  const generateUserId = () => `user-${Math.random().toString(36).slice(2, 8)}`

  let userParam: string | null = null

  const serverUrl = import.meta.env.VITE_WS_URL ?? "ws://localhost:3001/collaboration"

  $: session = userParam ? getMockSession(userParam) : null

  onMount(() => {
    const params = new URLSearchParams(window.location.search)
    const user = params.get("user")

    if (!user) {
      const newUserId = generateUserId()
      params.set("user", newUserId)
      goto(`?${params.toString()}`, { replaceState: true })
      userParam = newUserId
      return
    }

    userParam = user
  })
</script>

{#if userParam && session}
  <div class="h-screen w-screen">
    <SvelteFlowProvider>
      <CanvasEditorInner
        canvasId={DEFAULT_CANVAS_ID}
        serverUrl={serverUrl}
        token={session.token}
        user={session.user}
      />
    </SvelteFlowProvider>
  </div>
{/if}
