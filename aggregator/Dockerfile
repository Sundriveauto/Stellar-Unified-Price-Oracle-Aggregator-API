FROM node:20-alpine AS builder
WORKDIR /app
COPY aggregator/package*.json ./aggregator/
RUN cd aggregator && npm ci
COPY aggregator/ ./aggregator/
RUN cd aggregator && npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/aggregator/dist ./dist
COPY --from=builder /app/aggregator/node_modules ./node_modules
COPY aggregator/package.json .
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
