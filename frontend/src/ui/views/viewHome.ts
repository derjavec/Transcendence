//viewHome.ts

import { t } from "../../i18n.js";
import { validateToken } from "../../routes/auth.routes.js";
import { navigate } from "../../router.js";

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
    sessionStorage.clear();
  }

  const message = getMessageHTML(isValid);

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

function getMessageHTML(isValid: boolean): string {
    if (isValid) {
      return `<p class="text-pongGray">${t('loggedInMessage')}</p>`;
    } else {
      return `
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
    }
  }