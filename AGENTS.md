# AGENTS.md

Flowpocus is a real-time collaborative canvas. React Flow renders it, Yjs holds it, and Hocuspocus syncs and persists it. Agents and other non-UI clients change a canvas only through server-owned Canvas Commands.

Read `ARCHITECTURE.md` (Chinese) before touching sync, undo, persistence, or the command path. `docs/future/` holds open design decisions; read the matching note before changing storage.

## Ownership

Every canvas mutation from outside the browser follows one path:

```text
CLI / MCP / HTTP -> apps/backend/src/commands -> Hocuspocus direct connection -> Y.Doc -> broadcast + persist
```

| Where | Owns |
|---|---|
| `packages/commands` | Command names, descriptions, Zod input/request/receipt schemas. The single source of truth for the contract. |
| `apps/backend/src/commands` | Executors, business validation, idempotency by `commandId`, Y.Doc mutation. |
| `apps/backend/src/routes`, `apps/backend/src/mcp` | Transport only. Decode, call the executor, map errors. |
| `apps/cli` | Transport only. Commander UX and HTTP calls. |
| `packages/canvas` | React Flow node components, plugins, and canvas hooks shared by the web app. |
| `apps/web/hooks/collaboration` | The browser side of the Yjs binding. |

Keep transports thin. A new command is a definition in `packages/commands/src/canvas.ts` plus an executor branch in `apps/backend/src/commands/canvas-command.ts`. The HTTP route, MCP tools, and CLI discover it from `canvasCommandDefinitions`.

## Invariants

- The binary Yjs state (`yjsUpdate`) is the source of truth. The `nodes`/`edges` JSON columns are a read model written by the debounced `store` hook, so they can lag the live document by up to 15s. Read live state with `readCanvasDocument` in `apps/backend/src/commands/service.ts`.
- Browser writes run inside `ydoc.transact(..., clientId)`. The observer skips its own origin and the `UndoManager` tracks only that origin, so a write with any other origin echoes back into React Flow and escapes undo.
- A canvas's live Y.Doc loads on one owner instance only (`apps/backend/src/placement`, `docs/adr/0001-single-owner-placement.md`). Code that opens a document must check `locate` first and forward when the owner is remote, as `apps/backend/src/commands/service.ts` does.
- A replayed `commandId` with the same payload returns the receipt stored in the `_serverCommands` Y.Map with `replayed: true`. The same ID with a different payload is rejected. Preserve both behaviours when you touch executors.
- `packages/database` ships TypeScript source that Node runs directly with type stripping (`pnpm start` loads it unbundled). Relative imports need explicit `.ts` extensions and only erasable syntax is allowed; its tsconfig enforces both.
- Theme React Flow through the non-default `--xy-*` variables in `packages/ui/src/styles/globals.css`. The `-default` variables lose to React Flow's own stylesheet, which loads later.

## Verify

CI (`.github/workflows/ci.yml`) is the bar. Run the same five checks before calling work done:

```bash
pnpm biome ci . && pnpm knip && pnpm typecheck && pnpm test && pnpm build
```

`pnpm check` auto-fixes Biome issues. Backend tests live beside the code as `*.test.ts`.

For behaviour changes, run the app with `pnpm dev` (web on 3000, backend on 3001) and drive a canvas. `pnpm dev:cli commands list` exercises the command path end to end.

## Commits

Conventional Commits in English ASCII, lowercase subject. `scripts/check-commit-msg.mjs` enforces it in the `commit-msg` hook and in CI.
