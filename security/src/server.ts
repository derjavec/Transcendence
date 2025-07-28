// (security) server.ts
import dotenv from 'dotenv';
dotenv.config();

import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import authRoute from './auth.routes';

const fastify = Fastify({
  logger: { level: 'error' }
});

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error("❌ JWT_SECRET is not defined in environment variables");
}
// console.log("✅ JWT_SECRET loaded:", jwtSecret);

fastify.register(fastifyJwt, {
  secret: jwtSecret,
  sign: {
    expiresIn: '15m', // Token expiration time
  },
  verify: { algorithms: ['HS256'] }, // Specify the algorithm used for signing
});

fastify.addContentTypeParser('text/plain', { parseAs: 'string' }, (req, body, done) => {
  try {
    // Si le corps est un JSON sous forme de texte, le parser
    done(null, JSON.parse(body));
  } catch (err) {
    // Si ce n'est pas du JSON, retourner le texte brut
    done(null, body);
  }
});

fastify.decorate("authenticate", async (request, reply) => {
  try {
    // Verify the standard JWT token
    await request.jwtVerify();

    // Initialize the blacklist
    await tokenBlacklist.initialize();

    // Check if the token is blacklisted
    const { jti } = request.user;
    await request.jwtVerify();
    console.log("Decoded JWT payload:", request.user);
    if (!jti) {
      return reply.status(401).send({ error: "Token does not contain JTI" });
    }

    const isBlacklisted = await tokenBlacklist.isBlacklisted(jti);
    if (isBlacklisted) {
      return reply.status(401).send({ error: "Token is revoked" });
    }

    // Invalidate all tokens when the user changes his password
    const { userId } = request.user.sub;
    const currentUserSecurityVersion = request.user.secVer || 0;

    // Fetch the user from the user management service
    // and check if the security version is up to date
    const userService = await fetch(`http://gateway-api:4000/api/users/${userId}`);
    if (userService.ok) {
      const { SecurityVersion } = await userService.json();
      if (SecurityVersion > currentUserSecurityVersion) {
        return reply.status(401).send({ error: "Token is outdated" });
      }
    }
  } catch (err) {
    reply.code(401).send({error: "Unauthorized", details: err.message});
  }
});

fastify.register(authRoute);

const start = async () => {
  try {
    await fastify.listen({ port: 4003, host: '0.0.0.0' });
    console.log('🔐 Security Service running on http://security:4003');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
