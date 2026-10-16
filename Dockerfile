# Multi-stage production build for Shakham Attendance Dashboard
FROM node:20-alpine AS build

WORKDIR /app

# Cache package dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build production assets
COPY . .
RUN npm run build

# Stage 2: High-performance Nginx server
FROM nginx:alpine

# Copy custom nginx configuration for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose web server port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
