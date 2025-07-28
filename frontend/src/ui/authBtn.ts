// authBtn.ts
import { navigate } from "../router.js";
import { logout } from "../routes/auth.routes.js";
import { gameDisconnect, matchmakingDisconnect, tournamentDisconnect } from "../ws/ws-actions.js";
import { socket } from "../ws/ws-client.js";

export function initAuthButton() {
  const button = document.getElementById("authBtn");
  if (!button) return;

  const token = sessionStorage.getItem("authToken");
  const mode = sessionStorage.getItem("mode");
  if (token) {
    button.textContent = "Logout";
    button.onclick = async () => {
      try {
        await logout(token);
        matchmakingDisconnect(socket);
        if (mode === "Tournament")
            tournamentDisconnect(socket);
        console.log("✅ Logged out");
      } catch (err) {
        console.warn("⚠️ Logout error:", err);
      }
      sessionStorage.clear();
      navigate("/");
    };    
  } else {
    button.textContent = "Login";
    button.onclick = () => {
      navigate("/login");
    };
  }
}
