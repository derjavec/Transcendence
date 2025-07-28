// db.ts (userManagement)
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

const openDb = async () => {
  const dbPath = path.join('/app/shared', 'database.db');
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // eviter data race 
  await db.exec("PRAGMA journal_mode = WAL"); // Write-Ahead Logging -> envoi les writes dans un fichier de log
  await db.exec("PRAGMA synchronous = NORMAL"); // mode d'ecriture NORMAL = bon equilibre entre securite et vitesse
  await db.configure("busyTimeout", 5000); // attendre 5secs avant de lancer l'erreur SQLITE_BUSY

  return db;
};

export { openDb }