const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
import path from 'path';

// Singleton pour la gestion de la liste noire de tokens
class TokenBlacklist {
  constructor() {
    this.db = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Ouvrir la connexion à SQLite
      this.db = await open({
        filename: path.join('/app/shared', 'database.db'),
        driver: sqlite3.Database
      });
      console.log('Base de données SQLite ouverte avec succès');
      
      // Mettre en place un nettoyage périodique des tokens expirés
      setInterval(this.cleanupExpiredTokens.bind(this), 1000 * 60 * 60); // Toutes les heures
      
      this.initialized = true;
    } catch (error) {
      console.error('Erreur lors de l\'ouverture de la base de données SQLite:', error);
      throw error;
    }
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
    
    const result = await this.db.get(
      'SELECT 1 FROM blacklisted_tokens WHERE jti = ?',
      [jti]
    );
    
    return !!result;
  }

  // Nettoyer les tokens expirés de la liste noire
  async cleanupExpiredTokens() {
    await this.initialize();
    
    const now = new Date().toISOString();
    await this.db.run('DELETE FROM blacklisted_tokens WHERE expiry < ?', [now]);
    
    // Log pour les métriques/debugging
    const { changes } = await this.db.get('SELECT changes() as changes');
    if (changes > 0) {
      console.log(`Nettoyage de la liste noire: ${changes} tokens expirés supprimés`);
    } else {
      console.log('Aucun token expiré trouvé à nettoyer');
    }
  }

  // Invalider tous les tokens d'un utilisateur
  async blacklistAllUserTokens(userId) {
    await this.initialize();
    await this.db.run(
      'INSERT OR REPLACE INTO blacklisted_tokens (jti, user_id, expiry) SELECT jti, ?, expiry FROM blacklisted_tokens WHERE user_id = ?',
      [userId, new Date().toISOString()]
    );
  }
}

// Instance singleton
export const tokenBlacklist = new TokenBlacklist();
