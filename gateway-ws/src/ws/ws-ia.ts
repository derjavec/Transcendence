// ws-ia.ts

import WebSocket from 'ws';
import * as Game from "./ws-game";

let iaSocket: WebSocket | null = null;

const matchBots = new Map<string, Set<string>>(); // matchId -> [aiUserId]
const pendingBots = new Map<string, WebSocket>(); // aiUserId -> ws

export function handleIAMessage(message: any, clientWs: WebSocket, aiUserId: string) {
  if (!iaSocket || iaSocket.readyState !== WebSocket.OPEN) {
    console.warn('⚠️ AI service not connected');
    return;
  }

  const matchId = message.matchId;
  if (matchId) {
    if (!matchBots.has(matchId)) {
      matchBots.set(matchId, new Set());
    }
    matchBots.get(matchId)!.add(aiUserId);
  }

  pendingBots.set(aiUserId, clientWs);

  const payload = { ...message, type: message.type.replace('AI:', ''), userId: aiUserId };
//   console.log("sending to AI ", payload); // DEBUG
  iaSocket.send(JSON.stringify(payload));
}

export function setAISocket(ws: WebSocket) {
  iaSocket = ws;

  ws.on('message', (raw) => {
    const message = JSON.parse(raw.toString());
    const matchId = message.matchId || message.payload?.matchId;
    // console.log("to be sent to client from AI: ", message); // DEBUG

    if (message.type?.startsWith('game:')) {
      const aiUserId = `AI-${matchId}`;
      Game.handleGameMessage(message, iaSocket!, aiUserId);
      return;
    }

    if (message.type === 'disconnect') {
        const bots = matchBots.get(matchId) || new Set();
        bots.forEach(aiUserId => {
        pendingBots.delete(aiUserId);
        });
        matchBots.delete(matchId);
        return;
    }

    if (matchId) {
      const bots = matchBots.get(matchId) || new Set();
      bots.forEach(aiUserId => {
        const botWs = pendingBots.get(aiUserId);
        if (botWs && botWs.readyState === WebSocket.OPEN) {
          botWs.send(JSON.stringify(message));
        } else {
          console.warn(`⚠️ No active AI WS for aiUserId=${aiUserId}`);
        }
      });
    } else {
      console.warn(`⚠️ Missing matchId in AI response:`, message);
    }
  });

  ws.on('close', () => {
    console.warn('🔌 AI WS closed');
    iaSocket = null;
  });

  ws.on('error', (err) => {
    console.error('❌ AI WS error:', err);
  });
}
