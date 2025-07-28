const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
import path from 'path';

// Singleton pour la gestion de la liste noire de tokens
class TokenBlacklist {
  constructor() {
    this.db = null;
    this.initialized = false;
    this.MAX_RETRIES = 5;
    this.RETRY_DELAY = 200;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Ouvrir la connexion à SQLite
      this.db = await open({
        filename: path.join('/app/shared', 'database.db'),
        driver: sqlite3.Database
      });
        // eviter data race 
      await this.db.exec("PRAGMA journal_mode = WAL"); // Write-Ahead Logging -> envoi les writes dans un fichier de log
      await this.db.exec("PRAGMA synchronous = NORMAL"); // mode d'ecriture NORMAL = bon equilibre entre securite et vitesse
      await this.db.configure("busyTimeout", 5000); // attendre 5secs avant de lancer l'erreur SQLITE_BUSY
      console.log('Base de données SQLite ouverte avec succès');
      
      // Mettre en place un nettoyage périodique des tokens expirés
      setInterval(this.cleanupExpiredTokens.bind(this), 1000 * 60 * 60); // Toutes les heures
      
      this.initialized = true;
    } catch (error) {
      console.error('Erreur lors de l\'ouverture de la base de données SQLite:', error);
      throw error;
    }
  }

  // Fonction utilitaire pour réessayer les opérations en cas d'échec
  async withRetry(operation) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Si c'est une erreur "busy" ou "locked", on réessaie
        if (error.message.includes('busy') || error.message.includes('locked')) {
          console.warn(`Base de données occupée, tentative ${attempt}/${this.MAX_RETRIES}...`);
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * attempt));
          continue;
        }
        
        // Pour les autres erreurs, on abandonne immédiatement
        throw error;
      }
    }
    
    // Si on arrive ici, c'est qu'on a épuisé toutes les tentatives
    console.error(`Échec après ${this.MAX_RETRIES} tentatives`);
    throw lastError;
  }

  // Ajouter un token à la liste noire
  async blacklist(token, decoded) {
    await this.initialize();
    
    const { jti, sub: userId, exp } = decoded;
    if (!jti) throw new Error('Le token doit contenir un JTI (JWT ID)');
    
    const expiry = new Date(exp * 1000).toISOString();
    
    await this.db.run(
      'INSERT OR REPLACE INTO blacklisted_tokens (jti, user_id, expiry) VALUES (?, ?, ?)',
      [jti, userId, expiry]
    );
  }

  // Vérifier si un token est dans la liste noire
  async isBlacklisted(jti) {
    await this.initialize();
    
    return this.withRetry(async () => {
      const result = await this.db.get(
        'SELECT 1 FROM blacklisted_tokens WHERE jti = ?',
        [jti]
      );

      return !!result;
    });
  }

  // Nettoyer les tokens expirés de la liste noire
  async cleanupExpiredTokens() {
    await this.initialize();
    
    return this.withRetry(async () => {
      const now = new Date().toISOString();
      await this.db.run('DELETE FROM blacklisted_tokens WHERE expiry < ?', [now]);
    
      // Log pour les métriques/debugging
      const { changes } = await this.db.get('SELECT changes() as changes');
      if (changes > 0) {
        console.log(`Nettoyage de la liste noire: ${changes} tokens expirés supprimés`);
      }
    });
  }

  // Invalider tous les tokens d'un utilisateur
  async blacklistAllUserTokens(userId) {
    await this.initialize();
    
    return this.withRetry(async () => {
      await this.db.run(
        'INSERT OR REPLACE INTO blacklisted_tokens (jti, user_id, expiry) VALUES (?, ?, ?)',
        [userId, userId, new Date(Date.now() + 86400000).toISOString()] // Expiration dans 24h
      );
    });
  }
}

// Instance singleton
export const tokenBlacklist = new TokenBlacklist();
