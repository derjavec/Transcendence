//views.ts
import { t } from "../i18n.js";
import { connectWebSocket } from "../ws/ws-client.js";
import { joinMatchmaking, createSoloMatch } from "../ws/ws-actions.js";
import { navigate, render } from "../router.js";
import { validateToken } from "../routes/auth.routes.js";
import * as User from "../routes/user.routes.js";
import { socket } from "../ws/ws-client.js";
import { updateGameButtons } from "./render.js";

export async function homeView() {
  const app = document.getElementById("app");
  if (!app) return;

  const token = sessionStorage.getItem("authToken");
  const userId = sessionStorage.getItem("userId");

  let isValid = false;

  if (token && userId) {
    try {
      isValid = await validateToken(token, Number(userId));
    } catch (err) {
      console.warn("⚠️ Token validation failed:", err);
    }
  }

  if (!isValid) {
    sessionStorage.clear(); // clean si expiré
  }

  const message = isValid
      ? `<p class="text-pongGray">${t('loggedInMessage')}</p>`
    : `
      <p class="text-pongGray">${t('notLoggedInMessage')}</p>
      <div class="blink-loader">
        <div class="blip"></div>
        <div class="blip"></div>
        <div class="blip"></div>
        <div class="blip"></div>
        <div class="blip"></div>
      </div>
      <div class="space-x-4">
         <button id="goToLogin" class="btn">${t('login')}</button>
        <button id="goToRegister" class="btn">${t('register')}</button>
      </div>
    `;

  app.innerHTML = `
    <div class="text-center space-y-4">
      <h1 class="text-xl glow">${t('welcomeMessage')}</h1>
      ${message}
    </div>
  `;

  if (!isValid) {
    document.getElementById("goToLogin")?.addEventListener("click", () => navigate("/login"));
    document.getElementById("goToRegister")?.addEventListener("click", () => navigate("/register"));
  }
}

export function soloView() {
  if (!socket || socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
    console.log("🔌 Reconnecting WebSocket for soloView...");
    connectWebSocket().catch(console.error);
  }
  sessionStorage.setItem("mode", "solo");
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `
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

      <div class="w-full max-w-[90vw] sm:max-w-[800px] mx-auto aspect-[2/1] border border-matrix bg-black">
        <canvas id="gameCanvas" class="w-full h-full"></canvas>
      </div>
    </div>
  `;
  const mode = sessionStorage.getItem("mode");
  console.log("mode : ", mode);
  updateGameButtons(async () => {
    const iaToggle = document.getElementById("iaToggle") as HTMLInputElement;
    const iaMode = iaToggle?.checked; 
    sessionStorage.setItem("mode", iaMode ? "soloIA" : "solo");
    console.log("mode : ", mode);
    iaToggle.disabled = true;
    const userId = Number(sessionStorage.getItem("userId"));
    await createSoloMatch(userId);
  }, false);
}


export async function tournamentView() {
  sessionStorage.setItem("mode", "tournament");
  const token = sessionStorage.getItem("authToken");
  const userId = Number(sessionStorage.getItem("userId"));

  if (!socket || socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
    console.log("🔌 Reconnecting WebSocket for tournamentView...");
    await connectWebSocket().catch(console.error);
  }

  const app = document.getElementById("app");
  if (!app) 
    return;

  app.innerHTML = `
    <div class="text-center space-y-6">
      <h1 class="text-xl glow">🏆 ${t('tournamentModeTitle')}</h1>

      <button id="joinMatchBtn" class="btn w-full max-w-xs mx-auto">Start Match</button>

      <div class="w-full max-w-[90vw] sm:max-w-[800px] mx-auto aspect-[2/1] border border-matrix bg-black">
        <canvas id="gameCanvas" class="w-full h-full" />
      </div>
    </div>
  `;
  
  updateGameButtons(() => {
    const userId = Number(sessionStorage.getItem("userId"));
    updateGameButtons(() => {}, true, "Searching for opponent...");
    joinMatchmaking(userId);
  }, false);
}

