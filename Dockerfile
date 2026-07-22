FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/* && corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/server/package.json packages/server/package.json
COPY packages/web/package.json packages/web/package.json
RUN pnpm install --frozen-lockfile
COPY . .
ARG VITE_API_URL=/api
ARG VITE_AUTH_DISABLED=false
ARG VITE_AUTH0_DOMAIN
ARG VITE_AUTH0_CLIENT_ID
ARG VITE_AUTH0_AUDIENCE
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_AUTH_DISABLED=${VITE_AUTH_DISABLED}
ENV VITE_AUTH0_DOMAIN=${VITE_AUTH0_DOMAIN}
ENV VITE_AUTH0_CLIENT_ID=${VITE_AUTH0_CLIENT_ID}
ENV VITE_AUTH0_AUDIENCE=${VITE_AUTH0_AUDIENCE}
RUN pnpm db:generate && pnpm build

FROM build AS production-dependencies
RUN pnpm --filter @ferie/server deploy --prod --legacy /prod/server
RUN source_client="$(find /app/node_modules -path '*/node_modules/.prisma/client/index.js' -print -quit)" \
    && target_client="$(readlink -f /prod/server/node_modules/@prisma/client)" \
    && target_modules="$(dirname "$(dirname "$target_client")")" \
    && test -n "$source_client" \
    && test -n "$target_client" \
    && cp -R "$(dirname "$(dirname "$source_client")")" "$target_modules/.prisma" \
    && find /prod/server/node_modules -type l \( -name prisma -o -name typescript \) -delete \
    && find /prod/server/node_modules -path '*/node_modules/.bin/prisma' -delete \
    && find /prod/server/node_modules -path '*/node_modules/.bin/tsc' -delete \
    && find /prod/server/node_modules -path '*/node_modules/.bin/tsserver' -delete \
    && find /prod/server/node_modules/.pnpm -maxdepth 1 -type d \( -name 'prisma@*' -o -name 'typescript@*' \) -exec rm -rf {} +

FROM build AS migration
ENV NODE_ENV=production
CMD ["pnpm", "--filter", "@ferie/server", "db:deploy"]

FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends curl openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=production-dependencies /prod/server/node_modules ./node_modules
COPY --from=build /app/packages/server/package.json ./packages/server/package.json
COPY --from=build /app/packages/server/dist ./packages/server/dist
COPY --from=build /app/packages/web/dist ./packages/web/dist
EXPOSE 3000
CMD ["node", "packages/server/dist/index.js"]
