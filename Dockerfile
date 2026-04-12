FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Generate package-lock.json and install dependencies
RUN npm install --production

# Clean up dev dependencies
RUN npm prune --production

# Copy backend files
COPY server.js ./
COPY .env.example ./

# Create necessary directories
RUN mkdir -p uploads

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => { process.exit(1) })"

# Start the application
CMD ["npm", "start"]
