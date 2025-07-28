// ws-game.ts (gateway)
import WebSocket from 'ws';

let gameSocket: WebSocket | null = null;

const matchPlayers = new Map<string, Set<string>>(); // matchId -> [userId]
const pendingClients = new Map<string, WebSocket>(); // userId -> ws

export function handleGameMessage(message: any, clientWs: WebSocket, userId: string) {
  if (!gameSocket || gameSocket.readyState !== WebSocket.OPEN) {
    console.warn('⚠️ Game service not connected');
    return;
  }

  const matchId = message.matchId;

  if (matchId) {
    if (!matchPlayers.has(matchId)) {
      matchPlayers.set(matchId, new Set());
    }
    matchPlayers.get(matchId)!.add(userId);
  }

  pendingClients.set(String(userId), clientWs);

  if (message.type === 'game:disconnect') {
    pendingClients.delete(userId);
    if (matchId) {
      matchPlayers.get(matchId)?.delete(userId);
    } else {
      console.warn(`⚠️ GAME DISCONNECTED`); //DEBUG
      for (const [id, players] of matchPlayers) {
        if (players.has(userId)) {
          message.matchId = id;
          matchPlayers.get(id)?.delete(userId);
          break;
        }
      }
    }
  }

  const payload = { ...message, type: message.type.replace('game:', ''), userId: userId };
  // console.log("sending to game ", payload); // DEBUG
  gameSocket.send(JSON.stringify(payload));
}

// fonction fallback dans le cas ou frontend n'arrive pas a envoyer "DISCONNECT" lorsqu'on ferme la fenetre
export function onClientDisconnect(userId: string) {
  pendingClients.delete(userId);
  for (const [matchId, players] of matchPlayers.entries()) {
    if (players.has(userId)) {
      players.delete(userId);
      handleGameMessage({ type: 'game:disconnect', matchId }, null, userId);
    }
  }
}

export function setGameSocket(ws: WebSocket) {
  gameSocket = ws;

  ws.on('message', (raw) => {
    const message = JSON.parse(raw.toString());
    // console.log("to be sent to client: ", message); // DEBUG

    const matchId = message.payload?.gameId || message.matchId;
    if (matchId) {
      const players = matchPlayers.get(matchId) || new Set();
      players.forEach(userId => {
        const playerWs = pendingClients.get(String(userId));
        if (playerWs && playerWs.readyState === WebSocket.OPEN) {
          playerWs.send(JSON.stringify(message));
        } else {
          console.warn(`⚠️ No active client WS for userId=${userId}`, message);
        }
      });
    } else {
      console.warn(`⚠️ Missing matchId in response:`, message);
    }
  });

  ws.on('close', () => {
    console.warn('🔌 Game WS closed');
    gameSocket = null;
  });

  ws.on('error', (err) => {
    console.error('❌ Game WS error:', err);
  });
}
