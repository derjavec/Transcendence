// Health.routes/ts

import { FastifyInstance } from "fastify";

export default async function HealthVerif(app: FastifyInstance) {
	
	// Route de santé pour le gateway lui-même
	app.get('/gateway', async (request, reply) => {
	  reply.send({ status: 'ok', service: 'gateway' });
	});
	
	// Route de santé pour le service frontend
	app.get('/front', async (request, reply) => {
	  try {
		const response = await fetch('http://frontend:3000/health/front');
		const data = await response.json();
		reply.send(data);
	  } catch (error) {
		reply.status(500).send({ status: 'error', message: 'Frontend service unreachable' });
	  }
	});
	
}