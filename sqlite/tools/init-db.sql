-- This file is part of the SQLite database initialization script for the application.
-- It creates the necessary tables and indexes for user management, including 2FA setup, friend requests, and match tracking.
-- The script ensures that the tables are created only if they do not already exist, preventing errors on re-execution.
-- The tables include:

-- 1. users: Stores user information, including authentication details and profile settings.
CREATE TABLE IF NOT EXISTS users (
  userId INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  profile_picture TEXT DEFAULT 'default.png',
  enable2FA INTEGER DEFAULT 0,
  twoFactorSecret TEXT UNIQUE,
  twoFactorRecoveryCodes TEXT UNIQUE,
  SecurityVersion INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  language VARCHAR(10) DEFAULT 'en',
  language_mode VARCHAR(10) DEFAULT 'dynamic'
);

-- 2. user_stats: Tracks user statistics such as games played and won.
CREATE TABLE IF NOT EXISTS user_stats (
  userId INTEGER PRIMARY KEY,
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  highest_score INTEGER DEFAULT 0,
  FOREIGN KEY (userId) REFERENCES users (userId)
);

-- 3. blacklisted_tokens: Manages tokens that have been blacklisted for security purposes.
CREATE TABLE IF NOT EXISTS blacklisted_tokens (
  jti TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  expiry DATETIME NOT NULL,
  blacklisted_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expiry ON blacklisted_tokens(expiry);

-- 4. temp_2fa_setup: Temporarily stores 2FA setup information before finalization
CREATE TABLE IF NOT EXISTS temp_2fa_setup (
  userId INTEGER PRIMARY KEY,
  secret TEXT NOT NULL,
  recovery_codes TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- 5. friend_requests: Handles friend requests between users, including their statuses.
CREATE TABLE IF NOT EXISTS friend_requests (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  senderId INTEGER NOT NULL,
  receiverId INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (senderId) REFERENCES users (userId),
  FOREIGN KEY (receiverId) REFERENCES users (userId)
);

-- 6. matches: Tracks game matches between players, including their statuses.
CREATE TABLE IF NOT EXISTS matches (
  matchId TEXT PRIMARY KEY,
  mode TEXT DEFAULT 'tournament',
  player1 TEXT NOT NULL,
  player2 TEXT,
  winner_id TEXT,
  loser_id TEXT,
  winner_score INTEGER DEFAULT 0,
  loser_score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- options:'pending', 'active', 'completed', 'forfeit'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7 Connection: Manage offline / online status
CREATE TABLE IF NOT EXISTS player_connection (
  userId INTEGER PRIMARY KEY,
  status INTEGER DEFAULT 0, -- options: 0 = 'offline', 1 = 'online'
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users (userId)
);

-- 8 Ajout de données d'exemple

-- Insertion d'utilisateurs exemples
INSERT OR IGNORE INTO users (name, email, password, profile_picture, enable2FA, twoFactorSecret, twoFactorRecoveryCodes, language) 
VALUES 
('alice', 'alice@example.com', '$2b$10$eT4IrYQ3ZnIgz9L1Z3p85.UOxJ18vQQEKxOz/99FQOXR/fQRZ0M3K', 'default.png', 0, NULL, NULL, 'fr'),
('bob', 'bob@example.com', '$2b$10$cLlVf7TWghNIhRMd1vSL8uM1GEt8/zySJZOe0pOuF4StxdY5iS/Zq', 'default.png', 0, NULL, NULL, 'en'),
('charlie', 'charlie@example.com', '$2b$10$RkzAwvylB7ivLVkW4E/K0eAb5g1J5q8X9udZqdwly/bvmBfrJX9TK', 'default.png', 0, NULL, NULL, 'es'),
('diana', 'diana@example.com', '$2b$10$E5CdZnkgrRySPwvHF1Z7R.Zb6nXOrbZxHa3qMq3xPgjKNu7EPSwEq', 'default.png', 0, NULL, NULL, 'en');
INSERT OR IGNORE INTO player_connection (userId, status, last_seen)
VALUES 
(1, 0, CURRENT_TIMESTAMP), 
(2, 0, CURRENT_TIMESTAMP), 
(3, 0, CURRENT_TIMESTAMP), 
(4, 0, CURRENT_TIMESTAMP);
-- Insertion de statistiques pour les utilisateurs
INSERT OR IGNORE INTO user_stats (userId, games_played, games_won, highest_score)
VALUES
(1, 15, 8, 120),
(2, 10, 3, 90),
(3, 5, 2, 85),
(4, 20, 12, 150);

-- Insertion de demandes d'amis exemples
INSERT OR IGNORE INTO friend_requests (senderId, receiverId, status)
VALUES 
(1, 2, 'accepted'),  -- Alice et Bob sont amis
(1, 3, 'pending'),   -- Alice a envoyé une demande à Charlie (en attente)
(4, 1, 'pending'),   -- Diana a envoyé une demande à Alice (en attente)
(2, 3, 'rejected');  -- Bob a envoyé une demande à Charlie (rejetée)


-- The script uses SQLite syntax and is designed to be executed in an SQLite environment.
