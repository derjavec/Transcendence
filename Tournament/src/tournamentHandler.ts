//tournamentHandler.ts
import * as update from "./updateDB";

export async function handleCreateTournament(message: any, socket: WebSocket) {
    const {name, participants, userId} = message;
    console.log("message ", message);
    if (!name || !participants || !userId) {
        console.warn("❌ Tournament creation failed: missing data.");
        return;
    }

    try {
        const exists = await update.hasActiveTournament();
        if (exists) {
            console.warn("Tournament already active.");

            socket.send(JSON.stringify({
            type: 'tournament:exists',
            message: 'Un tournoi est déjà en cours.'
        }));
            return;
        }

        const creatorName = await update.getUserNameById(userId);

        const tournamentId = await update.createTournament(name, userId, participants);
        console.log(`✅ Tournoi créé: "${name}" par ${userId} (${participants} joueurs)`);

        await update.registerUserToTournament(userId, tournamentId); // enregistrer le createur automatiquement
        const participantList = await update.getParticipantsForTournament(tournamentId);

        socket.send(JSON.stringify({
            type: "tournament:created",
            id: tournamentId,
            name,
            participants,
            userId,
            creatorName,
            participantList,
            status: "waiting"
        }));
    } catch(error) {
       console.error("❌ Failed to create tournament in DB:", error);
    }
}

export async function handleRegisterTournament(message: any, socket: WebSocket) {
   // console.log("handleRegisterTournament called with message:", message);
    
    const tournamentId = Number(message.tournamentId);
    const userId = Number(message.userId);
    if (!tournamentId || !userId) {
        console.warn("Registration for tournament failed: missing data", tournamentId," " ,userId);
        return;
    }

    try {
        const tournament = await update.getTournamentById(tournamentId);
        if (!tournament) {
            console.warn("tournament not found");
            return;
        }

        const currentCount = await update.getRegistrationCount(tournament.id);
        if(currentCount >= tournament.participants) {
           console.warn("tournament is full");
            return;
        }

        await update.registerUserToTournament(userId, tournament.id);
        const participantsList = await update.getParticipantsForTournament(tournament.id); // eviter d'appeler les fonctions dans le send
        const creatorName = await update.getUserNameById(tournament.creatorId);

        socket.send(JSON.stringify({
            type: "tournament:registered",
            userId,
            tournamentId,
            tournamentName: tournament.tournamentName,
            participants: tournament.participants,
            creatorName,
            participantsList,
            status: tournament.status,
            success: true
        }));
        if (currentCount + 1 === tournament.participants) {
            await handlePairingTournament({ tournamentName: tournament.tournamentName }, socket);
        }
    } catch (error) {
        console.error("Error registering user to tournament:", error);
    }
}

//appariement

