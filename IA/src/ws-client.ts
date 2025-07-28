// ws-client.ts (AI)

import WebSocket from 'ws';
import { AIBot } from './ai_bot';

const bots = new Map<string, { bot: AIBot, intervalId: NodeJS.Timeout }>();

async function connectToGateway(url: string): Promise<WebSocket> {
  return new Promise((resolve) => {
    let ws: WebSocket;

    const tryConnect = () => {
      ws = new WebSocket(url);

      ws.on('open', () => {
        console.log(`🟢 🤖 AI Service connected to ${url}`);
        ws.send(JSON.stringify({ type: 'registerService', service: 'AI' }));
        resolve(ws);
      });

      ws.on('error', () => {
        console.warn(`⏳ Gateway not ready for AI, retrying in 1s...`);
        setTimeout(tryConnect, 1000);
      });
    };

    tryConnect();
  });
}

(async () => {
  const socket = await connectToGateway("ws://gateway-ws:4500/ws");

  socket.on("message", (raw) => {
    try {
      const message = JSON.parse(raw.toString());
      handleIAMessage(message, socket);
    } catch (err) {
      console.error("Error parsing AI message:", err);
    }
  });

  socket.on("close", () => {
    console.warn("🔌 AI Gateway connection closed — stopping all bots");
    for (const [matchId, entry] of bots) {
      clearInterval(entry.intervalId);
      bots.delete(matchId);
    }
  });

  socket.on("error", (err) => {
    console.error("❌ AI WebSocket error:", err);
  });
})();

function handleIAMessage(message: any, ws: WebSocket) {
  const { type, matchId } = message;

  let entry = matchId ? bots.get(matchId) : null;

  switch (type) {
    case 'START':
      if (!entry) {
        const bot = new AIBot(
          message.ballSpeed,
          message.ballSize,
          message.paddleSize,
          matchId
        );
        const intervalId = setInterval(() => {
          if (bot.isGameOver) {
            clearInterval(intervalId);
            bots.delete(matchId);
            ws.send(JSON.stringify({
              type: 'disconnect',
              matchId
            }));
          } else {
            bot.tick();
            ws.send(JSON.stringify({
              type: 'game:paddleMove',
              side: 'right',
              position: bot.paddleY,
              matchId
            }));
          }
        }, 30);
        bots.set(matchId, { bot, intervalId });
        bot.start?.();
      } else {
        entry.bot.start?.();
      }
      break;

    case 'RESUME':
      if (entry) {
        entry.bot.resume(message.ballSpeed, message.ballSize, message.paddleSize);
      }
      break;

    case 'RESET':
      if (entry) {
        entry.bot.reset();
      }
      break;

    case 'game:state':
      if (entry) {
        entry.bot.updateState(message.payload);
      }
      break;

    case 'DISCONNECT':
      if (entry) {
        clearInterval(entry.intervalId);
        bots.delete(matchId);
      }
      break;

    default:
      if (message.type !== 'error')
        console.warn("❓ Unknown AI message:", message.type);
  }
}
