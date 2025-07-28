// servert.ts (matchmaking)
import WebSocket from 'ws';
// import sqlite3 from 'sqlite3';
// import { open } from 'sqlite';
import { randomUUID } from 'crypto';
import * as update from "./updatedDB"

const waitingPlayers: string[] = [];
// let gatewaySocket: WebSocket | null = null;  // une seule ref pour parler avec gateway

(async () => {
    await update.initDB();
    const socket = new WebSocket("ws://gateway-ws:4500/ws");

    socket.on('open', () => {
        console.log("🟢 Matchmaking Service connected to Gateway");
        socket.send(JSON.stringify({type: "registerService", service: "matchmaking"}));
    })

    socket.on('message', async (rawMessage) => {
        const message = JSON.parse(rawMessage.toString());

        if (message.type === 'INIT_SOLO') {
            const userId = message.userId;
            const matchId = randomUUID();
            const aiUserId = `AI-${matchId}`;

            //console.log(`✅ Solo match ${matchId} created for user ${userId} vs AI`);

            await update.NewSoloMatch(matchId, userId, aiUserId);

            if (socket.readyState === WebSocket.OPEN) {
                const messageToSend = {
                    type: "matchmaking:soloMatchReady",
                    matchId,
                    players: [
                        { userId: userId, side: "left" },
                        { userId: aiUserId, side: "right" }
                    ]
                };
                // console.log(`📤 Sending soloMatchReady to gateway:`, messageToSend);
                socket.send(JSON.stringify(messageToSend));
                console.log(`📤 Sent soloMatchReady to gateway`);
            } else {
                console.warn("⚠️ Gateway socket not ready, cannot send soloMatchReady");
            }
        }         

        if (message.type === 'JOIN_MATCH') {
            const userId = message.userId;
            //console.log(`🕹️ Player ${userId} joined queue`); //debug
            waitingPlayers.push(userId);

            if (waitingPlayers.length >= 2) {
                const [p1, p2] = waitingPlayers.splice(0, 2);
                const matchId = randomUUID();
                console.log(`✅ Match ${matchId} created: ${p1} vs ${p2}`);

                await update.NewMultiPlayerMatch(matchId, p1, p2);

                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({
                        type: "matchmaking:matchFound",
                        matchId,
                        players: [
                            { userId: p1, side: "left" },
                            { userId: p2, side: "right" }
                        ]
                        }));
                    // console.log(`📤 Sent matchFound to gateway`); //DEBUG
                } else {
                    console.warn("⚠️ Gateway socket not ready, cannot send matchFound");
                }
            }
        }

        if (message.type === 'GET_NAMES') {
            const { matchId } = message;
            try {
                const match = await update.getMatchById(matchId);
                if (!match) {
                    socket.send(JSON.stringify({ type: "matchmaking:playerNamesError", message: "Match not found" }));
                    return;
                }

                const player1Id = match.player1;
                const player2Id = match.player2;
        
                const rawName1 = player1Id.startsWith("AI")
                    ? "🤖 AI"
                    : await update.getUserName(player1Id);
        
                const rawName2 = player2Id.startsWith("AI")
                    ? "🤖 AI"
                    : await update.getUserName(player2Id);
                
                // fallback
                const player1Name = rawName1 === "Player" ? "Player1" : rawName1;
                const player2Name = rawName2 === "Player" ? "Player2" : rawName2;
        
                socket.send(JSON.stringify({
                    type: "matchmaking:playerNames",
                    matchId,
                    player1: player1Name,
                    player2: player2Name,
                    player1Id,
                    player2Id
                }));
        
                // console.log(`📤 Sent player names for match ${matchId}: ${player1Name} vs ${player2Name}`); //debug
            } catch (err) {
                console.error("❌ Failed to fetch player names:", err);
                socket.send(JSON.stringify({ type: "matchmaking:playerNamesError", message: "Internal error" }));
            }
        }

        if (message.type === 'GET_OPPONENT') {
            const userId = message.userId;
            try {
                const opponent = await update.getOpponent(userId);
        
                if (!opponent) {
                    socket.send(JSON.stringify({
                        type: "matchmaking:opponentError",
                        userId,
                        message: "No active match found"
                    }));
                    return;
                }
        
                socket.send(JSON.stringify({
                    type: "matchmaking:opponentId",
                    userId,
                    opponentId: opponent.id
                }));
        
                // console.log(`📤 Sent opponentId ${opponentId} for user ${userId}`); //DEBUG
            } catch (err) {
                console.error("❌ Failed to fetch opponent:", err);
                socket.send(JSON.stringify({
                    type: "matchmaking:opponentError",
                    userId,
                    message: "Internal error"
                }));
            }
        }

        if (message.type === "IS_FORFEIT") {
            const match = await update.getMatchStatus(message.matchId);

            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type: "matchmaking:forfeitStatus",
                    matchId: message.matchId,
                    isForfeit: match?.status === "forfeit"
                }));
            }
        }

        if (message.type === 'DISCONNECT') {
            const userId = message.userId;
            const index = waitingPlayers.indexOf(userId);
            if (index !== -1) {
                waitingPlayers.splice(index, 1);
                console.log(`🚪 Player ${userId} removed from matchmaking queue`);
                return;
            }

            const match = await update.getMatchByUserId(userId);
            if (!match) {
                // console.log(`🟡 No active match for user ${userId}, skipping disconnect`); //DEBUG
                return;
            }

            const opponent = await update.getOpponent(userId);
            if (!opponent) {
                console.warn(`⚠️ No opponent found for user ${userId}`);
                return;
            }

            await update.updateMatchStats(match.matchId, opponent.id, userId, 1, 0, "forfeit");
            console.log(`🏁 Match ${match.matchId} ended by disconnect. Winner: ${opponent.id}`);
        }

        if (message.type === 'END_MATCH') {
            const { matchId, winnerId, loserId, winnerScore, loserScore } = message;

            const match = await update.getMatchStatus(matchId);
            if (!match || match.status !== 'active') {
                console.log(`🟡 Match ${matchId} already completed or not found`);
                return;
            }

            await update.updateMatchStats(matchId, winnerId, loserId, winnerScore, loserScore, "completed");
            console.log(`🏁 Match ${matchId} ended normally. Winner: ${winnerId} (${winnerScore}-${loserScore})`);
        }
    });

})();

