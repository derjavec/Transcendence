FROM node:18

WORKDIR /app

RUN apt-get update && \
    apt-get install -y curl dumb-init && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Copier package.json et package-lock.json avant d'installer les dépendances
COPY package*.json ./

# Installer toutes les dépendances, y compris les devDependencies
RUN npm install --production=false

COPY src/ ./src
COPY tsconfig.json ./

ENTRYPOINT ["/usr/bin/dumb-init", "--"]

CMD ["npm", "run", "dev"]





