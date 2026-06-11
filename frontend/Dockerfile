FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_COLLECTOR_URL=http://localhost:8001
ENV VITE_COLLECTOR_URL=$VITE_COLLECTOR_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
