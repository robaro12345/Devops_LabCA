# Production lightweight Node.js container
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Set default port
ENV PORT=5000

# Copy package manifests first for efficient Docker layer caching
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy application source code
COPY src/ ./src/

# Change ownership to non-root node user
RUN chown -R node:node /app

# Switch to non-privileged user for security
USER node

# Expose backend service port
EXPOSE 5000

# Start Express server via npm start
CMD ["npm", "start"]
