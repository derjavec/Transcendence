//main.ts
console.log("WELCOME TO OUR PONG");

import { render, navigate } from "./router.js";
import { logout } from "./routes/auth.routes.js";
import { gameDisconnect, tournamentDisconnect } from "./ws/ws-actions.js";
import { socket } from "./ws/ws-client.js";
import { stopFriendsStatusAutoRefresh } from "./routes/friends.routes.js";
import { initMatrixBackground } from './ui/matrix-bg.js';
import { t, preloadTranslations } from "./i18n.js";

// Précharger les traductions
async function initApp () {
  try {
    await preloadTranslations();
    console.log("✅ Translations preloaded");
    render();
    initMatrixBackground(); //rajouter pluie de lettres style matrix
  
  } catch (error) {
    console.error("❌ Error preloading translations:", error);
    alert("Error : Loading Translations failed");
    // Optionnel : rediriger vers une page d'erreur ou de connexion
    navigate("/login");

  }
}

document.addEventListener("DOMContentLoaded", initApp);
window.addEventListener("popstate", initApp);

initMatrixBackground(); //rajouter pluie de lettres style matrix

// Intercepter clicks sur data-link pour navigation SPA
document.body.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  if (target.matches("[data-link]")) {
    event.preventDefault();
    const href = target.getAttribute("href");
    if (href) {
      navigate(href);
    }
  }
});

// notifier le client quand le token JWT n'est plus valide, rediriger vers Login
function LogoutAlert() {
  alert("Your session has expired. Please log in again.");
  sessionStorage.clear();
	navigate("/login");
}

setInterval(async () => {
  const token = sessionStorage.getItem("authToken");
  const userId = sessionStorage.getItem("userId");

  if (!token || !userId) 
	return;

  try {
    const res = await fetch("/api/auth/validate-token", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ token, userId })
    });

    if (!res.ok) {
      console.warn("🔒 Token not valid, closing session");
      const mode = sessionStorage.getItem("mode");
      if (mode === "Tournament")
          tournamentDisconnect(socket);
      LogoutAlert();
    }
  } catch (err) {
    console.error("❌ Error validating token:", err);
  }
}, 60_000); // check toutes les 60 secondes

// listener pour ecouter refresh avec ctrl+R pour eviter lougout 
window.addEventListener("keydown", (e) => {
  if ((e.key === "F5") || (e.ctrlKey && e.key === "r")) {
    sessionStorage.setItem("reloading", "true");
  }
});

// // Un seul listener global pour ecouter la fermeture de fenetre 
window.addEventListener("beforeunload", (e) => {
  const mode = sessionStorage.getItem("mode");
      console.log("mode ", mode);
  if (!sessionStorage.getItem("reloading")) {
    const authToken = sessionStorage.getItem("authToken");
    // force logout pour changer le status "online/offline" du user
    if (authToken) {
      logout(authToken).catch(err => {
        console.warn("⚠️ Logout error when closing window:", err);
        const blob = new Blob([JSON.stringify({ token: authToken })], {
          type: "application/json"
        });
        navigator.sendBeacon("/api/auth/logout", blob);
      });
    }  
    // nettoyer les jeux en cours et envoyer les notifcations necessaires
    if (socket?.readyState === WebSocket.OPEN) {
      console.log("🔌 Closing socket on unload");
      gameDisconnect(socket);
      if (mode === "Tournament")
        tournamentDisconnect(socket);
      socket.close(1000, "User requested disconnect");
    }
    // arreter le rafraichissement automatique du status online - friendzone
    stopFriendsStatusAutoRefresh();
  } else {
    console.log("♻️ Reload detected, skipping logout");
  }
});

// Reset le flag de reload
window.addEventListener("DOMContentLoaded", () => {
  sessionStorage.removeItem("reloading");
});
