//viewSolo.ts

import { t } from "../../i18n.js";
import { socket } from "../../ws/ws-client.js";
import { connectWebSocket } from "../../ws/ws-client.js";
import { updateGameButtons } from "../render.js";
import { createSoloMatch } from "../../ws/ws-actions.js";

export function soloView() {
    if (!socket || socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
      console.log("🔌 Reconnecting WebSocket for soloView...");
      connectWebSocket().catch(console.error);
    }
  
    sessionStorage.setItem("mode", "solo");
  
    const app = document.getElementById("app");
    if (!app) return;
  
    app.innerHTML = getSoloHTML();
  
    updateGameButtons(async () => {
      const iaToggle = document.getElementById("iaToggle") as HTMLInputElement;
      const iaMode = iaToggle?.checked;
      sessionStorage.setItem("mode", iaMode ? "soloIA" : "solo");
      iaToggle.disabled = true;
  
      const userId = Number(sessionStorage.getItem("userId"));
      await createSoloMatch(userId);
    }, false);
  }

  export function getSoloHTML(): string {
    return `
      <div class="text-center space-y-6">
        <h1 class="text-xl glow">🎮 ${t("soloModeTitle")}</h1>
  
        <div class="flex items-center justify-center space-x-4">
          <span class="text-white font-medium">🧠 IA MODE</span>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" id="iaToggle" class="sr-only peer">
            <div class="w-11 h-6 bg-gray-400 peer-focus:outline-none rounded-full peer peer-checked:bg-green-500 transition-all"></div>
            <div class="absolute left-0.5 top-0.5 bg-white w-5 h-5 rounded-full transition-transform peer-checked:translate-x-full"></div>
          </label>
        </div>
  
        <button id="startGameBtn" class="btn w-full max-w-xs mx-auto">${t("startGameButton")}</button>
  
        <div id="canvasWrapper" class="w-full max-w-[90vw] sm:max-w-[800px] mx-auto aspect-[2/1] border border-matrix bg-black">
          <canvas id="gameCanvas" class="w-full h-full" />
        </div>
      </div>
    `;
  }