# Build context is the repo root (see docker-compose.yml / .dockerignore).
FROM node:24-alpine3.23 AS base
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /repo

FROM base AS build
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY api/package.json ./api/
COPY frontend/package.json ./frontend/
COPY types/package.json ./types/
RUN pnpm install --frozen-lockfile
COPY . .
# Compile TypeScript -> api/dist (tsconfig.json: rootDir=src, outDir=dist).
RUN pnpm --filter recruitment-api build
# Flatten the api into a self-contained dir; --prod drops the type-only devDependency.
# api/package.json's "files": ["dist"] ensures the compiled output (otherwise excluded by
# the repo's root .gitignore "**/dist", which pnpm's packing falls back to) is included.
# --legacy: the only workspace dep (@openats/types) is a type-only devDep excluded by
# --prod, so pnpm 10's injected-dependency deploy isn't needed here.
RUN pnpm --filter recruitment-api deploy --prod --legacy /app

FROM base AS runtime
WORKDIR /app
COPY --from=build /app /app
EXPOSE 3000
CMD ["node", "dist/server.js"]
