FROM node:18

WORKDIR /app

RUN apt-get update && \
    apt-get install -y curl g++ make dumb-init libsqlite3-dev && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

COPY src/ ./src
COPY Includes/ ./Includes
COPY Makefile ./

# compiler C++ pour generer executable Game
RUN make

ENTRYPOINT ["/usr/bin/dumb-init", "--"]

CMD ["./Game"]