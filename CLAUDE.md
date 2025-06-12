# Claude Code Web UI

A web-based interface for the `claude` command line tool that provides streaming responses in a chat interface.

## Architecture

This project consists of three main components:

### Backend (Deno)

- **Location**: `backend/`
- **Port**: 8080 (configurable via CLI)
- **Technology**: Deno with TypeScript + Hono framework
- **Purpose**: Executes `claude` commands and streams JSON responses to frontend

**Key Features**:

- Command line interface with `--port`, `--help`, `--version` options
- Startup validation to check Claude CLI availability
- Executes `claude --output-format stream-json --verbose -p <message>`
- Streams raw Claude JSON responses without modification
- Sets working directory to project root for claude command execution
- Provides CORS headers for frontend communication
- Single binary distribution support

**API Endpoints**:

- `POST /api/chat` - Accepts chat messages and returns streaming responses
- `/*` - Serves static frontend files (in single binary mode)

### Frontend (React)

- **Location**: `frontend/`
- **Port**: 3000
- **Technology**: Vite + React + SWC + TypeScript + TailwindCSS
- **Purpose**: Provides chat interface and handles streaming responses

**Key Features**:

- Real-time streaming response display
- Parses different Claude JSON message types (system, assistant, result)
- TailwindCSS utility-first styling for responsive design
- Light theme with high contrast for readability
- Responsive chat interface
- Comprehensive component testing with Vitest and Testing Library

### Shared Types

- **Location**: `shared/`
- **Purpose**: TypeScript type definitions shared between backend and frontend

**Key Types**:

- `ChatMessage` - User and assistant messages
- `StreamResponse` - Backend streaming response format
- `ClaudeAssistantMessage` - Claude assistant response structure
- `ClaudeResultMessage` - Claude execution result structure

## Claude Command Integration

The backend executes the claude command with these parameters:

- `--output-format stream-json` - Returns streaming JSON responses
- `--verbose` - Includes detailed execution information
- `-p <message>` - Prompt mode with user message

The command outputs three types of JSON messages:

1. **System messages** (`type: "system"`) - Initialization and setup information
2. **Assistant messages** (`type: "assistant"`) - Actual response content
3. **Result messages** (`type: "result"`) - Execution summary with costs and usage

## Development

### Prerequisites

- Deno (for backend)
- Node.js (for frontend)
- Claude CLI tool installed and configured

### Running the Application

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

3. **Access Application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8080

### Project Structure

```
├── backend/           # Deno backend server
│   ├── deno.json     # Deno configuration with permissions
│   └── main.ts       # Main server implementation
├── frontend/         # React frontend application
│   ├── src/
│   │   ├── App.tsx   # Main chat interface with TailwindCSS
│   │   └── main.tsx  # Application entry point
│   ├── package.json
│   ├── tailwind.config.js  # TailwindCSS configuration
│   └── vite.config.ts     # Vite config with TailwindCSS plugin
├── shared/           # Shared TypeScript types
│   └── types.ts
└── CLAUDE.md        # This documentation
```

## Key Design Decisions

1. **Raw JSON Streaming**: Backend passes Claude JSON responses without modification to allow frontend flexibility in handling different message types.

2. **Separate Ports**: Backend (8080) and frontend (3000) run on different ports to allow independent development and deployment.

3. **TypeScript Throughout**: Consistent TypeScript usage across all components with shared type definitions.

4. **TailwindCSS Styling**: Uses @tailwindcss/vite plugin for utility-first CSS without separate CSS files.

5. **Light Theme**: Fixed light theme for better readability and contrast.

6. **Project Root Execution**: Claude commands execute from project root to have full access to project files.

## Single Binary Distribution

The project supports creating self-contained executables for all major platforms:

### Local Building

```bash
# Build for current platform
cd backend && deno task build

# Cross-platform builds are handled by GitHub Actions
```

### Automated Releases

- **Trigger**: Push git tags (e.g., `git tag v1.0.0 && git push origin v1.0.0`)
- **Platforms**: Linux (x64/ARM64), macOS (x64/ARM64), Windows (x64)
- **Output**: GitHub Releases with downloadable binaries
- **Features**: Frontend is automatically bundled into each binary

## Commands for Claude

### Unified Commands (from project root)
- **Format**: `npm run format` or `make format` - Format both frontend and backend
- **Lint**: `npm run lint` or `make lint` - Lint both frontend and backend  
- **Type Check**: `npm run typecheck` or `make typecheck` - Type check both frontend and backend
- **Test**: `npm run test` or `make test` - Run frontend tests
- **Quality Check**: `make check` - Run all quality checks before commit

### Individual Commands
- **Development**: `npm run dev:backend` / `npm run dev:frontend` or `make dev-backend` / `make dev-frontend`
- **Build Binary**: `npm run build:backend` or `make build-backend`
- **Build Frontend**: `npm run build:frontend` or `make build-frontend`

**Note**: Always run format and lint commands before committing to ensure consistent code style. GitHub Actions will automatically run all quality checks on push and pull requests.

## Development Workflow

### Pull Request Process

1. Create a feature branch from `main`: `git checkout -b feature/your-feature-name`
2. Make your changes and commit them
3. Run all quality checks locally before pushing
4. Push your branch and create a pull request
5. **Add appropriate labels** to categorize the changes (see Labels section below)
6. **Check corresponding boxes** in the PR template that match the labels
7. Update CHANGELOG.md with your changes in the Unreleased section
8. Request review and address feedback
9. Merge after approval and CI passes

### Labels

The project uses the following labels for categorizing pull requests and issues:

- 🐛 **`bug`** - Bug fixes (non-breaking changes that fix issues)
- ✨ **`feature`** - New features (non-breaking changes that add functionality)
- 💥 **`breaking`** - Breaking changes (changes that would cause existing functionality to not work as expected)
- 📚 **`documentation`** - Documentation improvements or additions
- ⚡ **`performance`** - Performance improvements
- 🔨 **`refactor`** - Code refactoring (no functional changes)
- 🧪 **`test`** - Adding or updating tests
- 🔧 **`chore`** - Maintenance, dependencies, tooling updates

**For Claude**: When creating PRs, always:

1. Check the appropriate boxes in the PR template
2. Add the corresponding GitHub labels using `--label` flag: `gh pr create --label "feature,documentation"`
3. Multiple labels can be applied if the PR covers multiple areas

### Release Process

1. Update CHANGELOG.md moving items from Unreleased to new version section
2. Commit changelog updates to main branch
3. Create and push a git tag: `git tag v1.0.0 && git push origin v1.0.0`
4. GitHub Actions automatically creates release with binaries
5. Update documentation if needed

**Important for Claude**: Always run commands from the project root directory. When using `cd` commands for backend/frontend, use full paths like `cd /path/to/project/backend` to avoid getting lost in subdirectories.
