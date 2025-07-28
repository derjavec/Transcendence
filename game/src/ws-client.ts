// ws-client.ts game
import WebSocket from 'ws';
import { Game } from './Game';

const games = new Map<string, { game: Game, intervalId: NodeJS.Timeout }>();

async function connectToGateway(url: string): Promise<WebSocket> {
  return new Promise((resolve) => {
    let ws: WebSocket;

    const tryConnect = () => {
      ws = new WebSocket(url);

      ws.on('open', () => {
        console.log(`🟢 Game Service connected to ${url}`);
        ws.send(JSON.stringify({ type: 'registerService', service: 'game' }));
        resolve(ws);
      });

      ws.on('error', () => {
        console.warn(`⏳ Gateway not ready for game, retrying in 1s...`);
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
      handleGameMessage(message, socket);
    } catch (err) {
      console.error("Error parsing message:", err);
    }
  });

  socket.on("close", () => {
    console.warn("🔌 WS to Gateway closed — stopping all games");
    for (const [matchId, entry] of games) {
      clearInterval(entry.intervalId);
      games.delete(matchId);
    }
  });

  socket.on("error", (err) => {
    console.error("❌ Game WebSocket error:", err);
  });
})();

function handleGameMessage(message: any, ws: WebSocket) {
  const { type, matchId } = message;

  let entry = matchId ? games.get(matchId) : null;

  switch (type) {
    case 'start':
      if (!entry) {
        const game = new Game(
          message.ballSpeed,
          message.ballSize,
          message.paddleSize,
          matchId,
        );
        const intervalId = setInterval(() => {
          game.update();
          const state = game.getState();
          ws.send(JSON.stringify({
            type: 'game:state',
            payload: state,
            matchId
          }));

          if (state.isGameOver) {
            console.log('🏁 Game', matchId, 'is over. Cleaning.');
            clearInterval(intervalId);
            games.delete(matchId);
          }
        }, 16);
        games.set(matchId, { game, intervalId });
      }
      break;

    case 'resume':
      if (entry) {
        entry.game.resume(message.ballSpeed, message.ballSize, message.paddleSize);
      }
      break;

    case 'paddleMove':
      if (entry && !entry.game.isPaused && !entry.game.isGameOver) {
        entry.game.updatePaddle(message.side, message.position);
      }
      break;

    case 'disconnect':
      if (entry) {
        clearInterval(entry.intervalId);
        games.delete(matchId);
      }
      break;

    default:
      if (message.type !== 'error')
        console.warn("❓ Unknown message type:", message.type);
  }
}
