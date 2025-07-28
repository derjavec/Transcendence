FROM alpine:latest

RUN apk add --no-cache sqlite

WORKDIR /app/shared

# ?
COPY ./tools/ /app/

RUN chmod +x /app/check-db.sh

# Entrypoint pour vérifier et initialiser la base de données
CMD ["/app/check-db.sh"]
