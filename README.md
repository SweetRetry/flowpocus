# Flowpocus

Real-time collaborative canvas editor built with React Flow and Yjs.

[![CI](https://github.com/SweetRetry/flowpocus/actions/workflows/ci.yml/badge.svg)](https://github.com/SweetRetry/flowpocus/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Real-time Collaboration** - Multiple users can edit the same canvas simultaneously
- **Conflict-free Sync** - Powered by Yjs CRDT for seamless concurrent editing
- **User Presence** - See other users' cursors and selections in real-time
- **Scoped Undo/Redo** - Each user has independent undo history
- **Node Types** - Image and video nodes with more to come
- **Responsive UI** - Built with shadcn/ui and Tailwind CSS

## Tech Stack

| Layer | Technology |
|-------|------------|
| Node Editor | [React Flow](https://reactflow.dev/) |
| Real-time Sync | [Yjs](https://yjs.dev/) + [Hocuspocus](https://hocuspocus.dev/) |
| Frontend | [Next.js](https://nextjs.org/) 16 + React 19 |
| Backend | [Hono](https://hono.dev/) + [Bun](https://bun.sh/) |
| Database | SQLite + [Drizzle ORM](https://orm.drizzle.team/) |
| UI Components | [shadcn/ui](https://ui.shadcn.com/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) v4 |
| Build System | [Turborepo](https://turbo.build/repo) |
| Package Manager | [pnpm](https://pnpm.io/) |

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm >= 10
- Bun (for backend)

### Installation

```bash
# Clone the repository
git clone https://github.com/SweetRetry/flowpocus.git
cd flowpocus

# Install dependencies
pnpm install

# Initialize database
pnpm db:push
```

### Development

```bash
# Start all services (frontend + backend)
pnpm dev

# Or start individually
pnpm dev:web      # Frontend at http://localhost:3000
pnpm dev:backend  # Backend at http://localhost:3001
pnpm dev:cli commands list
```

Visit `http://localhost:3000/canvas/{any-id}` to start collaborating.

### Local Agent CLI

Canvas Command contract 由 `packages/commands` 共享，执行逻辑只存在于 backend。CLI 使用
Commander + Zod，通过 server API 发现和执行 command：

```bash
# 创建目标 canvas
pnpm dev:cli canvases create --name "Agent Canvas"

# 从 server 查询可用 command 与 JSON Schema
pnpm dev:cli commands list

# 使用稳定 command ID 创建节点；不确定结果时用同一 ID 重试
pnpm dev:cli commands execute create_node \
  --canvas-id <canvasId> \
  --command-id <stable-command-id> \
  --input '{"type":"text","position":{"x":120,"y":80},"content":"Agent note"}'
```

## Project Structure

```
flowpocus/
├── apps/
│   ├── web/                # Next.js frontend
│   ├── backend/            # Hono + Hocuspocus + server-owned commands
│   └── cli/                # Agent-facing server API client
├── packages/
│   ├── commands/           # Shared Zod command contracts
│   ├── canvas/             # React Flow components & hooks
│   ├── ui/                 # shadcn/ui components
│   ├── database/           # Drizzle ORM + SQLite
│   └── typescript-config/  # Shared TypeScript configs
└── ...
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development servers |
| `pnpm build` | Build all packages |
| `pnpm lint` | Run Biome linter |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm dev:cli <args>` | Call server-owned commands from the local CLI |
| `pnpm db:push` | Push database schema |
| `pnpm db:studio` | Open Drizzle Studio |

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed technical documentation.

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a PR.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](./LICENSE) for details.
