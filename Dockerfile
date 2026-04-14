FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm install --production

# Copy application files
COPY server.js ./
COPY .env.example .env

# Copy frontend files
COPY index.html ./
COPY style.css ./
COPY script.js ./
COPY orb.js ./

# Create necessary directories
RUN mkdir -p uploads public

# Expose port
EXPOSE 3000

# Health check using correct API endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => { process.exit(1) })"

# Start the application
CMD ["node", "server.js"]
