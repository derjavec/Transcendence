// editProfileForm.ts
import { t } from "../i18n.js";
import { updateUser } from "../routes/user.routes.js";
import { navigate } from "../router.js";

export async function editProfileForm(userId: number, userData:{name:string; email:string; enable2FA?: boolean}, onDone?: ()=> void) {
  const formHTML = `
    <form id="editProfileForm" class="space-y-4">
      <div>
        <label><strong>${t('name')}:</strong></label>
        <input type="text" id="nameInput" value="${userData.name}" class="input" />
      </div>
      <div>
        <label><strong>${t('email')}:</strong></label>
        <input type="email" id="emailInput" value="${userData.email}" class="input" />
      </div>
      <div class="flex items-center gap-2 mt-4">
        <input type="checkbox" id="twoFactorEnabled" class="checkbox" ${userData.enable2FA ? 'checked' : ''} />
        <label for="twoFactorEnabled"><strong>${t('enable2FA')}</strong></label>
      </div>
      <div class="text-sm text-gray-600 ml-6">
        ${t('2FADescription')}
      </div>
      <div>
        <label><strong>${t('password')}:</strong></label>
        <input type="password" id="passwordInput" placeholder="${t('newPassword')}" class="input" />
      </div>
      <div class="flex gap-4 pt-2">
        <button type="submit" class="btn">${t('save')}</button>
        <button type="button" id="cancelBtn" class="btn-secondary">${t('cancel')}</button>
      </div>
    </form>
  `;

  const container = document.querySelector(".mx-auto.text-left");
  if (!container) return;
  container.innerHTML = formHTML;

  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    if (onDone) onDone(); // Revenir à la vue
  });

  document.getElementById("editProfileForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nameInput = document.getElementById("nameInput") as HTMLInputElement | null;
    const emailInput = document.getElementById("emailInput") as HTMLInputElement | null;
    const passwordInput = document.getElementById("passwordInput") as HTMLInputElement | null;
    const twoFactorCheckbox = document.getElementById("twoFactorEnabled") as HTMLInputElement | null;
    
    if (!nameInput || !emailInput || !passwordInput || !twoFactorCheckbox) {
      alert(t("formElementMissing"));
      return;
    }
    
    const updatedData: any = {
      name: nameInput.value,
      email: emailInput.value,
      enable2FA: twoFactorCheckbox.checked
    };
    
    const newPassword = passwordInput.value;
    if (newPassword) updatedData.password = newPassword;
    
    try {
      await updateUser(userId, updatedData);
      console.log("Profile successfully updated:", updatedData);
      
      // Si l'utilisateur vient d'activer la 2FA, affichez les instructions ou redirigez vers la page de configuration
      if (twoFactorCheckbox.checked && !userData.enable2FA) {
        alert(t("2FAEnabled"));
        // Obtenir un token temporaire pour la configuration 2FA
        const response = await fetch("/api/auth/get-temp-2fa-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${sessionStorage.getItem("authToken")}`
          },
          body: JSON.stringify({}) // Ajouter un objet JSON vide comme corps de la requête
        });
        
        if (!response.ok) {
          throw new Error(`Failed to get temporary 2FA token: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Temporary token received:", data);
        if (!data.tempToken) {
          alert(t("tempTokenMissing"));
          return;
        }
        
        // Supprimer l'ancien token puisqu'il est maintenant dans la blacklist
        // et le remplacer par le token temporaire
        sessionStorage.removeItem("authToken");
        sessionStorage.setItem("tempToken", data.tempToken);
        sessionStorage.setItem("userId", userId.toString());
        
        // Naviguer vers la page de configuration 2FA
        navigate("/create2fa");
        return;
      } else if (!twoFactorCheckbox.checked && userData.enable2FA) {
        try {
          // Appel à l'API pour désactiver la 2FA
          const deactivateResponse = await fetch(`/api/users/${userId}/deactivate2fa`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${sessionStorage.getItem("authToken")}`
            },
            body: JSON.stringify({}) // Ajouter un objet JSON vide comme corps de la requête
          });
          
          if (!deactivateResponse.ok) {
            const errorData = await deactivateResponse.json().catch(() => ({}));
            throw new Error(`Failed to deactivate 2FA: ${errorData.message || deactivateResponse.status}`);
          }
          
          const responseData = await deactivateResponse.json();
          
          // Mise à jour du token d'authentification 
          if (responseData.token) {
            sessionStorage.setItem("authToken", responseData.token);
          }
          
          alert(t("2FADisabled"));
        } catch (error) {
          console.error("Error deactivating 2FA:", error);
          alert(t("2FADeactivationError"));
          return;
        }
      } else {
        alert(t("profileUpdated"));
      }

      if (onDone) onDone(); // Recharge la vue profil
    } catch (err) {
      console.error(err);
      alert(t("updateError"));
    }
  });
}
