// Health.routes/ts
// Verification des connexions entre dockers sur API REST & WebSocket

import { FastifyInstance } from "fastify";

export default async function HealthVerif(app: FastifyInstance) {
	
	// Route de santé pour le gateway lui-même
	app.get('/gateway', async (request, reply) => {
	  reply.send({ status: 'ok', service: 'gateway' });
	});
	
}