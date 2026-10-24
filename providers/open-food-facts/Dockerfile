FROM oven/bun:1.2-alpine
WORKDIR /provider
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile || bun install
COPY . .
EXPOSE 3900
CMD ["bun", "run", "start"]
