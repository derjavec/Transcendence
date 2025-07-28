//ws-handler.ts
import { FastifyInstance } from "fastify";
import { SocketStream } from "@fastify/websocket";
import { IncomingMessage } from "http";
import * as Auth from "./ws-auth"; 
import * as Game from "./ws-game";
// import * as IA from "../proxy/proxy-ia";
import * as AI from "./ws-ia";
import * as Matchmaking from "./ws-matchmaking";
import * as Tournament from "./ws-tournament";

const activeConnections = new Map(); // pour stocker le nombre de WS par IP

export default async function wsHandler(server: FastifyInstance) {
  server.get("/ws", { websocket: true }, (connection: SocketStream, req: IncomingMessage) => {
    // Limiter à 10 WS par IP
    const ip = req.ip;
    const count = activeConnections.get(ip) || 0;

    if (count >= 10) {
      connection.socket.close(1008, "Trop de connexions WebSocket");
      return;
    }

    activeConnections.set(ip, count + 1);

    const socket = connection; // real WebSocket connection
    let userId: string | null = null;
    let authenticated = false;
    let service = false;

    socket.on("message", async (rawMessage) => {
      try {
        // console.log(`📩 Raw WebSocket message received: ${rawMessage.toString()}`);
        const message = JSON.parse(rawMessage.toString());
        if (service)
            return ;
        if (message.type === "registerService") {
          service = true;
         // console.log("📩 registerService received:", message);
          if (message.service === "matchmaking") {
            Matchmaking.setMatchmakingSocket(socket);
            return;
          }
          
          if(message.service === "tournament") {
            Tournament.setTournamentSocket(socket);
            return;
          }

          if(message.service === "game") {
            Game.setGameSocket(socket);
            return;
          }

          if(message.service === "AI") {
            AI.setAISocket(socket);
            return;
          }
        }
        if (message.type === "auth") {
          const result = await Auth.handleAuth(message, socket);
          authenticated = result.success;
          userId = result.userId;
          return;
        }
        // console.log("incoming message: ", message);

        if (!authenticated) {
          return socket.send(JSON.stringify({
            type: "error",
            message: "Not authenticated"
          }));
        }

        if (message.type.startsWith("game:")) {
          Game.handleGameMessage(message, socket, userId);
        }

        else if (message.type.startsWith("matchmaking:")) {
          Matchmaking.handleMatchmakingMessage(message, socket, userId);
          // console.log("sending to matchmaking: ", message);
        }
        else if (message.type.startsWith("AI:")) {
          const aiUserId = await Matchmaking.getOpponentId(userId);
          AI.handleIAMessage(message, socket, aiUserId);
        }
        else if(message.type.startsWith("tournament:")) {
          Tournament.handleTournamentMessage(message, socket, userId);
        }

      } catch (err) {
        console.error("❌ WebSocket Error 2:", err);
      }
    });
    socket.on("close", () => {
      //nettoyer les Maps
      if (userId) {
        Game.onClientDisconnect(userId);
        Matchmaking.onClientDisconnect(userId);
        Tournament.onClientDisconnect(userId);
      }
      userId = null;
      authenticated = false;
      
      // Decrementer le compteur de connexions actives
      const currentCount = activeConnections.get(ip) || 0;
      if (currentCount > 0) {
        activeConnections.set(ip, currentCount - 1);
      }
    });
  });
}