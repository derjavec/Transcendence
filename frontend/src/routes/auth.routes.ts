//auth.routes.ts (frontend)

export async function registerUser(name: string, email: string, password: string, enable2FA: boolean) {
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, enable2FA }),
      });
      if (!response.ok) {
        throw new Error("Failed to create user");
      }

      return await response.json();
    } catch (error) {
      console.error("Error during registration:", error);
      throw error;
    }
  
  }
  
export async function login(email: string, password: string, forceLogin: boolean = false): Promise<{ token: string, userId: number, enable2FA: boolean }> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, forceLogin }),
  });

  if (!response.ok) {
    if (response.status === 403) {
      // Unauthorized, User already online
      const data = await response.json();
      throw new Error("User already Online");
    } else {
      // Other errors
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Login failed");
    }
 }

  const data = await response.json();
  return { token: data.token, userId: data.userId, enable2FA: data.enable2FA };
}

export async function logout(token: string): Promise<void> {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    throw new Error("Logout failed");
  }
}

// Validation du token d'authentification
export async function validateToken(token: string, userId: number): Promise<boolean> {
  try {
    // Vérifie si c'est un token temporaire pour le 2FA
    if (sessionStorage.getItem("tempToken") === token && window.location.pathname === "/create2fa") {
      return true;
    }
    const response = await fetch("/api/auth/validate-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, userId }),
    });

    const data = await response.json();
    return data.success === true;
  } catch (err) {
    console.error("Error validating token:", err);
    return false;
  }
}

// Regeneration des codes de securite
export async function regenerateRecoveryCodes() {
  const token = sessionStorage.getItem("authToken");
  if (!token) {
    throw new Error("Authentication required");
  }

  const response = await fetch("/api/auth/new-recovery-codes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({})
  });
  console.log("Regenerating recovery codes...", response);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Failed with status ${response.status}`);
  }

  const data = await response.json();
  
  // Afficher les nouveaux codes à l'utilisateur
  showRecoveryCodes(data.recoveryCodes);
  
  return data;
}

// Fonction d'aide pour afficher les codes dans une modal
function showRecoveryCodes(codes: string[]): void {
  // Créer une modal pour afficher les codes
  const modal = document.createElement("div");
  modal.className = "fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50";
  
  const codesList = codes.map((code: string) => `<li class="font-mono bg-gray-800 px-2 py-1 rounded">${code}</li>`).join("");
  
  modal.innerHTML = `
    <div class="bg-matrix-dark border border-matrix p-6 rounded-md max-w-md w-full mx-4">
      <h3 class="text-lg font-bold mb-4">Your New Recovery Codes</h3>
      <p class="mb-4 text-yellow-400">⚠️ Save these codes in a secure location. They won't be shown again!</p>
      
      <ul class="list-none space-y-2 mb-6">
        ${codesList}
      </ul>
      
      <button id="closeModal" class="btn w-full">I've saved these codes</button>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  document.getElementById("closeModal")?.addEventListener("click", () => {
    document.body.removeChild(modal);
  });
}