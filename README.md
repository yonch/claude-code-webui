# Claude Code Web UI

[![CI](https://github.com/sugyan/claude-code-webui/actions/workflows/ci.yml/badge.svg)](https://github.com/sugyan/claude-code-webui/actions/workflows/ci.yml)
[![Release](https://github.com/sugyan/claude-code-webui/actions/workflows/release.yml/badge.svg)](https://github.com/sugyan/claude-code-webui/actions/workflows/release.yml)

A web-based interface for the `claude` command line tool that provides streaming responses in a chat interface.

## ⚠️ Important Security Notice

**This tool is designed for local development use only.** It executes the `claude` CLI command locally and provides a web interface to interact with it. 

⚠️ **DO NOT expose this server to the internet or public networks.** Doing so would:
- Give external users full access to your local environment through Claude CLI
- Allow execution of arbitrary commands on your machine
- Potentially expose sensitive files and credentials

Always run this tool only on `localhost` (127.0.0.1) and never bind it to public IP addresses.

## About This Tool

This application serves as a **local web UI replacement** for the Claude CLI tool. Instead of interacting with Claude through the command line, you can:

- Use a modern chat interface in your browser
- View streaming responses in real-time
- Access the same Claude functionality with better UX

The tool works by:
1. Running a local web server that accepts chat messages
2. Executing `claude --output-format stream-json --verbose -p <message>` for each request
3. Streaming the JSON responses back to the web interface
4. Displaying the formatted responses in a chat UI

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

### Required

- **Claude CLI tool** - This application requires the official `claude` command line tool to be installed and properly configured with your API key
  - Install from: https://github.com/anthropics/claude-code
  - Must be accessible in your `$PATH`
  - Must be authenticated (run `claude auth` first)

### For Development

- **Deno** (for backend development)
- **Node.js** (for frontend development)

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
