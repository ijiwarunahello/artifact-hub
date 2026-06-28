FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx tsc && npm run build
ENV ARTIFACT_HUB_HOST=0.0.0.0
EXPOSE 27183
CMD ["node", "dist/server.js"]
