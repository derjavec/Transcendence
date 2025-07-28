//server.ts (gateway-api)
import fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import fastifyCompress from "@fastify/compress";

import proxyAuthRoutes from "./routes/api.routes";
import HealthVerif from "./routes/Health.routes";
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

// Compression des requetes
server.register(fastifyCompress, { global: true });

// routes
server.register(proxyAuthRoutes, { prefix: "/api" });
server.register(HealthVerif, { prefix: "/health" });

//  preHandler = middleware: controle d'acces s'execute avant tout
server.addHook('preHandler', validationMiddleware);

const start = async () => {
  try {
    await server.listen({ port: 4000, host: "0.0.0.0" });
    console.log("🚀 Server ready at http://gateway-api:4000");
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
