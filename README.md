# Flowpocus

Real-time collaborative canvas editor built with React Flow and Yjs.

[![CI](https://github.com/SweetRetry/flowpocus/actions/workflows/ci.yml/badge.svg)](https://github.com/SweetRetry/flowpocus/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Real-time Collaboration** - Multiple users can edit the same canvas simultaneously
- **Conflict-free Sync** - Powered by Yjs CRDT for seamless concurrent editing
- **User Presence** - See other users' cursors and selections in real-time
- **Scoped Undo/Redo** - Each user has independent undo history
- **Node Types** - Text, image, and video nodes
- **Agent Access** - Typed server-owned commands over HTTP, a local CLI, and an MCP endpoint
- **Horizontal Scaling** - Each canvas lives on one owner instance behind a database lease, with fenced writes; Redis Pub/Sub is available as an alternative mode
- **Light and Dark Themes** - Follows the system color scheme, canvas controls included

## Tech Stack

| Layer | Technology |
|-------|------------|
| Node Editor | [React Flow](https://reactflow.dev/) |
| Real-time Sync | [Yjs](https://yjs.dev/) + [Hocuspocus](https://hocuspocus.dev/) |
| Frontend | [Next.js](https://nextjs.org/) 16 + React 19 |
| Backend | [Hono](https://hono.dev/) on Node.js |
| Database | [PostgreSQL](https://www.postgresql.org/) ([node-postgres](https://node-postgres.com/)) + [Drizzle ORM](https://orm.drizzle.team/) |
| UI Components | [shadcn/ui](https://ui.shadcn.com/) on [Base UI](https://base-ui.com/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) v4 |
| Build System | [Turborepo](https://turborepo.com/), [tsdown](https://tsdown.dev/) for the backend and CLI |
| Package Manager | [pnpm](https://pnpm.io/) |

## Getting Started

### Prerequisites

- Node.js >= 24 (see `.node-version`)
- pnpm 12 (pinned in `packageManager`; Corepack or a recent pnpm picks it up)
- PostgreSQL 16+ (`docker compose up -d` starts one with the default credentials)

### Installation

```bash
# Clone the repository
git clone https://github.com/SweetRetry/flowpocus.git
cd flowpocus

# Install dependencies (also installs the Lefthook git hooks)
pnpm install

# Start PostgreSQL and apply the migrations
docker compose up -d
pnpm db:migrate
```

After changing `packages/database/src/schema`, run `pnpm db:generate` to write a new migration, then `pnpm db:migrate`.

### Development

```bash
# Start all services (frontend + backend)
pnpm dev

# Or start individually
pnpm dev:web      # Frontend at http://localhost:3000
pnpm dev:backend  # Backend at http://localhost:3001
```

Open `http://localhost:3000/canvas` (redirects to the `showcase` canvas) or
`http://localhost:3000/canvas/{any-id}`. A canvas is created on first connect.

### Production Build

```bash
# NEXT_PUBLIC_WS_URL is inlined at build time
NEXT_PUBLIC_WS_URL=wss://your-host/collaboration pnpm build

pnpm --filter @workspace/backend start   # node dist/index.js
pnpm --filter web start                  # next start
```

### Running Multiple Instances

Every instance can accept any canvas. By default (`CLUSTER_MODE=owner`) a canvas loads on exactly one
instance, which holds a lease in PostgreSQL; the others forward its WebSocket and command traffic to that
owner. Give each instance a unique `INSTANCE_ID` and an `INSTANCE_URL` its peers can reach:

```bash
PORT=3001 INSTANCE_ID=a INSTANCE_URL=http://10.0.0.5:3001 pnpm --filter @workspace/backend start
PORT=3001 INSTANCE_ID=b INSTANCE_URL=http://10.0.0.6:3001 pnpm --filter @workspace/backend start
```

Set `CLUSTER_MODE=redis` with `REDIS_URL` on every instance to sync copies over Redis instead. All instances
in a cluster must use the same mode. [ADR 0001](./docs/adr/0001-single-owner-placement.md) explains the
trade-off and when to switch.

### Environment Variables

| Variable | Used by | Default |
|----------|---------|---------|
| `PORT` | backend | `3001` |
| `DATABASE_URL` | backend, `db:*` scripts, tests | `postgres://flowpocus:flowpocus@localhost:5432/flowpocus` |
| `CLUSTER_MODE` | backend, `owner` or `redis` (see `docs/adr/0001-single-owner-placement.md`) | `owner` |
| `REDIS_URL` | backend, required when `CLUSTER_MODE=redis` | unset |
| `INSTANCE_ID` | backend, lease owner and Redis node identity | random UUID |
| `INSTANCE_URL` | backend, address other instances forward to | `http://localhost:$PORT` |
| `LOG_LEVEL` | backend (`debug`, `info`, `warn`, `error`) | `info` |
| `NEXT_PUBLIC_WS_URL` | web, at build time | `ws://localhost:3001/collaboration` |
| `FLOWPOCUS_SERVER_URL` | CLI | `http://localhost:3001` |

## Agent Access

Canvas Command contracts live in `packages/commands`; execution lives only in the backend.
The CLI and the MCP endpoint are transports for the same server commands.

### Local CLI

```bash
# Create a target canvas
pnpm dev:cli canvases create --name "Agent Canvas"

# Discover commands and their JSON Schema from the server
pnpm dev:cli commands list

# Create a node; retry with the same command ID if the outcome is unknown
pnpm dev:cli commands execute create_node \
  --canvas-id <canvasId> \
  --command-id <stable-command-id> \
  --input '{"type":"text","position":{"x":120,"y":80},"content":"Agent note"}'
```

### MCP

The backend serves a stateless Streamable HTTP MCP endpoint at `/mcp` with `list_canvases`,
`get_canvas`, and one tool per canvas command:

```bash
claude mcp add --transport http flowpocus http://localhost:3001/mcp
```

## Project Structure

```
flowpocus/
├── apps/
│   ├── web/                # Next.js frontend
│   ├── backend/            # Hono + Hocuspocus + server-owned commands + MCP
│   └── cli/                # Agent-facing server API client
├── packages/
│   ├── commands/           # Shared Zod command contracts
│   ├── canvas/             # React Flow nodes, plugins & hooks
│   ├── ui/                 # shadcn/ui components and theme tokens
│   ├── database/           # Drizzle ORM + PostgreSQL
│   └── typescript-config/  # Shared TypeScript configs
├── docs/                   # Design notes
└── ...
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development servers |
| `pnpm build` | Build all packages |
| `pnpm test` | Run tests |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm lint` | Run Biome checks |
| `pnpm check` | Run Biome with auto-fix |
| `pnpm knip` | Find unused files, exports, and dependencies |
| `pnpm dev:cli <args>` | Call server-owned commands from the local CLI |
| `pnpm db:generate` | Write a migration from schema changes |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:studio` | Open Drizzle Studio |

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) covers the data flow, sync, undo, and persistence in detail (Chinese).
- [docs/adr](./docs/adr) records architecture decisions, starting with single-owner placement.
- [docs/future](./docs/future) holds open design questions, such as where to store Yjs snapshots.
- [docs/retrospectives](./docs/retrospectives) holds dated write-ups. The
  [October 2026 retrospective](./docs/retrospectives/2026-10.md) (Chinese) walks through this round of
  changes, including how multi-instance sync moved from Redis broadcast to leases with fenced writes, and
  the bugs found on the way.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, commit
conventions, and the checks CI runs.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m "feat: add amazing feature"`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](./LICENSE) for details.
