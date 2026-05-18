FROM node:20-alpine AS builder
WORKDIR /app
# Install both packages (API imports aggregator/src/store)
COPY aggregator/package*.json ./aggregator/
COPY api/package*.json ./api/
RUN cd aggregator && npm ci
RUN cd api && npm ci
COPY aggregator/src/ ./aggregator/src/
COPY api/ ./api/
RUN cd api && npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/api/dist ./dist
COPY --from=builder /app/api/node_modules ./node_modules
COPY api/package.json .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/src/index.js"]
