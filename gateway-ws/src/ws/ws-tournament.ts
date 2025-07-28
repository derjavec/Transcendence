//ws-tournament.ts (gateway)
import WebSocket from 'ws';

let tournamentSocket: WebSocket | null = null;

const pendingClients = new Map<string, WebSocket>();
const activeTournaments = new Map<string, any>();

//communication depuis FRONTEND
export function handleTournamentMessage(message: any, clientWs: WebSocket, userId: string) {
    pendingClients.set(userId, clientWs);
     if (!tournamentSocket || tournamentSocket.readyState !== WebSocket.OPEN) {
        console.warn('⚠️ tournament socket not ready, message not sent');
        return;
    }

    let payload: any;

    switch (message.type) {
        case 'tournament:create' :
            payload = { type: 'CREATE_TOURNAMENT',
                        userId,
                        name: message.name,
                        participants: message.participants };
            break;
        case 'tournament:join':
            payload = { type: 'JOIN_TOURNAMENT',
                        userId,
                        tournamentId: message.tournamentId };
            break;
        case 'tournament:list':
            payload = { type:'TOURNAMENT_LIST',
                        userId };
            break;
        case 'tournament:reportResult':
            payload = {
                type: 'REPORT_RESULT',
                tournamentId: message.tournamentId,
                player1Id: message.player1Id,
                player2Id: message.player2Id,
                winnerId: message.winnerId,
                round: message.round
            };
            break;
        case 'tournament:disconnect':
            payload = {
                type: 'REMOVE_FROM_TOURNAMENT',
                userId: message.userId,
            };
            break;
        default:
            console.warn(`🟡 Unknown tournament message type from frontend: ${message.type}`);
            return; 
    }

    tournamentSocket.send(JSON.stringify(payload));

}

export function setTournamentSocket(ws: WebSocket) {
    tournamentSocket = ws;

    ws.on("message", (raw: any) => {
        const message = JSON.parse(raw.toString());
        // let userClient: WebSocket | undefined;
        switch (message.type) {
            case 'tournament:created': 
                activeTournaments.set(message.name, { ...message, participantsList: message.participantList });

                let count = 1;
                for (const clientWs of pendingClients.values()) {
                    if (clientWs.readyState === WebSocket.OPEN) {
                        clientWs.send(JSON.stringify(message));
                    } else {
                        console.log(`Client #${count} is not open (state: ${clientWs.readyState})`);
                    }
                    count++;
                }
                break;

            case 'tournament:registered': {

                activeTournaments.set(message.name, {
                    ...message,
                    participantsList: message.participantsList
                });

                for (const [userId, clientWs] of pendingClients.entries()) {
                    if (clientWs.readyState === WebSocket.OPEN) {
                        clientWs.send(JSON.stringify({
                            ...message,
                            type: 'tournament:registered',
                        }));
                    }
                }

                break;
            }

            case 'tournament:matches_generated': {
               
                for (const [userId, clientWs] of pendingClients.entries()) {
                    if (clientWs.readyState === WebSocket.OPEN) {
                        clientWs.send(JSON.stringify(message));
                    } 
                }
            
                break;
            }
            
            case 'tournament:listed': {
                const response = JSON.stringify({
                    type: "tournament:listed",
                    tournaments: message.tournaments
                });
            
                
                for (const [userId, clientWs] of pendingClients.entries()) {
                    if (clientWs.readyState === WebSocket.OPEN) {
                        clientWs.send(response);
                    } 
                }
            
                break;
            }
            
            case 'tournament:exists': {
                const targetUserId = message.userId;
                const targetWs = pendingClients.get(targetUserId);
                if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                    targetWs.send(JSON.stringify({
                        type: 'tournament:exists',
                        message: message.message
                    }));
                }
                break;
            }
            case 'tournament:finished': {
                for (const [userId, clientWs] of pendingClients.entries()) {
                    if (clientWs.readyState === WebSocket.OPEN) {
                        clientWs.send(JSON.stringify({
                            ...message,
                            type: 'tournament:finished'
                        }));
                    }
                }
                break;
            }
            
            default:
                console.warn(`🟡 Unknown tournament message type from tournament service: ${message.type}`);
        }

    });

     ws.on("close", () => {
        console.warn("🔌 Tournament socket closed");
        tournamentSocket = null;
    });

    ws.on("error", (err: any) => {
        console.error("❌ Tournament WS error:", err);
    });
}

export function onClientDisconnect(userId: string) {
    pendingClients.delete(String(userId));
}