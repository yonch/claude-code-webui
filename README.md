# Claude Code Web UI

[![CI](https://github.com/sugyan/claude-code-webui/actions/workflows/ci.yml/badge.svg)](https://github.com/sugyan/claude-code-webui/actions/workflows/ci.yml)
[![Release](https://github.com/sugyan/claude-code-webui/actions/workflows/release.yml/badge.svg)](https://github.com/sugyan/claude-code-webui/actions/workflows/release.yml)

A web-based interface for the `claude` command line tool that provides streaming responses in a chat interface.

## Installation

### Binary Releases (Recommended)

Download the latest pre-built binary for your platform from [Releases](https://github.com/sugyan/claude-code-webui/releases):

- **Linux**: `claude-code-webui-linux-x64`, `claude-code-webui-linux-arm64`
- **macOS**: `claude-code-webui-macos-x64`, `claude-code-webui-macos-arm64`
- **Windows**: `claude-code-webui-windows-x64.exe`

```bash
# Example for macOS ARM64
curl -LO https://github.com/sugyan/claude-code-webui/releases/latest/download/claude-code-webui-macos-arm64
chmod +x claude-code-webui-macos-arm64
./claude-code-webui-macos-arm64

# With custom port
./claude-code-webui-macos-arm64 --port 9000

# Show help
./claude-code-webui-macos-arm64 --help
```

### Development Setup

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

## Development Setup

### Repository Secrets (for maintainers)

To enable automated releases via tagpr, add the following secret to the repository:

1. Go to GitHub repository Settings → Secrets and variables → Actions
2. Add a new repository secret named `GH_PAT`
3. Use a Personal Access Token with the following permissions:
   - `contents:write` - for creating releases and tags
   - `actions:write` - for triggering the release workflow
   - `pull-requests:write` - for creating release PRs

Without this token, tagpr will still create release PRs but won't trigger the binary build workflow.

## License

MIT
