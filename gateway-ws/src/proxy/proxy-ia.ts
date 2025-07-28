// proxy-ia.ts
import net from "net";
import * as Game from "../ws/ws-game"
import * as Match from "../ws/ws-matchmaking"

const userTcpSocketsGame = new Map<string, net.Socket>();
const userTcpSocketsIA = new Map<string, net.Socket>();

export async function handleIAMessage(message: any, oponentId: string) {
    const aiUserId = await Match.getOpponentId(oponentId);
    const iaSocket = getOrCreateClientSocketIA(aiUserId, message.matchId);

  switch (message.type) {
    case "IA:START":   
      if (!aiUserId || typeof aiUserId !== 'string') {
        throw new Error("Invalid aiUserId received");
      }    
      iaSocket.write(`IA:START ${message.matchId} ${message.ballSpeed} ${message.paddleSpeed} ${message.paddleSize} ${message.ballSize} ${message.width} ${message.height}\n`);
      break;
    case "IA:RESUME":
      iaSocket.write(`IA:RESUME ${message.matchId} ${message.ballSpeed} ${message.paddleSpeed} ${message.paddleSize} ${message.ballSize} ${message.width} ${message.height}\n`);
      break;
    case "IA:RESET":
      iaSocket.write(`IA:RESET ${message.matchId} ${message.ballSpeed} ${message.paddleSpeed} ${message.paddleSize} ${message.ballSize} ${message.width} ${message.height}\n`);
      break;
    case "IA:RESIZE":
      iaSocket.write(`IA:RESIZE ${message.matchId} ${message.width} ${message.height}\n`);
      break;
    default:
      console.warn("🟡 Unknown IA message:", message.type);
  }
}


export function getOrCreateClientSocketIA(aiUserId: string, matchId: string): net.Socket {
  let socket = userTcpSocketsIA.get(aiUserId);
  if (socket && !socket.destroyed) return socket;

  socket = new net.Socket();
  socket.setMaxListeners(100);
  socket.connect(4005, 'ia_bot', () => {
    console.log(`🔌 Connected to IA server for aiUserId ${aiUserId}`);
  });

  let bufferAccum = '';

  socket.on("data", (chunk) => {
    bufferAccum += chunk.toString();

    const parts = bufferAccum.split('\n');
    bufferAccum = parts.pop() || '';

    for (const raw of parts) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      try {
        const message = JSON.parse(trimmed);
        if (message?.type?.startsWith("game:")) {
          Game.handleGameMessage(message, socket!, aiUserId);
        }
        else {
          console.warn(`⚠️ Mensaje JSON con tipo no reconocido: ${trimmed}`);
        }
      } catch (err) {
        console.warn(`❌ Error al parsear mensaje de IA como JSON para aiUserId ${aiUserId}: ${trimmed}`);
      }
    }
  });

  socket.on("error", (err) => {
    console.error("❌ TCP error in IA communication:", err.message);
    socket?.destroy();
    userTcpSocketsIA.delete(aiUserId);
  });

  userTcpSocketsIA.set(aiUserId, socket);
  return socket;
}

export function destroyUserSocket(aiUserId: string) {
  const gameSocket = userTcpSocketsGame.get(aiUserId);
  if (gameSocket && !gameSocket.destroyed) gameSocket.destroy();
  const iaSocket = userTcpSocketsIA.get(aiUserId);
  if (iaSocket && !iaSocket.destroyed) iaSocket.destroy();
  
  userTcpSocketsGame.delete(aiUserId);
  userTcpSocketsIA.delete(aiUserId);
}