export async function handlePairingTournament(message:any, socket:WebSocket) {
    const { tournamentName, round = 1 } = message;
    if(!tournamentName) {
       console.warn("pairing error");
        return;
    }
   // console.log("🚀 Starting handlePairingTournament for round", round);

    try{

        const tournament = await update.getActiveTournamentByName(tournamentName);
        if(!tournament) {
           console.warn("tournamentName not found");
            return;
        }

        let participants;
            participants = await update.getParticipantsForTournament(tournament.id);
        if(!participants || participants.length === 0) {
           console.warn("error pairing");
            return;
        }
        if (participants.length === 1){
            const winner = participants[0];
            await update.finishTournament(tournament.id, winner.userId);
            await update.setTournamentStatus(tournament.id, "finished");
            socket.send(JSON.stringify({
                type: "tournament:finished",
                tournamentName,
                winnerId: winner.userId,
            }));
            return ;
        }
        participants = participants.sort(() => Math.random() - 0.5);

        let byePlayer = null;

        if (participants.length % 2 === 1) {
            const previousByeId = await update.getByePlayerInRound(tournament.id, round - 1);

            const candidates = previousByeId
                ? participants.filter(p => p.userId !== previousByeId)
                : participants;

            const byeCandidate = candidates[Math.floor(Math.random() * candidates.length)];

            participants = participants.filter(p => p.userId !== byeCandidate.userId);
            byePlayer = byeCandidate;

            await update.createMatch({
                tournamentId: tournament.id,
                round,
                player1Id: byePlayer.userId,
                player2Id: null,
                winnerId: byePlayer.userId,
            });
        }


        for(let i = 0; i < participants.length; i +=2) {
            const player1 = participants[i];
            const player2 = participants[i + 1];

            await update.createMatch({
                tournamentId: tournament.id,
                round,
                player1Id: player1.userId,
                player2Id: player2.userId,
                winnerId: null,
            });
        }

        const matches = await update.getMatchesForRound(tournament.id, round);
        if (tournament.status === "waiting") {
	        await update.setTournamentStatus(tournament.id, "running");}

        socket.send(JSON.stringify({
            type: "tournament:matches_generated",
            tournamentName,
            round,
            matches,
            byePlayer,
            status: "running"
        }));
        
    }catch(error) {
        console.error("Error generating pairings:", error);
    }
}

//list tournoi
export async function handleListTournament(message: any, socket: WebSocket) {
    try {
      const tournament = await update.getActiveTournament();
  
      if (!tournament) {
        socket.send(JSON.stringify({
          type: "tournament:listed",
          userId: message.userId,
          tournaments: []
        }));
        return;
      }
  
      const creatorName = await update.getUserNameById(tournament.creatorId);
      const participantList = await update.getParticipantsForTournament(tournament.id);
  
      const enrichedTournament = {
        ...tournament,
        creatorName,
        participantList
      };

      socket.send(JSON.stringify({
        type: "tournament:listed",
        userId: message.userId,
        tournaments: [enrichedTournament]
      }));  
    } catch (error) {
      console.error("Error fetching tournament list:", error);
    }
  }
  

export async function handleReportResult(message: any, socket: WebSocket) {
    const { tournamentId, player1Id, player2Id, winnerId, round, } = message;
    if (!tournamentId || !player1Id || !player2Id || !winnerId || !round ) {
        console.warn("Incomplete data for result report:", message);
        return;
    }

    try {
        const result = await update.setMatchWinner(Number(tournamentId), Number(round), Number(player1Id), Number(player2Id), Number(winnerId));
        const pendingMatches = await update.getMatchesWithoutWinner(tournamentId, round);
        if (pendingMatches.length === 0) {
            const tournament = await update.getTournamentById(Number(tournamentId));
            if (!tournament) {
                console.warn("Tournament not found while generating next round");
                return;
            }
            await handlePairingTournament(
                {
                    tournamentName: tournament.tournamentName,
                    round: Number(round) + 1,
                },
                socket
            );
        } 
    } catch (error) {
        console.error("Error in handleReportResult:", error);
        socket.send(JSON.stringify({
            type: "error",
            message: "Error processing result",
        }));
    }
}

export async function handleRemoveFromTournament(message: any, socket: WebSocket) {
	const userId = Number(message.userId);
	if (!userId) return;
	const activeTournament = await update.getActiveTournamentForUser(userId);
	if (!activeTournament) return;

	await update.removeUserFromTournament(userId, activeTournament.id);

	const updatedList = await update.getParticipantsForTournament(activeTournament.id);
	const creatorName = await update.getUserNameById(activeTournament.creatorId);

	if (updatedList.length === 0) {
		await update.deactivateTournament(activeTournament.id);
	}

	const updatedTournamentPayload = {
		type: "tournament:listed",
		tournaments: [{
			id: activeTournament.id,
			tournamentName: activeTournament.tournamentName,
			creatorName,
			participants: activeTournament.participants,
			participantList: updatedList,
		}]
	};

	socket.send(JSON.stringify(updatedTournamentPayload));
}






