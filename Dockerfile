# Use Node.js alpine image
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY server.js ./
COPY public ./public

# Expose port 3000
EXPOSE 3000

# Start server
CMD [ "node", "server.js" ]
