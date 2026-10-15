# ---- Build stage ----
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# cliente (dist/ + docs.md) e servidor Node (dist-server/server.js)
RUN npm run build && npm run build:server

# ---- Serve stage ----
# Servidor Node único (substitui o nginx): estático + /docs + /validate.
# O bundle não tem dependências externas → sem node_modules na imagem final.
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server

EXPOSE 5000

CMD ["node", "dist-server/server.js"]
