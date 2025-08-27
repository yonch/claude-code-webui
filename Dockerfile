# Multi-stage build for claude-code-webui container

# Frontend build stage - use Node.js for faster npm operations
FROM node:22-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci
COPY frontend/ ./frontend/
COPY shared/ ./shared/
COPY backend/scripts/ ./backend/scripts/
COPY backend/package.json ./backend/package.json
COPY backend/cli/ ./backend/cli/
WORKDIR /app/frontend
RUN npm run build
# Copy frontend assets to backend static directory and generate version
WORKDIR /app
RUN node backend/scripts/copy-frontend.js
RUN cd backend && node scripts/generate-version.js

# Backend build stage - use Deno for binary compilation
FROM denoland/deno:2.4.5 AS backend-builder
WORKDIR /app

# Copy backend source
COPY backend/ ./backend/
COPY shared/ ./shared/

# Copy prepared files from frontend-builder stage
COPY --from=frontend-builder /app/backend/dist ./backend/dist
COPY --from=frontend-builder /app/backend/cli/version.ts ./backend/cli/version.ts

# Install Deno dependencies and build backend
WORKDIR /app/backend
RUN deno install && deno cache cli/deno.ts
RUN deno compile \
    --allow-net \
    --allow-run \
    --allow-read \
    --allow-write \
    --allow-env \
    --allow-sys \
    --include ./dist/static \
    --target x86_64-unknown-linux-gnu \
    --output /app/claude-code-webui \
    cli/deno.ts

# Runtime stage - minimal Node.js Alpine with Claude CLI
FROM node:22-alpine AS runtime

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Install Claude CLI globally
RUN npm install -g @anthropic-ai/claude-code@1.0.77

# Copy the compiled binary from backend builder stage
COPY --from=backend-builder /app/claude-code-webui /usr/local/bin/claude-code-webui

# Make binary executable and owned by appuser
RUN chmod +x /usr/local/bin/claude-code-webui && \
    chown appuser:appgroup /usr/local/bin/claude-code-webui

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

# Set default port via environment variable
ENV PORT=8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/projects || exit 1

# Run the webui
CMD ["claude-code-webui"]