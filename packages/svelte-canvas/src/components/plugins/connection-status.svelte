<script lang="ts">
  import type { ConnectionStatus } from "../../types/collaboration"
  import { cn } from "../../lib/utils"

  interface Props {
    status: ConnectionStatus
    userCount: number
    error?: string
  }

  let { status, userCount, error }: Props = $props()

  const statusConfig: Record<
    ConnectionStatus,
    { label: string; badgeClassName: string; dotClassName: string }
  > = {
    disconnected: {
      label: "Offline",
      badgeClassName: "bg-muted text-muted-foreground",
      dotClassName: "bg-muted-foreground"
    },
    connecting: {
      label: "Connecting...",
      badgeClassName: "bg-warning/15 text-warning-foreground dark:text-warning",
      dotClassName: "animate-pulse bg-warning"
    },
    connected: {
      label: "Connected",
      badgeClassName: "bg-success/15 text-success-foreground dark:text-success",
      dotClassName: "bg-success"
    },
    error: {
      label: "Error",
      badgeClassName: "bg-destructive/15 text-destructive",
      dotClassName: "bg-destructive"
    }
  }

  const config = $derived(statusConfig[status])
</script>

<div class="flex items-center gap-2">
  <div
    class={cn(
      "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
      config.badgeClassName
    )}
  >
    <span class={cn("h-2 w-2 rounded-full", config.dotClassName)}></span>
    {config.label}
    {#if error}
      <span class="ml-1 text-xs opacity-75">({error})</span>
    {/if}
  </div>

  {#if status === "connected" && userCount > 0}
    <div class="flex items-center gap-1 text-xs text-muted-foreground">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
      <span>{userCount + 1}</span>
    </div>
  {/if}
</div>
