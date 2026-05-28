FROM node:22-alpine AS deps
WORKDIR /app
ARG NPM_VERSION=11.11.1
RUN npm install -g npm@${NPM_VERSION}
COPY package*.json ./
COPY backend/package*.json backend/
RUN npm ci -w backend

FROM deps AS build
WORKDIR /app
COPY backend backend
RUN npm run build -w backend

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ARG NPM_VERSION=11.11.1
RUN npm install -g npm@${NPM_VERSION}
COPY package*.json ./
COPY backend/package*.json backend/
RUN npm ci -w backend --omit=dev && npm cache clean --force
COPY --from=build /app/backend/dist backend/dist
COPY backend/scripts backend/scripts
COPY backend/migrations backend/migrations
RUN addgroup -S agentops && adduser -S -G agentops agentops \
  && mkdir -p /app/data /app/backend/data \
  && chown -R agentops:agentops /app/data /app/backend/data
USER agentops
EXPOSE 3333
CMD ["npm", "run", "start", "-w", "backend"]
