FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN apk add --no-cache curl && npm install
RUN npm install ws

COPY src/ ./src
COPY public/ ./public
COPY tsconfig.json ./
COPY tailwind.config.js ./

RUN npm run build --verbose

RUN mkdir -p /app/shared && cp -r dist/* /app/shared/
RUN cp -r public/* /app/shared/

RUN npm install -g serve

CMD ["serve", "-s", "/app/shared", "-l", "3000"]