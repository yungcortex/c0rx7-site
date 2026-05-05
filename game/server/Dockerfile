FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist ./dist
EXPOSE 2567
CMD ["node", "dist/index.js"]
