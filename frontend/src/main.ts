//main.ts
console.log("MAIN LOADED");

import { render, navigate } from "./router.js";
import { initMatrixBackground } from './ui/matrix-bg.js';

document.addEventListener("DOMContentLoaded", render);
window.addEventListener("popstate", render);

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
function forceLogout() {
  alert("Your session has expired. Please log in again.");
  sessionStorage.clear();
//   window.location.href = "/login";
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
      forceLogout();
    }
  } catch (err) {
    console.error("❌ Error validating token:", err);
  }
}, 60_000); // check toutes les 60 secondes

window.addEventListener("beforeunload", () => {
	const authToken = sessionStorage.getItem("authToken");
	if (!authToken) {
		console.warn("Aucun token trouvé dans sessionStorage.");
		return;
	}

	if (document.visibilityState !== "hidden") // ne pas delogger si on rafraichit juste la page
		return;

	const url = "/api/auth/logout";
	const blob = new Blob(
		[JSON.stringify({ token: authToken })],
		{ type: "application/json" }
	);
	console.log("Envoi de la requête de déconnexion avec le token:", authToken);
	// Utiliser sendBeacon pour envoyer la requête avec le token
	navigator.sendBeacon(url, blob);
});
