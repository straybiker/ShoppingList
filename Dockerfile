# Stage 1: Build React Client
FROM node:22-alpine AS client_build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Production Server
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /usr/src/app

# Copy server dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy server code
COPY server.js ./

# Copy built client from Stage 1 to public/
COPY --from=client_build /app/client/dist ./public

# Create data directory and set permissions
RUN mkdir -p data && chown -R node:node /usr/src/app

# Switch to non-root user
USER node

# Expose port 3000
EXPOSE 3000

# Start server
CMD [ "node", "server.js" ]
