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
- **Light and Dark Themes** - Follows the system color scheme, canvas controls included

## Tech Stack

| Layer | Technology |
|-------|------------|
| Node Editor | [React Flow](https://reactflow.dev/) |
| Real-time Sync | [Yjs](https://yjs.dev/) + [Hocuspocus](https://hocuspocus.dev/) |
| Frontend | [Next.js](https://nextjs.org/) 16 + React 19 |
| Backend | [Hono](https://hono.dev/) on Node.js |
| Database | SQLite ([better-sqlite3](https://github.com/WiseLibs/better-sqlite3)) + [Drizzle ORM](https://orm.drizzle.team/) |
| UI Components | [shadcn/ui](https://ui.shadcn.com/) on [Base UI](https://base-ui.com/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) v4 |
| Build System | [Turborepo](https://turborepo.com/), [tsdown](https://tsdown.dev/) for the backend and CLI |
| Package Manager | [pnpm](https://pnpm.io/) |

## Getting Started

### Prerequisites

- Node.js >= 24 (see `.node-version`)
- pnpm 12 (pinned in `packageManager`; Corepack or a recent pnpm picks it up)

### Installation

```bash
# Clone the repository
git clone https://github.com/SweetRetry/flowpocus.git
cd flowpocus

# Install dependencies (also installs the Lefthook git hooks)
pnpm install

# Create the SQLite database and apply the schema
pnpm db:push
```

Run `pnpm db:push` again whenever `packages/database/src/schema` changes.

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

### Environment Variables

| Variable | Used by | Default |
|----------|---------|---------|
| `PORT` | backend | `3001` |
| `DATABASE_URL` | backend, `db:push` | `packages/database/data/flowpocus.db` |
| `REDIS_URL` | backend | unset (single-node mode) |
| `INSTANCE_ID` | backend, Redis node identity | random UUID |
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
│   ├── database/           # Drizzle ORM + SQLite
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
| `pnpm db:push` | Push database schema |
| `pnpm db:studio` | Open Drizzle Studio |

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed technical documentation.

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
