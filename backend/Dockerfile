FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (production only)
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose port (Railway uses PORT env var, defaults to 8080)
EXPOSE 8080

# Start application
CMD ["npm", "start"]
