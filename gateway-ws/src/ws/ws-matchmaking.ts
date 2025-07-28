// ws-matchmaking.ts
import WebSocket from 'ws';

let matchmakingSocket: WebSocket | null = null;
const pendingClients = new Map<string, WebSocket>();
const playerMatchMap = new Map<string, string>();

// communication depuis FRONTEND
export function handleMatchmakingMessage(message: any, clientWs: WebSocket, userId: string) {
    pendingClients.set(userId, clientWs);

    if (!matchmakingSocket || matchmakingSocket.readyState !== WebSocket.OPEN) {
        console.warn('⚠️ Matchmaking socket not ready, message not sent');
        return;
    }

    let payload: any;

    switch (message.type) {
        case 'matchmaking:join':
            payload = { type: 'JOIN_MATCH', userId };
            break;
        case 'matchmaking:createSoloMatch':
            payload = { type: 'INIT_SOLO', userId };
            break;
        case 'matchmaking:disconnect':
            payload = { type: 'DISCONNECT', userId };
            playerMatchMap.delete(userId);
            break;
        case 'matchmaking:getPlayerNames':
            payload = { type: 'GET_NAMES', matchId: message.matchId };
            break;
        case 'matchmaking:gameOver':
            payload = {
                type: 'END_MATCH',
                matchId: message.matchId,
                winnerId: message.winnerId,
                loserId: message.loserId,
                winnerScore: message.winnerScore,
                loserScore: message.loserScore
            };
            playerMatchMap.delete(message.winnerId);
            playerMatchMap.delete(message.loserId);
            break;
        case "matchmaking:isForfeit":
            payload = {
                type: "IS_FORFEIT",
                matchId: message.matchId
            };
            break;
        default:
            console.warn(`🟡 Unknown matchmaking message type from frontend: ${message.type}`);
            return;
    }

    matchmakingSocket.send(JSON.stringify(payload));
}

// fonction pour IA bot
export function getOpponentId(userId: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const handler = (msg: any) => {
            const message = JSON.parse(msg);
            if (message.type === 'matchmaking:opponentId' && message.userId === userId) {
                matchmakingSocket?.off('message', handler);
                resolve(message.opponentId);
            }
            if (message.type === 'matchmaking:opponentError' && message.userId === userId) {
                matchmakingSocket?.off('message', handler);
                reject(new Error(message.message));
            }
        };
        matchmakingSocket?.on('message', handler);
        matchmakingSocket?.send(JSON.stringify({ type: 'GET_OPPONENT', userId }));
    });
}

// communication depuis MATCHMAKING
export function setMatchmakingSocket(ws: WebSocket) {
    matchmakingSocket = ws;
    ws.on('message', (raw) => {
        const message = JSON.parse(raw.toString());

        if (message.type === 'matchmaking:matchFound' || message.type === 'matchmaking:soloMatchReady') {
            const { matchId, players } = message;

            for (const player of players) {
                const clientWs = pendingClients.get(player.userId);
                playerMatchMap.set(player.userId, matchId);

                if (clientWs && clientWs.readyState === WebSocket.OPEN) {
                    const opponent = players.find(p => p.userId !== player.userId);
                    const messageToSend = {
                        type: 'matchmaking:matchFound',
                        matchId,
                        side: player.side,
                        userId: player.userId,
                        opponentId: opponent?.userId || null
                    };
                    clientWs.send(JSON.stringify(messageToSend));
                } else {
                    console.warn(`⚠️ Client ${player.userId} not found or socket closed`); // Debug
                }
                pendingClients.delete(player.userId);
            }
        }

        if (message.type === 'matchmaking:playerNames' || message.type === 'matchmaking:playerNamesError') {

            for (const [userId, clientWs] of pendingClients.entries()) {
                if ((String(userId) === message.player1Id || String(userId) === message.player2Id) && clientWs && clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(JSON.stringify(message));
                    }
                }
        }
        
        if (message.type === 'matchmaking:opponentId' || message.type === 'matchmaking:opponentError') {
            for (const [userId, clientWs] of pendingClients.entries()) {
                if (clientWs && clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(JSON.stringify(message));
                }
            }
        }
        if (message.type === "matchmaking:forfeitStatus") {
            const allSockets = Array.from(pendingClients.entries());

            for (const [userId, clientWs] of allSockets) {
                if (playerMatchMap.get(userId) === message.matchId) {
                    const forfeitMsg = JSON.stringify({
                        type: "matchmaking:forfeitStatus",
                        matchId: message.matchId,
                        isForfeit: message.isForfeit,
                    });
                    clientWs.send(forfeitMsg);
                }
            }
        }
    });

    ws.on('close', () => {
        console.warn('Matchmaking WS closed...');
        matchmakingSocket = null;
    });
    ws.on('error', (err) => {});
}
