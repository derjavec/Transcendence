import Fastify from 'fastify';
import { FriendService } from './FriendService';
import { UserSearchResult } from '../types/models';

const app = Fastify({
  logger: { level: 'error' }
});
const friendService = new FriendService();

// Endpoint de santé
app.get('/health', async (request, reply) => {
	reply.code(200).send({ status: 'ok', message: 'FriendZone is healthy' });
});

// Rechercher des utilisateurs
app.post('/findusers', async (request, reply) => {
	
	try {
		// Vérification des paramètres de la requête
		const { q, userId } = request.body as { q: string, userId: number };
		console.log(`Received request to search users: query=${q}, userId=${userId}`);
		if (!q || !userId) {
			return reply.code(400).send({ error: 'Missing required parameters' });
		}
		const results = await friendService.searchUsers(q, userId);

		// Typage du resultat sous forme de UserSearchResult[]
		const formattedResults: UserSearchResult[] = results.map((user) => ({
			id: user.id,
			userId: user.userId,
			userName: user.userName,
			email: user.email,
			avatar: user.avatar,
			isOnline: user.isOnline || 'offline',
			isFriend: user.isFriend,
		}));

		reply.code(200).send(formattedResults);
	} catch (error) {
		console.error('Erreur lors de la recherche d\'utilisateurs:', error);
		reply.code(500).send({ error: 'Erreur lors de la recherche d\'utilisateurs' });
	}
});

// Envoie d'une demande d'ami
app.post('/request', async (request, reply) => {
	const { senderId, receiverId } = request.body as { senderId: number, receiverId: number };
	try {
		const result = await friendService.sendFriendRequest(senderId, receiverId);
		reply.status(200).send(result);
	} catch (error) {
		console.error('Erreur lors de l\'envoi de la demande d\'ami:', error);
		reply.status(500).send({ error: 'Erreur lors de l\'envoi de la demande d\'ami' });
	}
});


// Accepter une demande d'ami
app.post('/request/:requestId/accept', async (request, reply) => {
	const requestId = parseInt(request.params.requestId, 10);
	try {
		const result = await friendService.acceptFriendRequest(requestId);
		reply.status(200).send(result);
	} catch (error) {
		console.error('Erreur lors de l\'acceptation de la demande d\'ami:', error);
		reply.status(500).send({ error: 'Erreur lors de l\'acceptation de la demande d\'ami' });
	}
});

// Rejeter une demande d'ami
app.post('/request/:requestId/reject', async (request, reply) => {
	const requestId = parseInt(request.params.requestId, 10);
	try {
		const result = await friendService.rejectFriendRequest(requestId);
		reply.status(200).send(result);
	} catch (error) {
		console.error('Erreur lors du rejet de la demande d\'ami:', error);
		reply.status(500).send({ error: 'Erreur lors du rejet de la demande d\'ami' });
	}
});

// Supprimer un ami
app.delete('/remove', async (request, reply) => {
	try {
		const { userId, friendId } = request.body as { userId: number, friendId: number };

		if (isNaN(userId) || isNaN(friendId)) {
            return reply.status(400).send({ error: 'ID utilisateur ou ami invalide' });
        }

		const result = await friendService.removeFriend(userId, friendId);
		reply.status(200).send(result);
	} catch (error) {
		console.error('Erreur lors de la suppression de l\'ami:', error);
		reply.status(500).send({ error: 'Erreur lors de la suppression de l\'ami' });
	}
});

// Obtenir les statistiques d'un utilisateur
app.get('/stats/:userId', async (request, reply) => {
	try {
		const userId = Number(request.params.userId);
		const stats = await friendService.getUserStats(userId);
		
		// Si aucune statistique n'est trouvée, retourner des statistiques par défaut
		if (!stats || Object.keys(stats).length === 0) {
			const defaultStats = {
				userId: userId,
				playerName: 'New Player',
				games_played: 0,
				games_won: 0,
				highest_score: 0,
			};
			return reply.status(200).send(defaultStats);
		}
		
		reply.status(200).send(stats);
	} catch (error) {
		console.error('Erreur lors de la récupération des statistiques de l\'utilisateur:', error);
		reply.status(500).send({ error: 'Erreur lors de la récupération des statistiques de l\'utilisateur' });
	}
});

// Obtenir la liste des amis
app.get('/search/:userId', async (request, reply) => {
	try {
		const userId = Number(request.params.userId);
		if (isNaN(userId)) {
			return reply.status(400).send({ error: 'Invalid userId' });
		}

		const friends = await friendService.getFriends(userId);

		reply.send(friends);
	} catch (error) {
		console.error('Erreur lors de la récupération de la liste des amis:', error);
		reply.status(500).send({ error: 'Erreur lors de la récupération de la liste des amis' });
	}
});

// Obtenir les demandes d'ami
app.get('/pending/:userId', async (request, reply) => {
	try {
		const userId = Number(request.params.userId);
		if (isNaN(userId)) {
			return reply.status(400).send({ error: 'Invalid userId' });
		}

		const requests = await friendService.getFriendRequests(userId);

		// Debug pour voir les données retournées
		// console.log("Friend requests returned from service:", requests); //DEBUG 

		reply.send(requests);
	} catch (error) {
		console.error('Erreur lors de la récupération des demandes d\'ami:', error);
		reply.status(500).send({ error: 'Erreur lors de la récupération des demandes d\'ami' });
	}
});

// Obtenir la liste des utilisateurs connectés
app.get('/connected', async (request, reply) => {
	// const { userId } = request.query as { userId: number };
	try {
		const users = await friendService.getConnectedUsers();
		reply.status(200).send(users);
	} catch (error) {
		console.error('Erreur lors de la récupération des utilisateurs connectés:', error);
		reply.status(500).send({ error: 'Erreur lors de la récupération des utilisateurs connectés' });
	}
});

// Démarrer le serveur
const start = async () => {
	try {
		await app.listen({ port: 4006, host: '0.0.0.0' });
		console.log('🔐 Security Service running on http://friendzone:4006');

    // Lancer le nettoyage des demandes d'ami rejetees
		await cleanupRejectedRequests();

		// Lancer un cron job pour nettoyer les demandes d'ami rejetées
		setupPeriodicCleanup();
	} catch (err) {

		app.log.error(err);
		process.exit(1);
	}
};

// Fonction pour nettoyer les demandes rejetées
async function cleanupRejectedRequests() {
  try {
    const result = await friendService.cleanupRejectedRequests();
    // console.log(`Nettoyage initial: ${result.deleted} demandes d'amis rejetées ont été supprimées`);
  } catch (error) {
    console.error('Erreur lors du nettoyage des demandes rejetées:', error);
  }
}

// Configuration du nettoyage périodique
function setupPeriodicCleanup() {
  // Nettoyage toutes les 6 heures
  const ONE_HOUR = 60 * 60 * 1000;
  
  setInterval(async () => {
    try {
      const result = await friendService.cleanupRejectedRequests();
    //   console.log(`Nettoyage périodique: ${result.deleted} demandes d'amis rejetées ont été supprimées`);
    } catch (error) {
      console.error('Erreur lors du nettoyage périodique des demandes rejetées:', error);
    }
  }, ONE_HOUR);
  
//   console.log('Nettoyage périodique des demandes rejetées configuré (intervalle: 1 heure)');
}

start();