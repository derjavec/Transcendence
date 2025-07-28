//updateDB.ts
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

let db = sqlite3.Database;

export async function initDB() {
    db = await open({
        filename: "/app/shared/database.db",
        driver: sqlite3.Database
    });
    // eviter data race 
    await db.exec("PRAGMA journal_mode = WAL"); // Write-Ahead Logging -> envoi les writes dans un fichier de log
    await db.exec("PRAGMA synchronous = NORMAL"); // mode d'ecriture NORMAL = bon equilibre entre securite et vitesse
    await db.configure("busyTimeout", 5000); // attendre 5secs avant de lancer l'erreur SQLITE_BUSY
}

export function getDB() {
    return db;
}


//Creation tournoi
export async function createTournament(name: string, userId: string, participants: number) {
    const db = getDB();
    const now = new Date().toISOString();
    const result = await db.run(
        `INSERT INTO tournaments (tournamentName, creatorId, participants, createdAt, isActive)
         VALUES (?, ?, ?, ?, ?)`,
        [name, userId, participants, now, 1]
    );
    return result.lastID;
}

export async function hasActiveTournament(): Promise<boolean> {
    const db = getDB();
    const row = await db.get(`SELECT COUNT(*) as count FROM tournaments WHERE isActive = 1`);
    return row.count > 0;
}


//Inscription tournoi
export async function getUserNameById(userId: number): Promise<string | null> {
    const db = getDB();
    const row = await db.get("SELECT name FROM users WHERE userId = ?", userId);
    return row ? row.name : null;
}

export async function getActiveTournamentByName(name: string) {
    const db = getDB();
    const row = await db.get(
        `SELECT * FROM tournaments WHERE tournamentName = ? AND isActive = 1`,
        [name]
    );
    return row || null;
}

export async function registerUserToTournament(userId: number, tournamentId: number) {
    const db = getDB();
    const now = new Date().toISOString();

    await db.run(
        `INSERT INTO tournament_registrations (userId, tournamentId, registeredAt) VALUES (?, ?, ?)`,
        [userId, tournamentId, now]
    );
}

export async function getRegistrationCount(tournamentId: number): Promise<number> {
    const db = getDB();
    const row = await db.get(
        `SELECT COUNT(*) as count FROM tournament_registrations WHERE tournamentId = ?`,
        [tournamentId]
    );
    return row.count || 0;
}

export async function getParticipantsForTournament(tournamentId: number) {
    const db = getDB();
    // returner le userId aussi et non pas seulement le nom
    return db.all(
        `SELECT u.userId, u.name FROM users u
        JOIN tournament_registrations tr on u.userId = tr.userId
        WHERE tr.tournamentId = ?`,
        [tournamentId]
    );
}

//appariements

export async function createMatch({
    tournamentId,
    round,
    player1Id,
    player2Id,
    winnerId
}: {
    tournamentId: number,
    round: number,
    player1Id: number,
    player2Id: number | null,
    winnerId: number | null
}) {
    const db = getDB();
    const now = new Date().toISOString();

    await db.run(
        `INSERT INTO tournament_matches (tournamentId, round, player1Id, player2Id, winnerId, createdAt)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [tournamentId, round, player1Id, player2Id, winnerId, now]
    );
}

export async function getMatchesForRound(tournamentId: number, round: number,) {
    const db = getDB();
    return db.all(
        `SELECT * FROM tournament_matches
        WHERE tournamentId = ? AND round = ?`,
        [tournamentId, round]
    );
}

export async function setMatchWinner(
	tournamentId: number,
	round: number,
	player1Id: number,
	player2Id: number,
	winnerId: number
) {
	const db = getDB();
	const res = await db.run(
		`UPDATE tournament_matches
		 SET winnerId = ?
		 WHERE tournamentId = ? AND round = ? AND player1Id = ? AND player2Id = ?`,
		[winnerId, tournamentId, round, player1Id, player2Id]
	);
    return res;
}

export async function getByePlayerInRound(tournamentId: number, round: number): Promise<number | null> {
	const db = getDB();
	const result = await db.get(
		`SELECT player1Id FROM tournament_matches
		 WHERE tournamentId = ? AND round = ? AND player2Id IS NULL`,
		[tournamentId, round]
	);
	return result?.player1Id || null;
}

export async function getMatchesWithoutWinner(tournamentId: number, round: number) {
    const db = getDB();
    return db.all(
        `SELECT * FROM tournament_matches WHERE tournamentId = ? AND round = ? AND winnerId IS NULL`,
        [tournamentId, round]
    );
}

export async function setTournamentStatus(tournamentId: number, status: "waiting" | "running" | "finished") {
	const db = getDB();
	await db.run(`
		UPDATE tournaments
		SET status = ?
		WHERE id = ?
	`, [status, tournamentId]);
}


export async function getAllTournaments() {
    const db = getDB();
    return db.all(
        `SELECT 
            t.id,
            t.tournamentName,
            t.creatorId as userId, 
            u.name as creatorName,
            t.participants,
            t.createdAt,
            t.isActive,
            t.status
        FROM tournaments t
        LEFT JOIN users u ON t.creatorId = u.userId
        ORDER BY t.createdAt DESC`
    );
}

export async function getActiveTournament() {
	const db = getDB();
	return db.get(`SELECT * FROM tournaments WHERE isActive = 1 ORDER BY createdAt DESC LIMIT 1`);
}

export async function getTournamentById(id: number) {
	const db = getDB();
	const rawRow = await db.get(
		`SELECT * FROM tournaments WHERE id = ?`,
		[id]
	);

	if (!rawRow) {
		console.warn(`Tournament with ID ${id} does not exist at all.`);
		return null;
	}
	if (rawRow.isActive !== 1) {
		console.warn(`Tournament with ID ${id} exists but is not active (isActive = ${rawRow.isActive}).`);
		return null;
	}

	return rawRow;
}

export async function getActiveTournamentForUser(userId: number) {
	const db = getDB();
	return db.get(`
		SELECT t.*
		FROM tournaments t
		JOIN tournament_registrations tr ON tr.tournamentId = t.id
		WHERE tr.userId = ? AND t.isActive = 1
	`, [userId]);
}

export async function removeUserFromTournament(userId: number, tournamentId: number) {
	const db = getDB();
	await db.run(`
		DELETE FROM tournament_registrations
		WHERE userId = ? AND tournamentId = ?
	`, [userId, tournamentId]);
}

export async function deactivateTournament(tournamentId: number) {
	const db = getDB();
	await db.run(`
		UPDATE tournaments
		SET isActive = 0
		WHERE id = ?
	`, [tournamentId]);
}


export async function finishTournament(tournamentId: number, winnerId: number) {
	const db = await getDB();
	await db.run(`
		UPDATE tournaments
		SET isActive = 0, winnerId = ?
		WHERE id = ?
	`, [winnerId, tournamentId]);
}
