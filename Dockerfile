# Use Node.js alpine image
FROM node:22-alpine

# Set environment variables
ENV NODE_ENV=production

# Create app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source files
COPY server.js ./
COPY public ./public

# Create data directory and set permissions
RUN mkdir -p data && chown -R node:node /usr/src/app

# Switch to non-root user
USER node

# Expose port 3000
EXPOSE 3000

# Start server
CMD [ "node", "server.js" ]
