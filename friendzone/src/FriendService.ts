import { 
	Friend,
	FriendRequest, 
	UserStats, 
	UserSearchResult
} from "./types/models";
import path from 'path';

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export class FriendService {
	// Singleton pour la gestion des amis
	private db: any;
	private initialized: boolean;

	constructor() {
		this.db = null;
		this.initialized = false;
	}

  	async initialize() {
    	if (this.initialized) return;

		try {
		// Ouvrir la connexion à SQLite
		this.db = await open({
			filename: path.join('/app/shared', 'database.db'),
			driver: sqlite3.Database
		});
		
		this.initialized = true;
		} catch (error) {
		console.error('Erreur lors de l\'ouverture de la base de données SQLite:', error);
		throw error;
		}
	}

	// Recherche des utilisateurs par nom d'utilisateur ou email
	async searchUsers(query: string, currentUserId: number): Promise<UserSearchResult[]> {
		await this.initialize();

		try {
			// Limiter la longueur de la reqête pour éviter les attaques
			if (query.length > 100) {
				throw new Error('La requête de recherche est trop longue.');
			}
			
			// Requête SQL pour rechercher les utilisateurs par nom d'utilisateur ou email
			const searchTerm = `%${query}%`;
			const users: UserSearchResult[] = await this.db.all(
				`SELECT userId, name, profile_picture, email \
				FROM users WHERE (userId != ? AND (name LIKE ? OR email LIKE ?))`, 
				 [currentUserId, searchTerm, searchTerm]
			);

			// Vérifier si des utilisateurs ont été trouvés
			if (!users || users.length === 0) {
				return [];
			}

			// Récupérer toutes les amitiés de l'utilisateur actuel
			const friendships = await this.db.all(
				`SELECT senderId, receiverId, status \
				FROM friend_requests \
				WHERE (senderId = ? OR receiverId = ?)`, 
				[currentUserId, currentUserId]
			);

			// Déterminer le statut d'amitié pour chaque utilisateur
			const usersWithFriendshipStatus: UserSearchResult[] = users.map((user: UserSearchResult) => {
				let friendshipStatus: 'not friend' | 'friend' | 'pending_sent' | 'pending_received';

				// Recherche si une amitié existe entre les utilisateurs
				const friendship = friendships.find(
					(f: any) => (f.senderId === currentUserId && f.receiverId === user.userId) ||
								(f.receiverId === currentUserId && f.senderId === user.userId)
				);

				if (friendship) {
					if (friendship.status === 'accepted') {
						friendshipStatus = 'friend';
					} else if (friendship.status === 'pending') {
						friendshipStatus = friendship.senderId === currentUserId ? 'pending_sent' : 'pending_received';
					}
				}
				return {
					Id: user.userId,
					userId: user.userId,
					userName: user.name,
					email: user.email,
					avatar: user.profile_picture,
					isFriend: friendshipStatus === 'friend',
					isOnline: false // Placeholder, à remplacer par la logique de vérification de la connexion
				};
			});

			return usersWithFriendshipStatus;
		} catch (error) {
			console.error('Erreur lors de la recherche d\'utilisateurs:', error);
			throw error;
		}
	};

	// Envoyer une demande d'ami
	async sendFriendRequest(senderId: number, receiverId: number): Promise<{ id: number }> {
		await this.initialize();

		try {
			// Vérifier si l'expéditeur et le destinataire sont différents
			if (senderId === receiverId) {
				throw new Error('Vous ne pouvez pas vous envoyer une demande d\'ami.');
			}

			// Vérifier si les utilisateurs existent
			const sender = await this.getUserById(senderId);

			const receiver = await this.getUserById(receiverId);

			if (!sender || !receiver) {
			throw new Error('Un ou plusieurs utilisateurs n\'existent pas.');
			}

			// Vérifier si la demande d'ami existe déjà
			const existingRequest = await this.db.get(
				'SELECT * FROM friend_requests WHERE (senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?)',
				[senderId, receiverId, receiverId, senderId]
			);
			if (existingRequest) {
				if (existingRequest.status === 'accepted') {
					throw new Error('Vous êtes déjà amis avec cet utilisateur.');
				}
				if (existingRequest.status === 'pending') {
					if (existingRequest.senderId === senderId) {
						throw new Error('Vous avez déjà envoyé une demande d\'ami à cet utilisateur.');
					} else {
						throw new Error('Cet utilisateur vous a déjà envoyé une demande d\'ami.');
					}
				} else if (existingRequest.status === 'rejected') {
					throw new Error('Votre relation mutuelle a ete blacklistee !.');
				}
			}

			// Insérer la demande d'ami dans la base de données
			const result = await this.db.run(
				'INSERT INTO friend_requests (senderId, receiverId, status) VALUES (?, ?, ?)',
				[senderId, receiverId, 'pending']
			);
			return { id: result.lastID };
		} catch (error) {
			console.error('Erreur lors de l\'envoi de la demande d\'ami:', error);
			throw error;
		}
	}

	// Accepter une demande d'ami
	async acceptFriendRequest(requestId: number) {
		await this.initialize();

		try {
			// Mettre à jour le statut de la demande d'ami dans la base de données
			const result = await this.db.run(
				'UPDATE friend_requests SET status = ? WHERE Id = ?',
				['accepted', requestId]
			);
			return result;
		} catch (error) {
			console.error('Erreur lors de l\'acceptation de la demande d\'ami:', error);
			throw error;
		}
	}

	// Rejeter une demande d'ami
	async rejectFriendRequest(requestId: number) {
		await this.initialize();

		try {
			// Mettre à jour le statut de la demande d'ami dans la base de données
			const result = await this.db.run(
				`UPDATE friend_requests SET status = ?, updated_at = CURRENT_TIMESTAMP
				WHERE Id = ?`,
				['rejected', requestId]
			);
			return result;
		} catch (error) {
			console.error('Erreur lors du rejet de la demande d\'ami:', error);
			throw error;
		}
	}

	// Supprimer un ami
	async removeFriend(userId: number, friendId: number) {
		await this.initialize();

		try {
			console.log('Suppression de l\'amitie entre :', userId, friendId);
			// Verifier si l'utilisateur et l'ami existent
			const existingFriendship = await this.db.get(
				`SELECT * FROM friend_requests 
				WHERE ((senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?))
				AND status = 'accepted'`,
				[userId, friendId, friendId, userId]
			);

			if (!existingFriendship) {
				throw new Error('Cette amitié n\'existe pas.');
			}
			
			// Vérifier si l'utilisateur qui fait la demande est l'expéditeur ou le destinataire
			if (existingFriendship.senderId !== userId && existingFriendship.receiverId !== userId) {
				throw new Error('Vous ne pouvez pas supprimer cet ami.');
			}

			console.log('Amitié existante trouvée:', existingFriendship);

			// Supprimer la relation d'ami dans la base de données
			const result = await this.db.run(
				`DELETE FROM friend_requests
				WHERE id = ?`,
				[existingFriendship.Id]
			);
			return result;
		} catch (error) {
			console.error('Erreur lors de la suppression de l\'ami:', error);
			throw error;
		}
	}

	// Calculer les statistiques d'un utilisateur
	async getUserStats(userId: number): Promise<UserStats> {
		await this.initialize();
		try {
			// Obtenir les statistiques de l'utilisateur
			const stats = await this.db.get(
				`SELECT us.userId, us.games_played, us.games_won, us.highest_score, u.name as playerName, u.profile_picture as avatar
				FROM user_stats us 
				JOIN users u ON us.userId = u.userId
				WHERE us.userId = ?`,
				[userId]
			);
			if (!stats) {
				return null;
			}
			return stats as UserStats;
		} catch (error) {
			console.error('Erreur lors de la récupération des statistiques de l\'utilisateur:', error);
			throw error;
		}
	}
	
	// Obtenir la liste des utilisateurs connectés
	async getConnectedUsers(): Promise<UserSearchResult[]> {
		await this.initialize();
		try {
			// Obtenir la liste des utilisateurs connectés avec leurs informations complètes
			const users = await this.db.all(`
				SELECT 
					u.userId, 
					u.name as userName, 
					u.email, 
					u.profile_picture as avatar, 
					pc.status as isOnline 
				FROM player_connection pc
				JOIN users u ON pc.userId = u.userId
				WHERE pc.status = ?`, 
				[1]
			);
			
			// Formater le résultat pour correspondre à UserSearchResult
			return users.map(user => ({
				Id: user.userId,
				userId: user.userId,
				userName: user.userName,
				email: user.email,
				avatar: user.avatar,
				isFriend: user.isFriend || false,
				isOnline: true
			}));
		} catch (error) {
			console.error('Erreur lors de la récupération des utilisateurs connectés:', error);
			throw error;
		}
	}	

	// Obtenir la liste des amis
	async getFriends(userId: number): Promise<UserSearchResult[]> {
		await this.initialize();

		try {
			// Obtenir la liste des amis de l'utilisateur
			const friends = await this.db.all(
				`SELECT fr.id, 
					CASE 
						WHEN fr.senderId = ? THEN receiver.name 
						ELSE sender.name 
					END AS name, 
					CASE 
						WHEN fr.senderId = ? THEN receiver.userId 
						ELSE sender.userId 
					END AS friendId, 
					CASE 
						WHEN fr.senderId = ? THEN receiver.profile_picture 
						ELSE sender.profile_picture 
					END AS avatar, 
					CASE 
						WHEN fr.senderId = ? THEN receiver.email 
						ELSE sender.email 
					END AS email,
					CASE 
						WHEN fr.senderId = ? THEN pc_receiver.status
						ELSE pc_sender.status
					END AS isOnline
				FROM friend_requests fr 
				JOIN users sender ON fr.senderId = sender.userId 
				JOIN users receiver ON fr.receiverId = receiver.userId 
				LEFT JOIN player_connection pc_sender ON sender.userId = pc_sender.userId
				LEFT JOIN player_connection pc_receiver ON receiver.userId = pc_receiver.userId
				WHERE ((senderId = ? OR receiverId = ?) AND fr.status = ?)`,
				[userId, userId, userId, userId, userId, userId, userId, 'accepted']
			);
			
			// Formater la liste des amis
			const formattedFriends = friends.map((friend: Friend) => {
				return {
					Id: friend.id,
					userId: friend.friendId,
					userName: friend.name,
					email: friend.email,
					avatar: friend.avatar,
					isFriend: true,
					isOnline: friend.isOnline === 1
				};
			});
			return formattedFriends;
		} catch (error) {
			console.error('Erreur lors de la récupération des amis:', error);
			throw error;
		}
	}

	// Obtenir les demandes d'ami
	async getFriendRequests(userId: number): Promise<FriendRequest[]> {
		await this.initialize();

		try {
			// Obtenir les demandes d'ami pour l'utilisateur
			const requests = await this.db.all(
				`SELECT fr.id as Id, fr.senderId, fr.receiverId, fr.status, u.name as senderName 
				FROM friend_requests fr 
				JOIN users u ON fr.senderId = u.userId 
				WHERE fr.receiverId = ? AND fr.status = ?`,
				[userId, 'pending']
			);

			return requests as FriendRequest[];
		} catch (error) {
			console.error('Erreur lors de la récupération des demandes d\'ami:', error);
			throw error;
		}
	}
	
	// Obtenir les utilisateurs
	async getUsers(): Promise<User[]> {
		await this.initialize();

		try {
			// Obtenir tous les utilisateurs
			const users = await this.db.all('SELECT * FROM users');
			return users as User[];
		} catch (error) {
			console.error('Erreur lors de la récupération des utilisateurs:', error);
			throw error;
		}
	}

	// Obtenir un utilisateur par ID
	async getUserById(userId: number): Promise<User | null> {
		await this.initialize();

		try {
			// Obtenir un utilisateur par ID
			const user = await this.db.get('SELECT * FROM users WHERE userId = ?', [userId]);
			return user as User | null;
		} catch (error) {
			console.error('Erreur lors de la récupération de l\'utilisateur:', error);
			throw error;
		}
	}

	// Obtenir un utilisateur par email
	async getUserByEmail(email: string) {
		await this.initialize();

		try {
			// Obtenir un utilisateur par email
			const user = await this.db.get('SELECT * FROM users WHERE email = ?', [email]);
			return user;
		} catch (error) {
			console.error('Erreur lors de la récupération de l\'utilisateur:', error);
			throw error;
		}
	}

	// Obtenir un utilisateur par nom d'utilisateur
	async getUserByUsername(username: string) {
		await this.initialize();

		try {
			// Obtenir un utilisateur par nom d'utilisateur
			const user = await this.db.get('SELECT * FROM users WHERE username = ?', [username]);
			return user;
		} catch (error) {
			console.error('Erreur lors de la récupération de l\'utilisateur:', error);
			throw error;
		}
	}

	// Vérifier si un utilisateur est ami avec un autre utilisateur
	async isFriend(userId: number, friendId: number) {
		await this.initialize();

		try {
			// Vérifier si l'utilisateur est ami avec un autre utilisateur
			const friend = await this.db.get(
				'SELECT * FROM friend_requests WHERE (senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?)',
				[userId, friendId, friendId, userId]
			);
			return !!friend;
		} catch (error) {
			console.error('Erreur lors de la vérification de l\'ami:', error);
			throw error;
		}
	}

	// Vérifier si une demande d'ami existe
	async isFriendRequestExists(senderId: number, receiverId: number) {	
		await this.initialize();

		try {
			// Vérifier si une demande d'ami existe
			const request = await this.db.get(
				'SELECT * FROM friend_requests WHERE (senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?)',
				[senderId, receiverId, receiverId, senderId]
			);
			return !!request;
		} catch (error) {
			console.error('Erreur lors de la vérification de la demande d\'ami:', error);
			throw error;
		}
	}

	// Vérifier si un utilisateur est connecté
	async isUserConnected(userId: number) {
		await this.initialize();

		try {
			// Vérifier si un utilisateur est connecté
			const user = await this.db.get('SELECT * FROM users WHERE id = ? AND connected = ?', [userId, 1]);
			return !!user;
		} catch (error) {
			console.error('Erreur lors de la vérification de l\'utilisateur connecté:', error);
			throw error;
		}
	}

	// Supprime les demandes d'ami expirées
	async cleanupRejectedRequests(): Promise<{ deleted: number}> {
		await this.initialize();

		try {
			// Calcule la date d'expiration (24h)
			const oneDayAgo = new Date();
			oneDayAgo.setHours(oneDayAgo.getHours() - 24);

			// Format de date pour SQLite
			const formattedDate = oneDayAgo.toISOString().slice(0, 19).replace('T', ' ');

			// Supprimer les demandes d'ami expirées
			const result = await this.db.run(
				`DELETE FROM friend_requests 
				WHERE status = 'rejected' AND updated_at < ?`,
				[formattedDate]
			);

			// console.log('Demandes d\'ami expirées supprimées:', result.changes);
			return { deleted: result.changes };
		} catch (error) {
			console.error('Erreur lors de la suppression des demandes d\'ami expirées:', error);
			throw error;
		}
	}
};