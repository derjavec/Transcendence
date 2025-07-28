FROM node:latest

WORKDIR /app

COPY package*.json ./
# ci --only=production
RUN npm install bcrypt && \
	npm install validator && \
	npm install node-fetch && \
	apt-get update && apt-get install -y curl

COPY src/ ./src
COPY tsconfig.json ./

EXPOSE 4500

CMD ["npm", "run", "dev"]
