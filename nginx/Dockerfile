FROM nginx:latest

# Etiquettes d'identification
LABEL author="pdeson <pdeson@student.42mulhouse.fr>"
LABEL description="Nginx (Reverse Proxy) for the Transcendence project"
LABEL version="2.0"

RUN apt-get update && apt-get install -y --no-install-recommends --no-install-suggests\
    curl nginx iputils-ping openssl dumb-init \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /app/shared

ARG CERT_FOLDER CERTIFICATE KEY COUNTRY STATE LOCALITY ORGANIZATION UNIT COMMON_NAME

# Creation des certificats autusignes et des repertoires necessaires au stockage
RUN mkdir -p ${CERT_FOLDER} && \
    openssl req -x509 -nodes \
    -keyout ${CERT_FOLDER}${KEY} \
    -out ${CERT_FOLDER}${CERTIFICATE} \
    -subj "/C=${COUNTRY}/ST=${STATE}/L=${LOCALITY}/O=${ORGANIZATION}/OU=${UNIT}/CN=${COMMON_NAME}"

COPY nginx.conf /etc/nginx/
COPY conf.d /etc/nginx/conf.d

EXPOSE 80 443

ENTRYPOINT [ "dumb-init", "--" ]

CMD ["/bin/sh", "-c", "echo '🚀 NGINX is starting... Reverse Proxy for Transcendence is running!' && nginx -g 'daemon off;'"]