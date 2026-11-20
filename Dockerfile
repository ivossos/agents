# Agents Control Center — Docker image
# Build: docker build -t agents-control-center .
# Run:   docker run -p 3000:3000 --env-file .env agents-control-center

FROM node:20-alpine

# Install the claude CLI (needed to dispatch agent runs)
RUN npm install -g @anthropic-ai/claude-code

# Non-root user provided by the base image
USER node

# Copy the whole repo so the server can reach the agent .md files
WORKDIR /app
COPY --chown=node:node . .

# Move into the server directory
WORKDIR /app/website

# Expose server port (override with PORT env var)
EXPOSE 3000

# Bind to all interfaces and allow non-localhost Host headers in containers
ENV HOST=0.0.0.0
ENV ALLOW_ANY_HOST=1
ENV PORT=3000
# AGENTS_DIR defaults to /app (parent of /app/website) — all agent .md files live there

CMD ["node", "server.js"]
