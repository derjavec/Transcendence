// authBtn.ts
import { navigate } from "../router.js";
import { logout } from "../routes/auth.routes.js";

export function initAuthButton() {
  const button = document.getElementById("authBtn");
  if (!button) return;

  const token = sessionStorage.getItem("authToken");

  if (token) {
    button.textContent = "Logout";
    button.onclick = async () => {
      try {
        await logout(token);
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
