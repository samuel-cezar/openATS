# Build context is the repo root (see docker-compose.yml / .dockerignore).
FROM node:24-alpine3.23 AS builder
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY api/package.json ./api/
COPY frontend/package.json ./frontend/
COPY types/package.json ./types/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter openats-frontend build

FROM nginx:1.31.1-alpine3.23-slim
COPY --from=builder /repo/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