export async function settingsView() {
  const app = document.getElementById("app");
  if (!app) return;

  const userId = Number(sessionStorage.getItem("userId"));
  if (!userId) {
    console.error("User ID is not available");
    return;
  }

  function getLocalSettings(): Record<string, string> {
    const stored = sessionStorage.getItem("settings");
    if (!stored) return {};
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error("Error parsing settings from sessionStorage:", e);
      return {};
    }
  }

  const savedSettings = getLocalSettings();

  let currentLang = 'en';
  let languageMode = 'dynamic';

  try {
    const userSettings = await User.getUserSettings(userId);
    currentLang = userSettings.language || 'en';
    languageMode = userSettings.languageMode || 'dynamic';
  } catch (error) {
    console.warn("Failed to fetch user settings");
  }

  app.innerHTML = `
    <div class="text-center space-y-6">
      <h1 class="text-xl glow">⚙️ ${t('settingsTitle')}</h1>

      <!-- Combined form for both settings and language -->
      <form id="combinedSettingsForm" class="mx-auto grid grid-cols-[auto,1fr] gap-4 items-center justify-center max-w-md text-left">

        <label for="bgColor" class="text-right pr-2">🎨 ${t("canvasBg")}:</label>
        <input type="color" id="bgColor" name="bgColor" />

        <label for="paddleSize" class="text-right pr-2">🏓 ${t('paddleSize')}:</label>
        <select id="paddleSize" name="paddleSize">
          <option value="small">${t('small')}</option>
          <option value="large">${t('large')}</option>
        </select>

        <label for="paddleColor" class="text-right pr-2">🏓 ${t('paddleColor')}:</label>
        <input type="color" id="paddleColor" name="paddleColor" value="#ffffff" />

        <label for="ballSize" class="text-right pr-2">⚪ ${t('ballSize')}:</label>
        <select id="ballSize" name="ballSize">
          <option value="small">${t('small')}</option>
          <option value="large">${t('large')}</option>
        </select>

        <label for="ballColor" class="text-right pr-2">⚪ ${t('ballColor')}:</label>
        <input type="color" id="ballColor" name="ballColor" value="#ffffff" />

        <label for="ballSpeed" class="text-right pr-2">🚀 ${t('ballSpeed')}:</label>
        <select id="ballSpeed" name="ballSpeed">
          <option value="normal">${t('normal')}</option>
          <option value="fast">${t('fast')}</option>
        </select>

        <label for="paddleSpeed" class="text-right pr-2">🕹️ ${t('paddleSpeed')}:</label>
        <select id="paddleSpeed" name="paddleSpeed">
          <option value="normal">${t('normal')}</option>
          <option value="fast">${t('fast')}</option>
        </select>

        <label for="languageSetting" class="text-right pr-2">🌍 ${t("language")}:</label>
        <select id="languageSetting" name="languageSetting">
          <option value="dynamic" ${languageMode === "dynamic" ? "selected" : ""}>🌐 ${t("autoDetect")}</option>
          <option value="en" ${currentLang === "en" && languageMode === "fixed" ? "selected" : ""}>🇬🇧 English</option>
          <option value="fr" ${currentLang === "fr" && languageMode === "fixed" ? "selected" : ""}>🇫🇷 Français</option>
          <option value="es" ${currentLang === "es" && languageMode === "fixed" ? "selected" : ""}>🇪🇸 Español</option>
        </select>

        <div></div>
        <button type="submit" class="btn w-full">${t('saveSettings')}</button>
      </form>
    </div>
  `;

  const fillSettingsForm = () => {
    const fields = [
      "bgColor", "paddleSize", "paddleColor", "ballSize",
      "ballColor", "ballSpeed", "paddleSpeed"
    ];
    for (const key of fields) {
      const el = document.getElementById(key) as HTMLInputElement | HTMLSelectElement | null;
      if (el && savedSettings[key]) {
        el.value = savedSettings[key];
      }
    }
  };
  fillSettingsForm();

  const combinedForm = document.getElementById("combinedSettingsForm");
  combinedForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(combinedForm as HTMLFormElement);

    // Save local settings
    sessionStorage.setItem("settings", JSON.stringify({
      bgColor: formData.get("bgColor"),
      paddleSize: formData.get("paddleSize"),
      paddleColor: formData.get("paddleColor"),
      ballSize: formData.get("ballSize"),
      ballColor: formData.get("ballColor"),
      ballSpeed: formData.get("ballSpeed"),
      paddleSpeed: formData.get("paddleSpeed"),
    }));
    console.log("Local settings saved.");

    // Save language settings
    const language = formData.get("languageSetting");
    if (!language || typeof language !== "string") {
      console.error("Invalid language");
      return;
    }

    const preferences = {
      language: language,
      languageMode: language === "dynamic" ? "dynamic" : "fixed",
    };

    try {
      await User.saveUserSettings(userId, preferences);
      console.log("Language settings saved.");
      alert("✅ Settings saved.");
      await render();
    } catch (err) {
      console.error("Error saving language preferences", err);
      alert("❌ " + t("errorSavingLanguageSettings"));
    }
  });
}
