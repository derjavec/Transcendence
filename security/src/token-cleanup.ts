// token-cleanup.ts
import { tokenBlacklist } from "./jwt-blacklist";
import fetch from "node-fetch";

interface OfflineUser {
  userId: string;
  last_seen: string;
  status: number;
}

/**
 * Service de nettoyage automatique des tokens d'utilisateurs déconnectés
 */
export class TokenCleanupService {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly OFFLINE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes d'inactivité

  /**
   * Démarre le service de nettoyage automatique
   */
  start() {
    if (this.cleanupInterval) {
      console.log("⚠️ Token cleanup service already running");
      return;
    }

    console.log("🧹 Starting token cleanup service...");
    
    // Exécuter immédiatement puis toutes les CLEANUP_INTERVAL_MS
    this.performCleanup();
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.CLEANUP_INTERVAL_MS);

    console.log(`✅ Token cleanup service started (runs every ${this.CLEANUP_INTERVAL_MS / 1000}s)`);
  }

  /**
   * Arrête le service de nettoyage
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log("🛑 Token cleanup service stopped");
    }
  }

  /**
   * Effectue le nettoyage des tokens d'utilisateurs déconnectés
   */
  private async performCleanup() {
    try {
      console.log("🧹 Starting token cleanup...");

      // 1. Nettoyer les tokens expirés dans la blacklist
      await tokenBlacklist.cleanupExpiredTokens();

      // 2. Récupérer tous les utilisateurs offline depuis trop longtemps
      const offlineUsers = await this.getStaleOfflineUsers();
      
      if (offlineUsers.length === 0) {
        console.log("✅ No stale offline users found");
        return;
      }

      console.log(`🔍 Found ${offlineUsers.length} users offline for too long`);

      // 3. Invalider les tokens de ces utilisateurs
      let invalidatedCount = 0;
      for (const user of offlineUsers) {
        const success = await this.invalidateUserTokens(user.userId);
        if (success) {
          invalidatedCount++;
        }
      }

      console.log(`✅ Token cleanup completed: ${invalidatedCount}/${offlineUsers.length} users processed`);
    } catch (error) {
      console.error("❌ Error during token cleanup:", error);
    }
  }

  /**
   * Récupère les utilisateurs offline depuis trop longtemps
   */
  private async getStaleOfflineUsers(): Promise<OfflineUser[]> {
    try {
      const response = await fetch("http://gateway-api:4000/api/users/all-offline");
      if (!response.ok) {
        throw new Error(`Failed to fetch offline users: ${response.statusText}`);
      }

      const offlineUsers: OfflineUser[] = await response.json();
      const now = Date.now();
      
      // Filtrer les utilisateurs offline depuis plus de OFFLINE_THRESHOLD_MS
      return offlineUsers.filter(user => {
        if (!user.last_seen) return false;
        
        const lastSeenTime = new Date(user.last_seen).getTime();
        const timeSinceLastSeen = now - lastSeenTime;
        
        return timeSinceLastSeen > this.OFFLINE_THRESHOLD_MS;
      });
    } catch (error) {
      console.error("❌ Error fetching offline users:", error);
      return [];
    }
  }

  /**
   * Invalide tous les tokens actifs d'un utilisateur
   */
  private async invalidateUserTokens(userId: string): Promise<boolean> {
    try {
      // Marquer l'utilisateur comme ayant besoin d'une nouvelle authentification
      // en incrementant sa version de sécurité
      const response = await fetch(`http://gateway-api:4000/api/users/${userId}/increment-security-version`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Cleanup - user offline too long" })
      });

      if (response.ok) {
        console.log(`✅ Security version incremented for user ${userId} (tokens invalidated)`);
        return true;
      } else {
        console.error(`❌ Failed to increment security version for user ${userId}:`, response.statusText);
        return false;
      }
    } catch (error) {
      console.error(`❌ Error invalidating tokens for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Invalide manuellement les tokens d'un utilisateur spécifique
   */
  async invalidateUserTokensManually(userId: string, reason: string = "Manual invalidation"): Promise<boolean> {
    console.log(`🔐 Manually invalidating tokens for user ${userId}: ${reason}`);
    return this.invalidateUserTokens(userId);
  }
}

// Instance singleton
export const tokenCleanupService = new TokenCleanupService();
