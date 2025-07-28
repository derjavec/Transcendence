//updateDB.ts
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

let db: sqlite3.Database;

export async function initDB() {
  db = await open({
    filename: "/app/shared/database.db",
    driver: sqlite3.Database
  });
}

export function getDB() {
  return db;
}

export async function NewSoloMatch(matchId: string, userId: string, aiId: string) {
  await db.run(
    `INSERT INTO matches (matchId, player1, player2, status, mode)
     VALUES (?, ?, ?, ?, ?)`,
    matchId, userId, aiId, "active", "solo"
  );
}

export async function NewMultiPlayerMatch(matchId: string, p1: string, p2: string) {
  await db.run(
    `INSERT INTO matches (matchId, player1, player2, status, mode)
     VALUES (?, ?, ?, ?, ?)`,
    matchId, p1, p2, "active", "tournament"
  );
}

export async function getMatchById(matchId: string) {
  return await db.get("SELECT player1, player2 FROM matches WHERE matchId = ?", matchId);
}

export async function getMatchByUserId(userId: string) {
  return await db.get(
    `SELECT matchId, player1, player2, status 
     FROM matches 
     WHERE (player1 = ? OR player2 = ?) AND status = 'active' LIMIT 1`,
    userId, userId
  );
}

export async function getMatchStatus(matchId: string) {
  return await db.get("SELECT status FROM matches WHERE matchId = ?", matchId);
}

export async function getUserName(userId: string): Promise<string> {
  const result = await db.get("SELECT name FROM users WHERE userId = ?", userId);
  return result?.name ?? "Player";
}

export async function getOpponent(userId: string): Promise<{ id: string; name: string } | null> {
  const match = await db.get(
    `SELECT player1, player2 FROM matches 
     WHERE (player1 = ? OR player2 = ?) AND status = 'active' LIMIT 1`,
    userId, userId
  );

  if (!match) 
    return null;

  const opponentId = match.player1 === String(userId) ? match.player2 : match.player1;
  const name = opponentId.startsWith("AI") ? "🤖 AI" : await getUserName(opponentId);
  return { id: opponentId, name };
}

async function updateUserStats(winnerId: string, loserId: string, winnerScore: number) {
    //console.log("updating Stats:", winnerId, "vs", loserId, "score:", winnerScore); //debug
    if (!String(winnerId).startsWith("AI")) {
        const winnerNum = Number(winnerId);
        await db.run(`
            UPDATE user_stats SET 
                games_played = games_played + 1,
                games_won = games_won + 1,
                highest_score = MAX(highest_score, ?)
            WHERE userId = ?`,
            winnerScore, winnerNum
        );
    }

    if (!String(loserId).startsWith("AI")) {
        const loserNum = Number(loserId);
        await db.run(`
            UPDATE user_stats SET 
                games_played = games_played + 1
            WHERE userId = ?`,
            loserNum
        );
    }
}

export async function updateMatchStats(
    matchId: string,
    winnerId: string,
    loserId: string,
    winnerScore: number,
    loserScore: number,
    reason: "completed" | "forfeit"
) {
    //console.log(`📦 Updating match ${matchId}. Reason: ${reason}`);

    const result = await db.run(`
        UPDATE matches SET
        status = ?,
        winner_id = ?,
        loser_id = ?,
        winner_score = ?,
        loser_score = ?
        WHERE matchId = ? AND status = 'active'`,
        reason, winnerId, loserId, winnerScore, loserScore, matchId
    );

    if (result.changes === 0) {
        console.log(`🟡 Match ${matchId} already finalized, skipping stats`);
        return;
    }

    await updateUserStats(winnerId, loserId, winnerScore);
}