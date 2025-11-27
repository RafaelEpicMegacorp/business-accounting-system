FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy backend application code
COPY backend/ ./

# Expose port (Railway uses PORT env var)
EXPOSE 3001

# Start application in production mode
CMD ["npm", "start"]
