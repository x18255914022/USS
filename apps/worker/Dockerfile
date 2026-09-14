FROM node:24-alpine

WORKDIR /app
COPY . .

RUN corepack enable && pnpm install --no-frozen-lockfile

CMD ["pnpm", "--filter", "@app/worker", "dev"]

