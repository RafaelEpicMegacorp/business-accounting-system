FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose port (Railway uses PORT env var)
EXPOSE 3001

# Start application in production mode
CMD ["npm", "start"]
