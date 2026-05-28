FROM node:22-alpine AS deps
WORKDIR /app
ARG NPM_VERSION=11.11.1
RUN npm install -g npm@${NPM_VERSION}
COPY package*.json ./
COPY frontend/package*.json frontend/
RUN npm ci -w frontend

FROM deps AS build
WORKDIR /app
ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY frontend frontend
RUN npm run build -w frontend

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 8080
