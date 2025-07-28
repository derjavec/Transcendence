//ws-handler.ts
import { FastifyInstance } from "fastify";
import { SocketStream } from "@fastify/websocket";
import { IncomingMessage } from "http";
import * as Auth from "./ws-auth"; 
import * as Game from "./ws-game";
import * as IA from "../proxy/proxy-ia";
import * as Matchmaking from "./ws-matchmaking";
// import * as Tournament from "./ws-tournament";


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

    socket.on("message", async (rawMessage) => {
      try {
        // console.log(`📩 Raw WebSocket message received: ${rawMessage.toString()}`);
        const message = JSON.parse(rawMessage.toString());
        if (message.type === "registerService") {

          if (message.service === "matchmaking") {
            // console.log("📡 Matchmaking service connected");
            Matchmaking.setMatchmakingSocket(socket);
            return;
          }
          // if (message.service === "tournament") {
          //   console.log("📡 Tournament service connected");
          //   Tournament.setTournamentSocket(socket);
          //   return;
          // }
        }

        if (message.type === "auth") {
          const result = await Auth.handleAuth(message, socket);
          authenticated = result.success;
          userId = result.userId;
          return;
        }

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
        else if (message.type.startsWith("IA:")) {
          IA.handleIAMessage(message, userId);
        }

      } catch (err) {
        console.error("❌ WebSocket Error 2:", err);
      }
    });
    socket.on("close", () => {
      if (userId) 
        Game.destroyUserSocket(userId); // necesaire pour le WS de game qui sont persistent et utilisent une Map
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