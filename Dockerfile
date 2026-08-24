FROM node:20-alpine AS base

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "src/index.js"]
