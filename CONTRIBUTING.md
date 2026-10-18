# Contributing to Flowpocus

Thank you for your interest in contributing to Flowpocus! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## Getting Started

### Prerequisites

- Node.js >= 24 (see `.node-version`)
- pnpm 12 (pinned in `packageManager`)

### Development Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/flowpocus.git
   cd flowpocus
   ```
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Initialize the database:
   ```bash
   pnpm db:push
   ```
5. Start the development servers:
   ```bash
   pnpm dev
   ```

## Development Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation changes
- `refactor/description` - Code refactoring

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification, written in English. The `commit-msg` hook (`scripts/check-commit-msg.mjs`) rejects anything else, and CI re-checks every commit in a PR. Also allowed: `perf`, `build`, `ci`, `revert`.

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

Examples:
```
feat: add real-time cursor tracking
fix: resolve node deletion sync issue
docs: update installation instructions
```

### Code Style

This project uses [Biome](https://biomejs.dev/) for linting and formatting:

```bash
# Check for issues
pnpm lint

# Auto-fix issues
pnpm lint:fix

# Format code
pnpm format
```

Git hooks are managed by [Lefthook](https://lefthook.dev/) and installed by `pnpm install`. Pre-commit runs Biome on staged files and restages fixes. Pre-push runs Knip and the typecheck.

### Type Checking

```bash
pnpm typecheck
```

### Building

```bash
pnpm build
```

## Pull Request Process

1. Create a new branch from `master`
2. Make your changes
3. Ensure the same checks CI runs pass:
   ```bash
   pnpm biome ci . && pnpm knip && pnpm typecheck && pnpm test && pnpm build
   ```
4. Push your branch and create a Pull Request with a clear description of the change
5. Wait for review and address any feedback

### PR Guidelines

- Keep PRs focused and reasonably sized
- Include a clear description of changes
- Reference related issues using `#issue-number`
- Update documentation if needed
- Add tests for new functionality when applicable

## Project Structure

```
flowpocus/
├── apps/
│   ├── web/          # Next.js frontend
│   ├── backend/      # Hono + Hocuspocus backend
│   └── cli/          # Agent-facing CLI
├── packages/
│   ├── commands/     # Shared Zod command contracts
│   ├── canvas/       # React Flow components & hooks
│   ├── ui/           # Shared UI components
│   ├── database/     # Drizzle ORM + SQLite
│   └── typescript-config/  # Shared TS configs
└── ...
```

## Reporting Issues

### Bug Reports

When reporting bugs, please include:

- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node version, browser)
- Screenshots or recordings if applicable

### Feature Requests

When requesting features, please include:

- Clear description of the proposed feature
- Use case and motivation
- Any relevant examples or mockups

## Questions?

Feel free to open an [issue](https://github.com/SweetRetry/flowpocus/issues) for questions or ideas.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
