FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY backend/package*.json backend/
RUN npm install -w backend

FROM deps AS build
WORKDIR /app
COPY backend backend
RUN npm run build -w backend

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package*.json ./
COPY --from=build /app/backend/package*.json backend/
COPY --from=build /app/backend/dist backend/dist
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/backend/node_modules backend/node_modules
EXPOSE 3333
CMD ["npm", "run", "start", "-w", "backend"]
