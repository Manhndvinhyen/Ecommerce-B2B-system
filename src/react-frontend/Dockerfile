FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --no-fund

CMD ["sh", "-c", "npm run build && npm run build -- --watch"]
