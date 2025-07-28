export interface Friend {
	id: number;
	userId: number;
	userName: string;
	status: string;
	email?: string;
	avatar?: string;
}
  
export interface FriendRequest {
	Id: number;
	senderId: number;
	receiverId: number;
	status: 'pending' | 'accepted' | 'rejected';
	senderName: string;
}
  
export interface UserStats {
	userId: number;
	playerName: string;
	avatar?: string;
	games_played: number;
	games_won: number;
	highest_score: number;
}

export interface UserSearchResult {
	id: number;
	userId: number;
	userName: string;
	email?: string;
	avatar?: string;
	isOnline?: boolean;
	isFriend: boolean;
}

// Interface pour la suppression d'amitié
export interface RemoveFriendPayload {
	userId: number;
	friendId: number;
}

export interface GameInvitationPayload {
	type: string;
	senderId: number;
	receiverId: number;
}
