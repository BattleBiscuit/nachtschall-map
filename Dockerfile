# Build stage
FROM node:20-slim AS builder

WORKDIR /usr/src/app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies for build)
RUN npm ci || npm install

# Copy source code
COPY . .

# Build the Vue app
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /usr/src/app

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm ci --omit=dev || npm install --production

# Copy built assets from builder
COPY --from=builder /usr/src/app/dist ./dist

# Copy server code
COPY server ./server

# Create uploads directory
RUN mkdir -p public/uploads/maps && \
    chmod 755 public/uploads/maps

EXPOSE 3000

CMD ["node", "server/server.js"]
