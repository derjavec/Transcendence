import { openDb } from './db';
import { FastifyInstance } from 'fastify';

export default async function (app: FastifyInstance) {
	app.post('/:userId/offline' , async (request, reply) => {
		try {
			const userId = Number(request.params.userId);

			if (isNaN(userId)) {
				console.log('Invalid userId for offline:', request.params.userId);
				return reply.status(400).send({ error: 'Invalid userId' });
			}

			const db = await openDb();
			const now = new Date().toISOString();
			const result = await db.run('UPDATE player_connection SET status = 0, last_seen = ? WHERE userId = ?', [now, userId]);
			if (result.changes === 0) {
				console.log('User not found for offline:', userId);
				return reply.status(404).send({ error: 'User not found' });
			}
			reply.status(200).send({ message: 'User set offline successfully' });
		} catch (error) {
			console.error('Error setting user offline:', error);
			reply.status(500).send({ error: 'Error setting user offline' });
		}
	});

	app.post('/:userId/online' , async (request, reply) => {
		try {
			const userId = Number(request.params.userId);

			if (isNaN(userId)) {
				console.log('Invalid userId for online:', request.params.userId);
				return reply.status(400).send({ error: 'Invalid userId' });
			}

			const db = await openDb();
			const now = new Date().toISOString();
			const result = await db.run('UPDATE player_connection SET status = 1, last_seen = ? WHERE userId = ?', [now, userId]);
			if (result.changes === 0) {
				console.log('User not found for online:', userId);
				return reply.status(404).send({ error: 'User not found' });
			}
			reply.status(200).send({ message: 'User set online successfully' });
		} catch (error) {
			console.error('Error setting user online:', error);
			reply.status(500).send({ error: 'Error setting user online' });
		}
	});

	app.get('/isonline/:userId', async (request, reply) => {
		try {
			const userId = Number(request.params.userId);

			if (isNaN(userId)) {
				console.log('Invalid userId for status:', request.params.userId);
				return reply.status(400).send({ error: 'Invalid userId' });
			}

			const db = await openDb();
			const result = await db.get('SELECT status FROM player_connection WHERE userId = ?', [userId]);
			if (!result) {
				console.log('User not found for status:', userId);
				return reply.status(404).send({ error: 'User not found' });
			}
			reply.status(200).send({ status: result.status });
		} catch (error) {
			console.error('Error getting user status:', error);
			reply.status(500).send({ error: 'Error getting user status' });
		}
	});
}
