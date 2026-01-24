# AGENT.md

This file provides guidance for AI coding agents working on this project.

## Project Overview

**FlowPocus** is a real-time collaborative node editor demo powered by:

- [xyflow/react](https://reactflow.dev/) - Node-based editor
- [hocuspocus](https://hocuspocus.dev/) - Collaboration backend
- [Yjs](https://yjs.dev/) - CRDT for conflict-free synchronization

This is a minimal demo focused on demonstrating how to integrate xyflow/react with hocuspocus for real-time collaboration.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              apps/web (Next.js Frontend)                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              xyflow/react (Node Editor)             │    │
│  │                        │                            │    │
│  │              Y.js Document (CRDT)                   │    │
│  └────────────────────────┼────────────────────────────┘    │
└───────────────────────────┼─────────────────────────────────┘
                            │ WebSocket
                 ┌──────────▼──────────┐
                 │   apps/backend      │
                 │   (hocuspocus)      │
                 └─────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Node Editor | xyflow/react |
| Collaboration | hocuspocus |
| CRDT | Yjs |
| Frontend | Next.js |
| UI Components | shadcn/ui |
| Styling | Tailwind CSS |
| Build System | Turborepo |
| Package Manager | pnpm |

## Key Files

| File | Purpose |
|------|---------|
| `apps/web/app/` | Next.js App Router pages |
| `apps/backend/src/index.ts` | hocuspocus server |
| `packages/ui/src/components/` | Shared React components |
| `turbo.json` | Turborepo task configuration |

## Development Commands

```bash
# Start all services
pnpm dev

# Start individual services
pnpm dev:web      # Next.js on localhost:3000
pnpm dev:backend  # hocuspocus on localhost:3001

# Quality checks
pnpm typecheck    # TypeScript checking
pnpm lint         # Biome linting
pnpm check        # Biome with auto-fix

# Build
pnpm build
```

## Code Style

This project uses **Biome** for linting and formatting:

- **No semicolons** in JavaScript/TypeScript
- **Double quotes** for strings
- **2-space** indentation
- **Import sorting** enabled
- **Type imports** should use `import type`

Run `pnpm check` to auto-fix issues before committing.

## Workspace Packages

| Package | Alias | Description |
|---------|-------|-------------|
| `packages/ui` | `@workspace/ui` | Shared React components |
| `packages/typescript-config` | `@workspace/typescript-config` | Shared TS configs |

## Notes for AI Agents

- Always run `pnpm typecheck` after making changes
- Use `pnpm check` to auto-fix linting issues
- The `@workspace/` prefix is an alias for internal packages
- Focus on xyflow + hocuspocus integration patterns
