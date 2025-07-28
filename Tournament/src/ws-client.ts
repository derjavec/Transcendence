// ws-client.ts (tournament)
import WebSocket from 'ws';
import * as update from "./updateDB";
import * as handler from "./tournamentHandler";

async function connectToGateway(url: string): Promise<WebSocket> {
  return new Promise((resolve) => {
    let ws: WebSocket;

    const tryConnect = () => {
      ws = new WebSocket(url);

      ws.on('open', () => {
        console.log(`🟢 Tournament service connected to ${url}`);
        resolve(ws);
      });

      ws.on('error', () => {
        console.warn(`⏳ Gateway not ready, retrying in 1s...`);
        setTimeout(tryConnect, 1000);
      });
    };

    tryConnect();
  });
}

(async () => {
    await update.initDB();
    const socket = await connectToGateway("ws://gateway-ws:4500/ws");
    socket.send(JSON.stringify({ type: "registerService", service: "tournament" }));

    socket.on("message", async (raw) => {
        const message = JSON.parse(raw.toString());
        switch (message.type) {
            case 'CREATE_TOURNAMENT':
                await handler.handleCreateTournament(message, socket);
                break;
            case 'JOIN_TOURNAMENT':
                await handler.handleRegisterTournament(message, socket);
                break;
            case 'TOURNAMENT_LIST':
                await handler.handleListTournament(message, socket);
                break;
            case 'REPORT_RESULT':
                await handler.handleReportResult(message, socket);
                break;
            case 'REMOVE_FROM_TOURNAMENT':
                await handler.handleRemoveFromTournament(message, socket);
                break;
            default:
                if (message.type !== 'error')
                    console.warn("❓ Unknown message type:", message.type);
                break;
        }
    });

    socket.on("close", () => {
        console.warn("🔌 Tournament Gateway connection closed");
    });

    socket.on("error", (err) => {
        console.error("❌ Tournament WebSocket error:", err);
    });
})();
