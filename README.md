# Claude Code Web UI

[![CI](https://github.com/sugyan/claude-code-webui/actions/workflows/ci.yml/badge.svg)](https://github.com/sugyan/claude-code-webui/actions/workflows/ci.yml)

A web-based interface for the `claude` command line tool that provides streaming responses in a chat interface.

## Quick Start

1. **Start Backend**:
   ```bash
   cd backend
   deno task dev
   ```

2. **Start Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

3. **Access Application**: http://localhost:3000

## Documentation

See [CLAUDE.md](./CLAUDE.md) for comprehensive documentation including:
- Architecture overview
- Development setup
- Available commands
- Design decisions

## Prerequisites

- Deno (for backend)
- Node.js (for frontend)
- Claude CLI tool installed and configured

## License

MIT