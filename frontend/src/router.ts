//router.ts
import * as View from "./ui/views.js";
import * as ViewLogs from "./ui/viewsLog.js";
import * as ViewProfile from "./ui/viewProfile.js";
import { validateToken,  } from "./routes/auth.routes.js";
import { initAuthButton } from "./ui/authBtn.js";
import { socket } from "./ws/ws-client.js";
import { stopGame } from "./ui/render.js";
import { gameDisconnect } from "./ws/ws-actions.js";
import { loadTranslations, updateNavBarText } from "./i18n.js"; 
import { saveUserSettings, getUserSettings } from "./routes/user.routes.js";
import { t } from "./i18n.js";

const routes: Record<string, () => void> = {
  "/": View.homeView,
  "/register": ViewLogs.registerView,
  "/login": ViewLogs.loginView,
  "/solo": View.soloView,
  "/tournament": View.tournamentView,
  "/profile": ViewProfile.profileView,
  "/settings": View.settingsView,
  "/create2fa": ViewLogs.create2FAView,
  "/verify2fa": ViewLogs.verify2FAView
};

const publicRoutes = ["/", "/login", "/register", "/create2fa", "/verify2fa"];

let previousPath = window.location.pathname;

async function initializeApp(currentLang: string) {
  await loadTranslations(currentLang);
  updateNavBarText();
}

export async function render() {
  const path = window.location.pathname;
  const app = document.getElementById("app");
  if (!app) return;

  const token = sessionStorage.getItem("authToken");
  const userId = Number(sessionStorage.getItem("userId"));

  // Langue et mode par défaut
  let currentLang = "en";
  let mode = "dynamic";

  // 🔄 Charger la langue depuis localStorage si non connecté
  if (!token || !userId) {
    const storedLang = localStorage.getItem("preferredLang");
    if (storedLang) {
      currentLang = storedLang;
      mode = "dynamic";
    }
  }

  // 🔐 Si connecté, récupérer les préférences utilisateur
  if (userId && token) {
    try {
      const settings = await getUserSettings(userId);
      currentLang = settings.language || "en";
      mode = settings.languageMode || "dynamic";

      const validLanguages = ["en", "fr", "es"];
      if (!validLanguages.includes(currentLang)) {
        console.warn(`❗ Langue invalide détectée (${currentLang}), fallback vers 'en'`);
        currentLang = "en";
      }

      // 🔄 Supprimer la langue stockée localement si connecté
      localStorage.removeItem("preferredLang");
    } catch (err) {
      console.warn("❗ Impossible de récupérer les préférences de langue", err);
    }
  }

  initializeApp(currentLang);

  // Gestion spécifique pour create2FA et verify2FA
  if (path === "/create2fa" || path === "/verify2fa") {
    const tempToken = sessionStorage.getItem("tempToken");
    if (!tempToken) {
      const redirectPath = path === "/create2fa" ? "/register" : "/login";
      window.history.replaceState({}, "", redirectPath);
      routes[redirectPath]?.();
      initAuthButton();
      return;
    }
    routes[path]?.();
    initAuthButton();
    return;
  }

  // Authentification pour routes privées
  if (!publicRoutes.includes(path)) {
    const isValid = token && userId && await validateToken(token, userId);
    if (!isValid) {
      console.warn("🔒 Unauthorized. Redirecting...");
      sessionStorage.setItem("postLoginRedirect", path);
      window.history.replaceState({}, "", "/login");
      ViewLogs.loginView();
      return;
    }
  }

  const viewFunction = routes[path] || (() => {
    app.innerHTML = "<h1>404 Not Found</h1>";
  });

  const leavingGameView = ["/solo", "/tournament"].includes(previousPath);

  if ((leavingGameView || !["/solo", "/tournament"].includes(path)) && socket?.readyState === WebSocket.OPEN)  {
    console.log("🔌 Leaving solo or tournament → closing game completely");
    stopGame();
		socket.close(1000, "User requested disconnect"); // 1000 = Normal closure
  } 

  // Redirection si déjà connecté
  if (publicRoutes.includes(path) && (path !== "/create2fa" && path !== "/verify2fa")) {
    const isValid = token && userId && await validateToken(token, userId);
    if (isValid && (path === "/login" || path === "/register")) {
      console.log("🔁 Already authenticated. Redirecting to /profile");
      navigate("/profile");
      return;
    }
  }

  viewFunction();
  initAuthButton();

  previousPath = path;

  // 🎌 Gestion du sélecteur de langue
  const langSelect = document.getElementById("languageSelect") as HTMLSelectElement;
  if (langSelect) {
    if (mode === "fixed") {
      langSelect.style.display = "none";
    } else {
      langSelect.style.display = "";
      langSelect.value = currentLang;
    }

    if (!langSelect.dataset.listenerAttached) {
      langSelect.addEventListener("change", async () => {
        const selectedLang = langSelect.value;
        const userId = Number(sessionStorage.getItem("userId"));
        const isConnected = Boolean(sessionStorage.getItem("authToken") && userId);

        if (isConnected) {
          localStorage.removeItem("preferredLang");
          try {
            await saveUserSettings(userId, {
              language: selectedLang,
              languageMode: "dynamic",
            });
          } catch (err) {
            console.error("❌ Erreur lors de l'enregistrement de la langue", err);
            alert(t("errorSavingLanguageSettings"));
            return;
          }
        } else {
          localStorage.setItem("preferredLang", selectedLang);
        }

        initializeApp(selectedLang);
        render();
      });

      langSelect.dataset.listenerAttached = "true";
    }
  }
}


export function navigate(path: string) {
  window.history.pushState({}, "", path);
  render();
}

window.addEventListener("beforeunload", () => {
  if (socket?.readyState === WebSocket.OPEN) {
    console.log("🔌 Closing socket on unload");
    gameDisconnect(socket);
    
		socket.close(1000, "User requested disconnect"); // 1000 = Normal closure
  }
});