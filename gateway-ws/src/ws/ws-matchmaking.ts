// ws-matchmaking.ts
import WebSocket from 'ws';

let matchmakingSocket: WebSocket | null = null;

const pendingClients = new Map<string, WebSocket>();
const playerMatchMap = new Map<string, string>();

// communication depuis FRONTEND
export function handleMatchmakingMessage(message: any, clientWs: WebSocket, userId: string) {
     //console.log(`📩 handleMatchmakingMessage called for user ${userId} with type ${message.type}`);
   
    if (!matchmakingSocket || matchmakingSocket.readyState !== WebSocket.OPEN) {
        console.warn('⚠️ Matchmaking socket not ready, message not sent');
        return;
    }
    
    if (!pendingClients.has(String(userId))) {
     // console.log(`🧩 Setting pending client for user ${userId}`);
      pendingClients.set(String(userId), clientWs);
    }
    

    if (message.type === 'matchmaking:disconnect') {
        playerMatchMap.delete(String(userId));
    }

    const payload = { ...message, type: message.type.replace("matchmaking:", ""), userId };
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

// fonction fallback dans le cas ou frontend n'arrive pas a envoyer "DISCONNECT" lorsqu'on ferme la fenetre
export function onClientDisconnect(userId: string) {
    playerMatchMap.delete(String(userId));
    pendingClients.delete(String(userId));
    matchmakingSocket?.send(JSON.stringify({ type: "DISCONNECT", userId }));
  
}

export function setMatchmakingSocket(ws: WebSocket) {
  matchmakingSocket = ws;

  const MAX_RETRIES = 5;
  const RETRY_DELAY_MS = 100;

  async function waitForClientSocket(playerId: string): Promise<WebSocket | null> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const clientWs = pendingClients.get(playerId);
      if (clientWs && clientWs.readyState === WebSocket.OPEN) {
        return clientWs;
      }
      await new Promise((res) => setTimeout(res, RETRY_DELAY_MS));
    }
    return null;
  }

  ws.on("message", async (raw) => {
    const message = JSON.parse(raw.toString());
    const { type, matchId, players } = message;

    if (["matchmaking:matchFound", "matchmaking:soloMatchReady", "matchmaking:tournamentMatchReady"].includes(type)) {
      for (const player of players) {
        const playerId = String(player.userId);
        playerMatchMap.set(playerId, String(matchId));

        const clientWs = await waitForClientSocket(playerId);
        if (clientWs) {
          const opponent = players.find((p) => String(p.userId) !== playerId);
          const payload = {
            type: 'matchmaking:matchFound',
            matchId,
            side: player.side,
            userId: player.userId,
            opponentId: opponent?.userId || null
          };

          clientWs.send(JSON.stringify(payload));
          pendingClients.delete(playerId);
        } else {
          // console.warn(`❌ Could not retrieve WS for userId=${playerId} after ${MAX_RETRIES} attempts`); // DEBUG

          const fallbackClient = pendingClients.get(playerId);
          if (fallbackClient && fallbackClient.readyState === WebSocket.OPEN) {
            fallbackClient.send(JSON.stringify({
              type: 'matchmaking:connectionError',
              userId: playerId,
              message: 'No se pudo establecer la conexión WebSocket para el torneo.'
            }));
            fallbackClient.close(4000, "Connection failed during matchmaking");
          }

          pendingClients.delete(playerId);
          playerMatchMap.delete(playerId);
        }
      }

      return;
    }

    if (["matchmaking:playerNames", "matchmaking:playerNamesError", "matchmaking:opponentId", "matchmaking:opponentError"].includes(type)) {
      for (const [userId, clientWs] of pendingClients.entries()) {
        if ((String(userId) === message.player1Id || String(userId) === message.player2Id) && clientWs && clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify(message));
        }
      }
      return;
    }

    if (type === "matchmaking:forfeitStatus") {
      pendingClients.forEach((clientWs, userId) => {
        if (playerMatchMap.get(String(userId)) === String(matchId) && clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify(message));
        }
      });
      return;
    }

    console.warn(`⚠️ Unknown message from matchmaking: ${type}`, message);
  });

  ws.on("close", () => {
    console.warn("🔌 Matchmaking socket closed");
    matchmakingSocket = null;
  });

  ws.on("error", (err) => {
    console.error("❌ Matchmaking WS error:", err);
  });
}


// communication depuis MATCHMAKING
// export function setMatchmakingSocket(ws: WebSocket) {
//   matchmakingSocket = ws;

//   ws.on("message", (raw) => {
//     const message = JSON.parse(raw.toString());
//     const { type, matchId, players } = message;

//     if (["matchmaking:matchFound", "matchmaking:soloMatchReady", "matchmaking:tournamentMatchReady"].includes(type)) {
//      // console.log("📦 pendingClients current content:", Array.from(pendingClients.keys()));

//       players.forEach((player) => {
//         const playerId = String(player.userId);
//       //  console.log(`🔍 Getting pending client for user ${playerId}`);
//         const clientWs = pendingClients.get(playerId);
//        // console.log(`👉 Result of get for ${playerId}:`, clientWs);
//         playerMatchMap.set(playerId, String(matchId));
    
//         if (clientWs && clientWs.readyState === WebSocket.OPEN) {
//           const opponent = players.find((p) => String(p.userId) !== playerId);
//           const payload = {
//             type: 'matchmaking:matchFound',
//             matchId,
//             side: player.side,
//             userId: player.userId,
//             opponentId: opponent?.userId || null
//           };

//           clientWs.send(JSON.stringify(payload));
    
//           pendingClients.delete(playerId);
//         } else {console.warn(`⚠️ No WS for userId=${playerId}`);}
//       });
    
//       return;
//     }
    

//     if (["matchmaking:playerNames", "matchmaking:playerNamesError",
//             "matchmaking:opponentId", "matchmaking:opponentError"].includes(type)) {
//         for (const [userId, clientWs] of pendingClients.entries()) {
//             if ((String(userId) === message.player1Id || String(userId) === message.player2Id) && clientWs && clientWs.readyState === WebSocket.OPEN) {
//                 clientWs.send(JSON.stringify(message));
//                 }
//             }
//         return;
//     }

//     if (type === "matchmaking:forfeitStatus") {
//       pendingClients.forEach((clientWs, userId) => {
//         if (playerMatchMap.get(String(userId)) === String(matchId) && clientWs.readyState === WebSocket.OPEN) {
//           clientWs.send(JSON.stringify(message));
//         }
//       });
//       return;
//     }

//     console.warn(`⚠️ Unknown message from matchmaking: ${type}`, message);
//   });

//   ws.on("close", () => {
//     console.warn("🔌 Matchmaking socket closed");
//     matchmakingSocket = null;
//   });

//   ws.on("error", (err) => {
//     console.error("❌ Matchmaking WS error:", err);
//   });
// }


