# Stage 1: Build production React assets
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package manifests for layer caching
COPY package*.json ./

# Install all dependencies (including devDependencies needed for vite build)
RUN npm ci

# Copy application source code and configuration
COPY index.html vite.config.js ./
COPY public/ ./public/
COPY src/ ./src/

# Compile production bundle into dist/
RUN npm run build

# Stage 2: Lightweight production NGINX web server
FROM nginx:alpine

# Remove default Nginx welcome page
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom NGINX configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose HTTP port
EXPOSE 80

# Run NGINX in foreground
CMD ["nginx", "-g", "daemon off;"]
