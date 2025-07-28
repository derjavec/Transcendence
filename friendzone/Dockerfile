FROM node:latest

WORKDIR /app

EXPOSE 4006

# Copier package.json et package-lock.json avant d'installer les dépendances
COPY package*.json ./

RUN apt-get update && apt-get install -y curl sqlite3 && \
    npm install sqlite sqlite3 --production=false

# Copier tout le reste du code dans le conteneur
COPY src/ ./src
COPY tsconfig.json ./

# Lancer en mode développement avec ts-node-dev
CMD ["npm", "run", "dev"]
