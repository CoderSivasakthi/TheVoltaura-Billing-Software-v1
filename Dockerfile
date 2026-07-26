FROM node:18-alpine

WORKDIR /app

# copy package files first for better caching
COPY package.json package-lock.json* ./

RUN npm ci --production || true

COPY . .

EXPOSE 8080

CMD ["node", "server.js"]
