//views.ts
import { t } from "../i18n.js";
import { navigate } from "../router.js";
import { regenerateRecoveryCodes } from "../routes/auth.routes.js";
import { deleteUser, uploadBase64Image } from "../routes/user.routes.js";
import { initFriendsEventHandlers } from "../routes/friends.routes.js";
import { editProfileForm } from "./editProfileForm.js";
import { ProfilePicForm } from "./ProfilePicForm.js";
import * as User from "../routes/user.routes.js";
import * as Match from "./matchInfo.js";

export async function profileView() {
  const userId = Number(sessionStorage.getItem("userId"));
  if (!userId) return;

 let userData = { name: "", email: "", enable2FA: false, profile_picture: "default.png" };
  try {
    userData = await User.getUser(userId);
  } catch (err) {
    console.warn("❌ Failed to fetch user info");
  }

  let stats = { games_played: 0, games_won: 0, highest_score: 0 }; // placeholder
  try {
    stats = await User.getUserStats(userId);
    console.log("user stats: ", stats);
  } catch (err) {
    console.warn("❌ Failed to fetch user stats");
  }

  const app = document.getElementById("app");
  if (!app) return;

  const imageSrc = userData.profile_picture && userData.profile_picture !== 'default.png'
  ? `data:image/png;base64,${userData.profile_picture}`
  : '/images/default.png';

  app.innerHTML = `
    <div class="text-center space-y-8">
      <!-- Section 1: Informations de profil -->
      <div class="space-y-6">
        <h1 class="text-xl glow">👤 ${t('profileTitle')}</h1>

        <img src="${imageSrc}"
          alt="Profile picture"
          class="rounded-full w-32 h-32 mx-auto shadow-lg border" />

        <form id="profilePicForm" class="space-y-2 text-center">
          <input type="file" id="profilePicInput" accept="image/*" class="block mx-auto" />
          <button type="submit" class="btn px-4">${t('changePicture')}</button>
        </form>
      
        <div class="mx-auto text-left space-y-2 w-fit">
          <p><strong>${t('id')}:</strong> ${userId}</p>
          <p><strong>${t('name')}:</strong> ${userData.name}</p>
          <p><strong>${t('email')}:</strong> ${userData.email}</p>
          <p><strong>${t('games played')}:</strong> ${stats.games_played}</p>
          <p><strong>${t('games won')}:</strong> ${stats.games_won}</p>
          <button id="historyBtn" class="btn px-4">📜 See Match History</button>
          <p><strong>2FA Status:</strong> ${userData.enable2FA? "Activated" : "Not Activated"}</p>
          <div class="flex gap-4 pt-4">
            <button id="modifyBtn" class="btn px-4">Modify</button>
            <button id="deleteBtn" class="btn-danger px-4">Delete</button>
            ${userData.enable2FA ? 
              `<button id="regenerateCodesBtn" class="btn bg-yellow-600 px-4">Regenerate Recovery Codes</button>` : 
              ''}
          </div>
        </div>
      </div>

      <!-- Section 2: Gestion des amis -->
      <div class="space-y-6 border-t border-matrix pt-8 mt-8">
        <h2 class="text-xl glow">👥 Friends</h2>
        
        <!-- Recherche d'amis -->
        <div class="mx-auto max-w-md">
          <div class="flex gap-2">
            <input type="text" id="friendSearch" placeholder="Search users..." class="flex-1 px-3 py-2">
            <button id="searchFriendBtn" class="btn">Search</button>
          </div>
          <div id="searchResults" class="mt-4 space-y-2 max-h-40 overflow-y-auto hidden"></div>
        </div>
        
        <!-- Onglets pour naviguer entre les sections -->
        <div class="flex border-b border-matrix">
          <button id="tabFriendsList" class="px-4 py-2 bg-matrix text-white">My Friends</button>
          <button id="tabRequests" class="px-4 py-2">Friend Requests <span id="requestCount" class="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full ml-1 hidden">0</span></button>
        </div>
        
        <!-- Liste d'amis -->
        <div id="friendsList" class="space-y-2">
          <div class="text-center text-gray-400">Loading friends list...</div>
        </div>
        
        <!-- Demandes d'amis (caché par défaut) -->
        <div id="friendRequests" class="space-y-2 hidden">
          <div class="text-center text-gray-400">Loading friend requests...</div>
        </div>
      </div>
    </div>
  `;


  // Event handlers pour le bouton d'historique des matchs
  document.getElementById("historyBtn")?.addEventListener("click", async () => {
    try {
      const matchHistory = await User.getUserMatchHistory(userId);
      Match.showMatchHistoryModal(matchHistory);
    } catch (err) {
      console.error("❌ Failed to load match history", err);
    }
  });

  // Event handlers pour les boutons du profil
  document.getElementById("modifyBtn")?.addEventListener("click", () => {
    editProfileForm(userId, { name: userData.name, email: userData.email, enable2FA: userData.enable2FA }, profileView);
  });

  document.getElementById("deleteBtn")?.addEventListener("click", async () => {
    if (confirm("Are you sure? This cannot be undone.")) {
      await deleteUser(userId);
      sessionStorage.clear();
      // Penser a rajouter: API pour clean tout (token + user info)
      navigate("/");
    }
  });

  document.getElementById("regenerateCodesBtn")?.addEventListener("click", async () => {
    try {
      if (confirm("Are you sure you want to regenerate your recovery codes? Your old codes will no longer work.")) {
        await regenerateRecoveryCodes();
      }
    } catch (error) {
      console.error("Error regenerating recovery codes:", error);
      alert(`Failed to regenerate recovery codes: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  });

  // Gestion de l'upload de la photo de profil
  ProfilePicForm(userId, profileView, uploadBase64Image, t);

  // Chargement des amis et des demandes d'amis
  initFriendsEventHandlers();
}