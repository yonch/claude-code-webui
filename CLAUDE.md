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
- Light/dark theme toggle with system preference detection and localStorage persistence
- Responsive chat interface
- Comprehensive component testing with Vitest and Testing Library

### Shared Types

- **Location**: `shared/`
- **Purpose**: TypeScript type definitions shared between backend and frontend

**Key Types**:

- `StreamResponse` - Backend streaming response format
- `ChatRequest` - Chat request structure for API communication

**Note**: Claude-specific message types (`ClaudeAssistantMessage`, `ClaudeResultMessage`, etc.) are defined in `frontend/src/types.ts` for frontend-specific usage.

## Claude Command Integration

The backend uses the Claude Code SDK to execute claude commands. The SDK internally handles the claude command execution with appropriate parameters including:

- `--output-format stream-json` - Returns streaming JSON responses
- `--verbose` - Includes detailed execution information
- `-p <message>` - Prompt mode with user message

The SDK returns three types of JSON messages:

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
│   └── vite.config.ts     # Vite config with @tailwindcss/vite plugin
├── shared/           # Shared TypeScript types
│   └── types.ts
└── CLAUDE.md        # This documentation
```

## Key Design Decisions

1. **Raw JSON Streaming**: Backend passes Claude JSON responses without modification to allow frontend flexibility in handling different message types.

2. **Separate Ports**: Backend (8080) and frontend (3000) run on different ports to allow independent development and deployment.

3. **TypeScript Throughout**: Consistent TypeScript usage across all components with shared type definitions.

4. **TailwindCSS Styling**: Uses @tailwindcss/vite plugin for utility-first CSS without separate CSS files.

5. **Theme System**: Light/dark theme toggle with automatic system preference detection and localStorage persistence.

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

- **Format**: `make format` - Format both frontend and backend
- **Lint**: `make lint` - Lint both frontend and backend
- **Type Check**: `make typecheck` - Type check both frontend and backend
- **Test**: `make test` - Run frontend tests
- **Quality Check**: `make check` - Run all quality checks before commit
- **Format Specific Files**: `make format-files FILES="file1 file2"` - Format specific files with prettier

### Individual Commands

- **Development**: `make dev-backend` / `make dev-frontend`
- **Build Binary**: `make build-backend`
- **Build Frontend**: `make build-frontend`

**Note**: Always run format and lint commands before committing to ensure consistent code style. GitHub Actions will automatically run all quality checks on push and pull requests.

## Development Workflow

### Pull Request Process

1. Create a feature branch from `main`: `git checkout -b feature/your-feature-name`
2. Make your changes and commit them
3. Run all quality checks locally before pushing: `make check`
4. Push your branch and create a pull request
5. **Add appropriate labels** to categorize the changes (see Labels section below)
6. **Include essential PR information** as outlined in the Labels section
7. Request review and address feedback
8. Merge after approval and CI passes

#### Creating Pull Requests

Create pull requests with appropriate labels and essential information:

```bash
gh pr create --title "Your PR Title" \
  --label "appropriate,labels" \
  --body "Brief description"
```

**Note**: CHANGELOG.md is now automatically managed by tagpr - no manual updates needed!

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

**For Claude**: When creating PRs, always include:

1. **Type of Change checkboxes**: Include the checkbox list from the template to categorize changes:
   ```
   - [ ] 🐛 `bug` - Bug fix (non-breaking change which fixes an issue)
   - [ ] ✨ `feature` - New feature (non-breaking change which adds functionality)
   - [ ] 💥 `breaking` - Breaking change
   - [ ] 📚 `documentation` - Documentation update
   - [ ] ⚡ `performance` - Performance improvement
   - [ ] 🔨 `refactor` - Code refactoring
   - [ ] 🧪 `test` - Adding or updating tests
   - [ ] 🔧 `chore` - Maintenance, dependencies, tooling
   ```
2. **Description**: Brief summary of what changed and why
3. **GitHub labels**: Add corresponding labels using `--label` flag: `gh pr create --label "feature,documentation"`
4. **Test plan**: Include testing information if relevant

Multiple labels can be applied if the PR covers multiple areas.

### Release Process (Automated with tagpr)

1. **Feature PRs merged to main** → tagpr automatically creates/updates release PR
2. **Add version labels** to PRs if needed:
   - No label = patch version (v1.0.0 → v1.0.1)
   - `minor` label = minor version (v1.0.0 → v1.1.0)
   - `major` label = major version (v1.0.0 → v2.0.0)
3. **Review and merge release PR** → tagpr creates git tag automatically
4. **GitHub Actions builds binaries** and creates GitHub Release automatically
5. Update documentation if needed

**Manual override**: Edit `backend/VERSION` file directly if specific version needed

### GitHub Sub-Issues API

**For Claude**: When creating sub-issues to break down larger features:

```bash
# 1. Create the sub-issue normally
gh issue create --title "Sub-issue title" --body "..." --label "feature,enhancement"

# 2. Get the sub-issue ID
SUB_ISSUE_ID=$(gh api repos/owner/repo/issues/ISSUE_NUMBER --jq '.id')

# 3. Add it as sub-issue to parent issue
gh api repos/owner/repo/issues/PARENT_ISSUE_NUMBER/sub_issues \
  --method POST \
  --field sub_issue_id=$SUB_ISSUE_ID

# 4. Verify the relationship
gh api repos/owner/repo/issues/PARENT_ISSUE_NUMBER/sub_issues
```

**Key points**:
- Use issue **ID** (not number) for `sub_issue_id` parameter
- Endpoint is `/sub_issues` (plural) for POST operations
- Parent issue will show `sub_issues_summary` with total/completed counts
- Sub-issues automatically link to parent in GitHub UI

**Important for Claude**: Always run commands from the project root directory. When using `cd` commands for backend/frontend, use full paths like `cd /path/to/project/backend` to avoid getting lost in subdirectories.
