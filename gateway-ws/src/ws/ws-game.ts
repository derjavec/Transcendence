//ws-game.ts
import net from "net";
import WebSocket from "ws";

// userId → TCP socket pour parler a Game
const gameSockets = new Map<string, net.Socket>();

// userId → WebSocket pour reponses a Frontend et IA
const clientSockets = new Map<string, WebSocket | net.Socket>();

// communication depuis FRONTEND
export function handleGameMessage(message: any, ws: WebSocket | net.Socket, userId: string) {
  const client = getOrCreateClientSocket(userId, ws, message.matchId);
    switch (message.type) {
      case "game:start":
        client.write(`START  ${message.ballSpeed} ${message.paddleSpeed} ${message.paddleSize} ${message.ballSize} ${message.width} ${message.height}\n`);
        break;

      case "game:paddleMove":
        client.write(`UPDATE_PADDLE ${message.side} ${message.position}\n`);
        break;

      case "game:resume":
        client.write(`RESUME  ${message.ballSpeed} ${message.paddleSpeed} ${message.paddleSize} ${message.ballSize} ${message.width} ${message.height}\n`);
        break;

      case "game:getState":
        clientSockets.set(userId, ws);
        client.write("GET_STATE\n");
        break;
      case "game:disconnect":
        console.log(`🔌 Disconnecting user ${userId}`);
        destroyUserSocket(userId);
        break;

      default:
        console.warn("🟡 Unknown game message:", message.type);
    }
  };

//   const gameStateTiming = new Map<
//   string,
//   {
//     lastReceiveTime: number; // timestamp en ms
//     sumIntervals: number;    // suma de intervalos en ms
//     countIntervals: number;  // cantidad de intervalos
//     lastPrintTime: number;   // último momento en ms que imprimimos
//   }
// >();

export function getOrCreateClientSocket(userId: string, ws: WebSocket | net.Socket, matchId: string): net.Socket {
  let socket = gameSockets.get(userId);
  if (socket && !socket.destroyed) 
    return socket;

  socket = new net.Socket();
  socket.setMaxListeners(100);
  socket.connect(4002, 'game', () => {
    console.log(`🔌 Connected to game server for user ${userId}`);
  });

  let buffer = "";

  //  gameStateTiming.set(userId, {
  //   lastReceiveTime: 0,
  //   sumIntervals: 0,
  //   countIntervals: 0,
  //   lastPrintTime: 0,
  // });

  socket.on("data", (chunk) => {
    buffer += chunk.toString();

    let index;
    while ((index = buffer.indexOf("\n")) >= 0) {
      const message = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);

      if (!message.startsWith("GAME_STATE:"))
        continue;

      //const now = Date.now();
     // const timing = gameStateTiming.get(userId);
      // if (timing) {
      //   if (timing.lastReceiveTime !== 0) {
      //     const interval = now - timing.lastReceiveTime;
      //     timing.sumIntervals += interval;
      //     timing.countIntervals++;
      //   }
      //   timing.lastReceiveTime = now;

      //   if (timing.lastPrintTime === 0) {
      //     timing.lastPrintTime = now;
      //   }

      //   if ((now - timing.lastPrintTime) >= 2000 && timing.countIntervals > 0) {
      //     const avgInterval = timing.sumIntervals / timing.countIntervals;
      //    // console.log(`⏱️ User ${userId} avg GAME_STATE interval: ${avgInterval.toFixed(2)} ms`);
      //     timing.sumIntervals = 0;
      //     timing.countIntervals = 0;
      //     timing.lastPrintTime = now;
      //   }
      // }

      const userWs = clientSockets.get(userId);

      if (userWs instanceof WebSocket) {
        try {
          const payload = parseGameState(message);
          if (payload) {
            userWs.send(JSON.stringify({ type: "game:state", payload }));
          }
        } catch (err) {}
      } else if (userWs instanceof net.Socket) {
        userWs.write(message + '\n');
      }
    }
  });

  socket.on("error", (err) => {
    console.error("❌ TCP error:", err.message);
    socket?.destroy();
    gameSockets.delete(userId);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "game:error", message: "TCP socket error" }));
    }
  });

  gameSockets.set(userId, socket);
  socket.write(`SET_USER ${userId} ${matchId}\n`);

  return socket;
}


export function destroyUserSocket(userId: string) {
  const sock = gameSockets.get(userId);
  if (sock && !sock.destroyed) sock.destroy();
  gameSockets.delete(userId);
  clientSockets.delete(userId);
 // gameStateTiming.delete(userId);
}

function parseGameState(msg: string) {
	const prefix = "GAME_STATE:";
	if (!msg.startsWith(prefix)) {
		return null;
	}

	const parts = msg.slice(prefix.length).split(":");

	if (parts.length !== 11) {
		return null;
	}

	const [
		ballX, ballY, dx, dy,
		leftY, rightY,
		leftScore, rightScore,
		isPausedStr,
		isGameOverStr,
		gameId
	] = parts;

	const isPaused = Number(isPausedStr) === 1;
	const isGameOver = Number(isGameOverStr) === 1;

	return {
		ball: { x: Number(ballX), y: Number(ballY), dx: Number(dx), dy: Number(dy) },
		paddles: { leftY: Number(leftY), rightY: Number(rightY) },
		score: { left: Number(leftScore), right: Number(rightScore) },
		isPaused,
		isGameOver,
		gameId
	};
}