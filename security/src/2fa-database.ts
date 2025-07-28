import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

const dbPath = path.join('/app/shared', 'database.db');

class Setup2FADatabase {
    private db: any;
    private initialized: boolean = false;

    async initialize() {
        if (this.initialized) return;

        this.db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        // Nettoyage regulier de la base
        setInterval(() => this.cleanupExpiredData(), 60 * 60 * 1000);

        this.initialized = true;
    }

    // Stocke temporairement les données 2FA
    async storeTemporary2FAData(userId: number, secret: string, recoveryCodes: string[]) {
        await this.initialize();

        // Supprimer les anciennes versions eventuelles
        await this.db.run('DELETE FROM temp_2fa_setup WHERE userId = ?', userId);

        // Stocker les nouvelles données
        await this.db.run(
            'INSERT INTO temp_2fa_setup (userId, secret, recovery_codes, created_at) VALUES (?, ?, ?, ?)',
            [
                userId,
                secret,
                JSON.stringify(recoveryCodes),
                Date.now()
            ]
        );
    }

    // Récupérer les données 2FA Temporaires
    async getTemporary2FAData(userId: number) {
        await this.initialize();

        const row = await this.db.get('SELECT * FROM temp_2fa_setup WHERE userId = ?', userId);

        if (!row) {
            const user = await this.db.get('SELECT * FROM users WHERE userId = ? AND enable2FA = 1', userId);
            if (!user) return null;
            return {
                userId: user.userId,
                secret: user.twoFactorSecret,
                recoveryCodes: JSON.parse(user.twoFactorRecoveryCodes),
                createAt: user.created_at,
                enableEFA: user.enable2FA === 1
            };
        }

        return {
            userId: row.userId,
            secret: row.secret,
            recoveryCodes: JSON.parse(row.recovery_codes),
            createAt: row.created_at,
            enable2FA: 0 // Indique que le 2FA n'est pas encore activé
        };
    }

    // Supprimer les données temporaires après activation
    async deleteTemporary2FAData(userId: number) {
        await this.initialize();
        await this.db.run('DELETE FROM temp_2fa_setup WHERE userId = ?', userId);
    }

    // Nettoyer les configurations 2FA expirées (plus de 24h)
    async cleanupExpiredData() {
        await this.initialize();
        const expiryTime = Date.now() - (24 * 60 * 60 * 1000);
        await this.db.run('DELETE FROM temp_2fa_setup WHERE created_at < ?', expiryTime);
    }
}

export const setup2FADatabase = new Setup2FADatabase();