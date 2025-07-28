FROM node:latest

WORKDIR /app

RUN apt-get update && apt-get install -y sqlite3 curl

# Copier package.json et package-lock.json avant d'installer les dépendances
COPY package*.json ./

# Installer toutes les dépendances, y compris les devDependencies
RUN npm install --production=false

# Copier tout le reste du code dans le conteneur
COPY src/ ./src
COPY tsconfig.json ./

# Lancer en mode développement avec ts-node-dev
CMD ["npm", "run", "dev"]
