FROM node:22-bookworm-slim AS deps
WORKDIR /app

# python3/make/g++ são o fallback do node-gyp caso não exista prebuild
# binário do sqlite3 para a arquitetura da imagem.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN chown -R node:node /app

USER node

CMD ["node", "index.js"]
