FROM node:18-alpine
WORKDIR /app
COPY bridge/package.json ./
RUN npm install --production
COPY bridge/ ./
EXPOSE 3000
CMD ["node", "index.js"]
