//server.ts (backend)
import fastify from "fastify";
import Websocket from '@fastify/websocket';
import rateLimit from "@fastify/rate-limit";

import wsHandler from "./ws/ws-handler"; // mettre la logique WebSocket dans un fichier a part/separer les roles
import { validationMiddleware } from "./middleware/validation-middleware"; 

const server = fastify({ logger: { level: 'error' } });

// Rate limiting
server.register(rateLimit, {
  max: 100, // max 100 requetes par IP
  timeWindow: '1 minute', // par minute
  keyGenerator: (request) => request.ip,
  errorResponseBuilder: (request, context) => {
    return {
      success: false,
      message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`
    };
  },
});

// WebSocket
server.register(Websocket, {
  options: {
    maxPayload: 1048576, // limite la taille des messages à 1 MB
  }
});
server.register(wsHandler);

/// Middleware de validation
server.addHook('preHandler', validationMiddleware);

const start = async () => {
  try {
    await server.listen({ port: 4500, host: "0.0.0.0" });
    console.log("🚀 Server ready at http://gateway-ws:4500");
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();