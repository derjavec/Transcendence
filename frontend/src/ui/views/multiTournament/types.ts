//types.ts

export interface Participant {
  userId: number;
  name?: string;
}

export interface Match {
	id: number;
	tournamentId: number;
	round: number;
	player1Id: number;
	player2Id: number | null;
	winnerId: number | null;
}

export interface MatchesMessage {
	type: string;
	tournamentName: string;
	round: number;
	matches: Match[];
	byePlayer: { userId: number } | null;
}
