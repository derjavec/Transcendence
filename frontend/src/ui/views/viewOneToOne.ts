import { t } from "../../i18n.js";
import { socket } from "../../ws/ws-client.js";
import { connectWebSocket } from "../../ws/ws-client.js";
import { updateGameButtons } from "../render.js";
import { joinMatchmaking} from "../../ws/ws-actions.js";

export async function OneToOneView() {
    sessionStorage.setItem("mode", "1to1");
  
    // const token = sessionStorage.getItem("authToken");
    // const userId = Number(sessionStorage.getItem("userId"));
  
    if (!socket || socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
      await connectWebSocket().catch(console.error);
    }
  
    const app = document.getElementById("app");
    if (!app) return;
  
    app.innerHTML = getTournamentHTML();
  
    updateGameButtons(() => {
      const userId = Number(sessionStorage.getItem("userId"));
      updateGameButtons(() => {}, true, "Searching for opponent...");
      joinMatchmaking(userId);
    }, false);
  }

  export function getTournamentHTML(): string {
    return `
      <div class="text-center space-y-6">
        <h1 class="text-xl glow">🏆 ${t('tournamentModeTitle')}</h1>
  
        <button id="joinMatchBtn" class="btn w-full max-w-xs mx-auto">Start Match</button>
  
        <div id="canvasWrapper" class="w-full max-w-[90vw] sm:max-w-[800px] mx-auto aspect-[2/1] border border-matrix bg-black">
          <canvas id="gameCanvas" class="w-full h-full" />
        </div>
      </div>
    `;
  }