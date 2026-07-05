FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN apk add --no-cache python3 make g++ \
  && npm install --omit=dev

COPY . .

EXPOSE 8080

CMD ["npm", "start"]
