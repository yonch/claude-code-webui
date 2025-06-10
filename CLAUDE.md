# Claude Code Web UI

A web-based interface for the `claude` command line tool that provides streaming responses in a chat interface.

## Architecture

This project consists of three main components:

### Backend (Deno)
- **Location**: `backend/`
- **Port**: 8080
- **Technology**: Deno with TypeScript
- **Purpose**: Executes `claude` commands and streams JSON responses to frontend

**Key Features**:
- Executes `claude --output-format stream-json --verbose -p <message>`
- Streams raw Claude JSON responses without modification
- Sets working directory to project root for claude command execution
- Provides CORS headers for frontend communication

**API Endpoints**:
- `POST /api/chat` - Accepts chat messages and returns streaming responses

### Frontend (React)
- **Location**: `frontend/`
- **Port**: 3000
- **Technology**: Vite + React + SWC + TypeScript
- **Purpose**: Provides chat interface and handles streaming responses

**Key Features**:
- Real-time streaming response display
- Parses different Claude JSON message types (system, assistant, result)
- Light theme with high contrast for readability
- Responsive chat interface

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
│   │   ├── App.tsx   # Main chat interface
│   │   ├── App.css   # Chat styling
│   │   └── index.css # Global styles
│   ├── package.json
│   └── vite.config.ts
├── shared/           # Shared TypeScript types
│   └── types.ts
└── CLAUDE.md        # This documentation
```

## Key Design Decisions

1. **Raw JSON Streaming**: Backend passes Claude JSON responses without modification to allow frontend flexibility in handling different message types.

2. **Separate Ports**: Backend (8080) and frontend (3000) run on different ports to allow independent development and deployment.

3. **TypeScript Throughout**: Consistent TypeScript usage across all components with shared type definitions.

4. **Light Theme**: Fixed light theme for better readability and contrast.

5. **Project Root Execution**: Claude commands execute from project root to have full access to project files.

## Commands for Claude

- **Development**: Use `deno task dev` for backend and `npm run dev` for frontend
- **Format**: Use `deno task format` for backend and `npm run format` for frontend
- **Lint**: Use `deno task lint` for backend and `npm run lint` for frontend
- **Type Check**: Use `deno task check` for backend and `npm run typecheck` for frontend
- **Build**: Frontend build with `npm run build`
- **Test**: No testing configured yet

**Note**: Always run format and lint commands before committing to ensure consistent code style. GitHub Actions will automatically run all quality checks on push and pull requests.

**Important for Claude**: Always run commands from the project root directory. When using `cd` commands for backend/frontend, use full paths like `cd /path/to/project/backend` to avoid getting lost in subdirectories.