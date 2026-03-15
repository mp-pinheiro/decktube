FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG VITE_YOUTUBE_CLIENT_ID
ARG VITE_YOUTUBE_CLIENT_SECRET
ENV VITE_YOUTUBE_CLIENT_ID=$VITE_YOUTUBE_CLIENT_ID
ENV VITE_YOUTUBE_CLIENT_SECRET=$VITE_YOUTUBE_CLIENT_SECRET
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY server.js .
EXPOSE 3000
CMD ["npm", "start"]
