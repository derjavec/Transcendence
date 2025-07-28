//views.ts
import { connectWebSocket } from "../ws/ws-client.js";
import { navigate } from "../router.js";
import { 
  registerUser, 
  login
} from "../routes/auth.routes.js";

export function registerView() {
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `
    <div class="text-center space-y-6">
      <h1 class="text-xl glow">📝 Create a New Account</h1>

      <form id="registerForm" class="mx-auto grid grid-cols-[auto,1fr] gap-4 items-center justify-center max-w-md">
        <label for="name" class="text-right pr-2">Name:</label>
        <input type="text" id="name" required />

        <label for="email" class="text-right pr-2">Email:</label>
        <input type="email" id="email" required />

        <label for="password" class="text-right pr-2">Password:</label>
        <input type="password" id="password" required />

        <label for="enable2FA" class="text-right pr-2">Enable 2FA:</label>
        <button type="button" id="enable2FABtn" class="btn px-4 py-2 bg-gray-500 text-white">NON AUTORISÉ</button>

        <div></div>
        <button type="submit" class="btn w-full">Create Account</button>
      </form>

      <div class="mt-4 w-full max-w-md mx-auto flex justify-end gap-2 items-center text-sm text-pongGray">
        <span>Already have an account?</span>
        <button id="toLogin" class="btn px-2 py-1">Login</button>
      </div>
      
    </div>
  `;

  document.getElementById("enable2FABtn")?.addEventListener("click", (e) => {
    const button = e.target as HTMLButtonElement;
    if (button.textContent === "NON AUTORISÉ") {
      button.textContent = "AUTORISÉ";
      button.classList.remove("bg-gray-500");
      button.classList.add("bg-green-500");
    } else {
      button.textContent = "NON AUTORISÉ";
      button.classList.remove("bg-green-500");
      button.classList.add("bg-gray-500");
    }
  });

  document.getElementById("registerForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = (document.getElementById("name") as HTMLInputElement).value;
    const email = (document.getElementById("email") as HTMLInputElement).value;
    const password = (document.getElementById("password") as HTMLInputElement).value;
    const enable2FA = (document.getElementById("enable2FABtn") as HTMLButtonElement).textContent === "AUTORISÉ";

    // Désactiver le bouton pendant la requête
    const submitButton = document.querySelector("#registerForm button[type='submit']") as HTMLButtonElement;
    const originalText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = "Creating...";

    try {
      console.log("Attempting to register user:", { name, email, enable2FA });
      
      const response = await registerUser(name, email, password, enable2FA);
      console.log("✅ Account created:", response);
      
      if (enable2FA && response?.token) {
        console.log("Setting tempToken for 2FA setup:", response.token);
        sessionStorage.setItem("tempToken", response.token);
        navigate("/create2fa");
      } else if (enable2FA) {
        console.error("❌ No token received for 2FA setup");
        alert("Error: No authentication token received for 2FA setup");
        navigate("/login");
      } else {
        alert("Account created successfully! Please login.");
        navigate("/login");
      }
    } catch (err) {
      console.error("❌ Error creating user:", err);
      alert(`Registration failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    
      // Réactiver le bouton en cas d'erreur
      submitButton.disabled = false;
      submitButton.textContent = originalText;
    }
  });

  document.getElementById("toLogin")?.addEventListener("click", () => navigate("/login"));
}

export function create2FAView() {
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `
    <div class="text-center space-y-6">
      <h1 class="text-xl glow">🔐 Configurer l'authentification à deux facteurs</h1>
      
      <div class="mx-auto max-w-md space-y-4">
        <div id="qrCodeContainer" class="bg-white p-4 rounded-md mx-auto w-64 h-64 flex items-center justify-center">
          <div class="text-black">Chargement du QR code...</div>
        </div>
        
        <p class="text-pongGray">Scannez ce QR code avec votre application d'authentification (Google Authenticator, Authy, etc.)</p>
        
        <form id="verify2FAForm" class="grid grid-cols-[auto,1fr] gap-4 items-center justify-center">
          <label for="token" class="text-right pr-2">Code de vérification:</label>
          <input type="text" id="token" required placeholder="Entrez le code à 6 chiffres" class="text-center" />
          
          <div></div>
          <button type="submit" class="btn w-full">Valider</button>
        </form>
        
        <div class="mt-4 text-sm">
          <p class="text-red-400">⚠️ Important: conservez vos codes de secours dans un endroit sûr.</p>
          <div id="recoveryCodes" class="mt-2 p-2 bg-gray-800 rounded text-left overflow-auto"></div>
        </div>
      </div>
    </div>
  `;

  // Simulation de chargement du QR code depuis l'API
  setTimeout(async () => {
    try {
      const tempToken = sessionStorage.getItem("tempToken");
      
      if (!tempToken) {
        throw new Error("No temporary token found for 2FA setup");
      }
      
      // Appel à l'API pour obtenir le QR code et les codes de récupération
      const response = await fetch("/api/auth/setup-2fa", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tempToken}`
        },
        body: JSON.stringify({
          // Inclusion d'un body même vide pour valider la reqête
          userId: Number(sessionStorage.getItem("userId")) || undefined
        })
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la génération du QR code");
      }

      const data = await response.json();
      
      // Affichage du QR code (data.qrCodeUrl serait une URL ou une image en base64)
      const qrCodeContainer = document.getElementById("qrCodeContainer");
      if (qrCodeContainer && data.qrCodeUrl) {
        qrCodeContainer.innerHTML = `<img src="${data.qrCodeUrl}" alt="QR Code" class="max-w-full max-h-full" />`;
      }

      // Affichage des codes de récupération
      const recoveryCodesElement = document.getElementById("recoveryCodes");
      if (recoveryCodesElement && data.recoveryCodes) {
        recoveryCodesElement.innerHTML = data.recoveryCodes
          .map((code: string) => `<div class="font-mono">${code}</div>`)
          .join("");
      }
    } catch (error) {
      console.error("❌ Erreur lors du chargement du QR code:", error);
      const qrCodeContainer = document.getElementById("qrCodeContainer");
      if (qrCodeContainer) {
        qrCodeContainer.innerHTML = `
          <div class="text-red-500">Erreur lors du chargement du QR code</div>
        `;
      }
    }
  }, 1000);

  // Gestion de la vérification du token
  document.getElementById("verify2FAForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const token = (document.getElementById("token") as HTMLInputElement).value;

    try {
      // Appel à l'API pour valider le token
      const response = await fetch("/api/auth/verify-2fa", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionStorage.getItem("tempToken")}`
        },
        body: JSON.stringify({ token })
      });

      if (!response.ok) {
        throw new Error("Code de vérification incorrect");
      }

      const data = await response.json();
      
      // Stockage du token final et redirection
      sessionStorage.setItem("authToken", data.token);
      sessionStorage.setItem("userId", String(data.userId));
      sessionStorage.removeItem("tempToken"); // Suppression du token temporaire
      
      alert("✅ Configuration 2FA réussie! Vous pouvez maintenant vous connecter.");
      navigate("/login");
    } catch (error) {
      console.error("❌ Erreur de vérification 2FA:", error);
      alert("Code de vérification incorrect. Veuillez réessayer.");
    }
  });
}

export function loginView() {
  const app = document.getElementById("app");
  if (app) {
    app.innerHTML = `
      <div class="text-center space-y-6">
      <h1 class="text-xl glow">🔐 Log In to Your Account</h1>

      <form id="loginForm" class="mx-auto grid grid-cols-[auto,1fr] gap-4 items-center justify-center max-w-md">
        <label for="email" class="text-right pr-2">Email:</label>
        <input type="email" id="email" required />

        <label for="password" class="text-right pr-2">Password:</label>
        <input type="password" id="password" required />

        <div></div>
        <button type="submit" class="btn w-full">Log In</button>
      </form>

      <div class="mt-4 w-full max-w-md mx-auto flex justify-end gap-2 items-center text-sm text-pongGray">
        <span>Don't have an account?</span>
        <button id="toRegister" class="btn px-2 py-1">Register</button>
      </div>
    </div>
    `;

    document.getElementById("toRegister")?.addEventListener("click", () => navigate("/register"));

    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = (document.getElementById("email") as HTMLInputElement).value;
        const password = (document.getElementById("password") as HTMLInputElement).value;
        
        // Désactiver le bouton pendant l'authentification
        const submitButton = loginForm.querySelector("button[type='submit']") as HTMLButtonElement;
        const originalButtonText = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.textContent = "Authenticating...";
        
        try {
          // Important: nettoyer les anciens tokens avant la tentative de connexion
          // pour éviter des conflits avec d'anciennes sessions
          sessionStorage.removeItem("authToken");
          sessionStorage.removeItem("tempToken");
          sessionStorage.removeItem("pendingAuth");
          
          const response = await login(email, password);

          // Cas 0: L'utilisateur est déja connecté
          if ('error' in response && response.error === "User already logged in") {
            console.log("User already logged in elsewhere")
            alert("Connexion annulée. Déconnectez-vous de votre autre session ou contactez l'administrateur.");
            return;
          }
          
          // Cas 1: L'utilisateur a le 2FA activé mais n'a pas encore fourni de code
          if ('message' in response && response.message === "Two-factor authentication code required") {
            console.log("2FA code required, redirecting to verification page");
            
            // Stocker le token temporaire au lieu du définitif
            sessionStorage.setItem("tempToken", response.token);
            sessionStorage.setItem("userId", String(response.userId));
            sessionStorage.setItem("pendingAuth", "true");
            
            // Rediriger vers la page de vérification 2FA
            navigate("/verify2fa");
            return;
          }

          // Cas 2: Connexion normale (sans 2FA)
          if (!('token' in response)) {
            throw new Error("Unexpected server response format");
          }

          const { token, userId, enable2FA } = response;

          // Si 2FA est activé, utiliser tempToken plutôt que authToken
          if (enable2FA) {
            console.log("2FA is enabled, redirecting to verification page");
            sessionStorage.setItem("tempToken", token);
            sessionStorage.setItem("userId", String(userId));
            sessionStorage.setItem("pendingAuth", "true");
            alert("2FA is enabled. Please verify your identity.");
            navigate("/verify2fa");
            return;
          } else {
            // Cas sans 2FA, authentification complète
            sessionStorage.setItem("authToken", token);
            sessionStorage.setItem("userId", String(userId));
          }

          const redirectTo = sessionStorage.getItem("postLoginRedirect") || "/";
          sessionStorage.removeItem("postLoginRedirect");
          navigate(redirectTo);
        } catch (err) {
          console.error("❌ Authentication error:", err);
          alert(`Authentication failed: ${err instanceof Error ? err.message : "Invalid credentials"}`);
        } finally {
          // Réactiver le bouton dans tous les cas
          submitButton.disabled = false;
          submitButton.textContent = originalButtonText;
        }
      });
    }
  }
}

// Nouvelle vue pour la vérification 2FA après login
export function verify2FAView() {
  const app = document.getElementById("app");
  if (!app) return;
  
  // Vérifier s'il s'agit d'un tempToken
  const tempToken = sessionStorage.getItem("tempToken");
  const pendingAuth = sessionStorage.getItem("pendingAuth");

  if (!tempToken || !pendingAuth) {
    console.warn("❌ No temporary token or pending auth status found");
    navigate("/login");
    return;
  }
  
  app.innerHTML = `
    <div class="text-center space-y-6">
      <h1 class="text-xl glow">🔐 Two-Factor Authentication</h1>
      
      <div class="mx-auto max-w-md space-y-4" id="authForms">
        <!-- Vue par défaut: formulaire d'authentification par application -->
        <div id="appAuthForm">
          <p class="text-pongGray">Please enter the verification code from your authentication app.</p>
          
          <form id="verify2FALoginForm" class="grid grid-cols-[auto,1fr] gap-4 items-center justify-center">
            <label for="token" class="text-right pr-2">Verification Code:</label>
            <input type="text" id="token" required placeholder="Enter 6-digit code" class="text-center" maxlength="6" pattern="[0-9]{6}" />
            
            <div></div>
            <button type="submit" class="btn w-full">Verify</button>
          </form>
          
          <div class="mt-4 text-sm">
            <button id="useRecoveryCode" class="text-blue-400 underline">Use a recovery code instead</button>
          </div>
        </div>
        
        <!-- Vue alternative: formulaire d'authentification par code de secours (masqué par défaut) -->
        <div id="recoveryCodeForm" class="hidden">
          <p class="text-pongGray">Please enter one of your recovery codes.</p>
          
          <form id="verifyRecoveryCodeForm" class="grid grid-cols-[auto,1fr] gap-4 items-center justify-center">
            <label for="recoveryCode" class="text-right pr-2">Recovery Code:</label>
            <input type="text" id="recoveryCode" required placeholder="Enter recovery code (e.g. ABCD-EFGH)" class="text-center" />
            
            <div></div>
            <button type="submit" class="btn w-full">Verify</button>
          </form>
          
          <div class="mt-4 text-sm">
            <button id="useAppCode" class="text-blue-400 underline">Use authentication app instead</button>
          </div>
        </div>
        
        <div class="mt-4 text-sm">
          <button id="cancelAuth" class="text-red-400 underline">Cancel Authentication</button>
        </div>
      </div>
    </div>
  `;
  
  // Basculer entre les formulaires
  document.getElementById("useRecoveryCode")?.addEventListener("click", () => {
    document.getElementById("appAuthForm")?.classList.add("hidden");
    document.getElementById("recoveryCodeForm")?.classList.remove("hidden");
  });

  document.getElementById("useAppCode")?.addEventListener("click", () => {
    document.getElementById("recoveryCodeForm")?.classList.add("hidden");
    document.getElementById("appAuthForm")?.classList.remove("hidden");
  });

  document.getElementById("verify2FALoginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = (document.getElementById("token") as HTMLInputElement).value;
    const submitButton = (e.target as HTMLFormElement).querySelector("button[type='submit']") as HTMLButtonElement;
    const originalButtonText = submitButton.textContent;
    
    submitButton.disabled = true;
    submitButton.textContent = "Verifying...";
    
    try {
      console.log("Verifying 2FA code...");
      const userId = sessionStorage.getItem("userId");
      const tempToken = sessionStorage.getItem("tempToken");
      
      if (!tempToken) {
        throw new Error("No temporary token found");
      }

      sessionStorage.removeItem("authToken");

      // API pour vérifier le code 2FA
      const response = await fetch("/api/auth/verify-2fa", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tempToken}`
        },
        body: JSON.stringify({ 
          token: code,
          userId
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("2FA verification failed:", response.status, errorData);
        throw new Error(errorData.message || `Verification failed (${response.status})`);
      }
      
      const data = await response.json();
      console.log("✅ 2FA verification successful", data);
      
      // Mettre à jour le token si un nouveau est fourni
      if (data.token) {
        sessionStorage.removeItem("tempToken");
        sessionStorage.removeItem("pendingAuth");
        sessionStorage.setItem("authToken", data.token);
      } else {
        throw new Error("No token received after vérification");
      }
      
      // Connexion WebSocket avec le nouveau token
      // await connectWebSocket();
      
      const redirectTo = sessionStorage.getItem("postLoginRedirect") || "/tournament";
      sessionStorage.removeItem("postLoginRedirect");
      navigate(redirectTo);
    } catch (error) {
      console.error("❌ 2FA Verification error:", error);
      alert(`Verification failed: ${error instanceof Error ? error.message : "Invalid code"}`);
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
  });

  // Gérer la soumission du formulaire pour les codes de secours
  document.getElementById("verifyRecoveryCodeForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const rescueCode = (document.getElementById("recoveryCode") as HTMLInputElement).value;
    const submitButton = (e.target as HTMLFormElement).querySelector("button[type='submit']") as HTMLButtonElement;
    const originalButtonText = submitButton.textContent;
    
    submitButton.disabled = true;
    submitButton.textContent = "Verifying...";
    
    try {
      console.log("Verifying recovery code...");
      const userId = sessionStorage.getItem("userId");
      const tempToken = sessionStorage.getItem("tempToken");
      
      if (!tempToken) {
        throw new Error("No temporary token found");
      }

      sessionStorage.removeItem("authToken");

      // API pour vérifier le code de secours
      const response = await fetch("/api/auth/rescueCode-2fa", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tempToken}`
        },
        body: JSON.stringify({ 
          rescueCode,
          userId
        })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Recovery code verification failed:", response.status, errorData);
        throw new Error(errorData.message || `Verification failed (${response.status})`);
      }
      
      const data = await response.json();
      console.log("✅ Recovery code verification successful", data);
      
      // Mettre à jour le token
      if (data.token) {
        sessionStorage.removeItem("tempToken");
        sessionStorage.removeItem("pendingAuth");
        sessionStorage.setItem("authToken", data.token);
        
        // Afficher le nombre de codes restants
        if (data.remainingCodes <= 3) {
          alert(`Warning: You have only ${data.remainingCodes} recovery codes left. Consider generating new ones.`);
        }
      } else {
        throw new Error("No token received after verification");
      }
      
      // Connexion WebSocket avec le nouveau token
      await connectWebSocket();
      
      const redirectTo = sessionStorage.getItem("postLoginRedirect") || "/tournament";
      sessionStorage.removeItem("postLoginRedirect");
      navigate(redirectTo);
    } catch (error) {
      console.error("❌ Recovery code verification error:", error);
      alert(`Verification failed: ${error instanceof Error ? error.message : "Invalid recovery code"}`);
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
  });

  document.getElementById("cancelAuth")?.addEventListener("click", () => {
    if (confirm("Cancel authentication process?")) {
      sessionStorage.removeItem("authToken");
      sessionStorage.removeItem("tempToken");
      sessionStorage.removeItem("userId");
      sessionStorage.removeItem("enable2FA");
      sessionStorage.removeItem("pendingAuth");
      navigate("/login");
    }
  });
}
