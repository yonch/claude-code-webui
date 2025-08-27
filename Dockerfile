# Multi-stage build for claude-code-webui container

# Build stage - build the self-contained binary
FROM denoland/deno:2.4.5 AS builder

# Set working directory
WORKDIR /app

# Copy source code
COPY . .

# Install frontend dependencies and build
WORKDIR /app/frontend
RUN deno run -A npm:npm@latest ci
RUN deno run -A npm:npm@latest run build

# Build backend binary
WORKDIR /app/backend
RUN deno install && deno cache cli/deno.ts
RUN deno run -A npm:node@latest scripts/copy-frontend.js
RUN deno run -A npm:node@latest scripts/generate-version.js
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

# Copy the compiled binary from builder stage
COPY --from=builder /app/claude-code-webui /usr/local/bin/claude-code-webui

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