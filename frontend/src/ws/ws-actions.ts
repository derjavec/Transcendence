// ws-actions.ts
import { send, onMessage } from "./ws-client.js";
import { socket } from "./ws-client.js";
import { startGame, stopGame } from "../ui/render.js";
import { showForfeitModal, showConnectionErrorModal} from "../ui/drawCanvas.js";
import * as handler from "../ui/views/multiTournament/multiTournamentHandlers.js";


let latestState: any = null;
let isMatchmaking = false;
let gameStarted = false;
let resultSent = false;
let isForfeit = false;

export function getLatestState() {
	return latestState;
}

export function hasShownForfeit() {
	return isForfeit;
}

export function resetGameFlags() {
	latestState = null;
	isMatchmaking = false;
	gameStarted = false;
	resultSent = false;
	isForfeit = false;
}
  
onMessage(async (data) => {
	// console.log("🌐 Received websocket message:", data);
	if (data.type === "game:state") {
		latestState = data.payload;
		// console.log("📥 game:state received", latestState); //DEBUG

		const matchId = sessionStorage.getItem("matchId");
		const side = sessionStorage.getItem("side");
		const userId = sessionStorage.getItem("userId");
		const opponentId = sessionStorage.getItem("opponentId");

		const isOver = latestState.isGameOver;
		const score = latestState.score;
		
		if (isOver && !resultSent && matchId && userId && side) {
			const userScore = side === "left" ? score.left : score.right;
			const opponentScore = side === "left" ? score.right : score.left;
			const winnerId = userScore > opponentScore ? userId : opponentId;
			const loserId = userScore > opponentScore ? opponentId : userId;
			const winnerScore = Math.max(userScore, opponentScore);
			const loserScore = Math.min(userScore, opponentScore);

			resultSent = true;

			send("matchmaking:END_MATCH", { matchId, winnerId, loserId, winnerScore, loserScore });

			//console.log(`📤 Reported match result: ${winnerId} won over user ${loserId} (${winnerScore} - ${loserScore})`); 
			
		}
	}

	if (data.type === "matchmaking:matchFound") {
		isForfeit = false;
		isMatchmaking = false;
		const { matchId, side, opponentId } = data;
		console.log(`✅ Match found: ${matchId}, side: ${side}`);
		
		sessionStorage.setItem("matchId", matchId);
		sessionStorage.setItem("side", side);
		sessionStorage.setItem("opponentId", opponentId);
		
		send("matchmaking:GET_NAMES", { matchId });
		startGame();
	}
	if (data.type === "matchmaking:playerNames") {
		sessionStorage.setItem("player1", data.player1);
		sessionStorage.setItem("player2", data.player2);
		const mode = sessionStorage.getItem("mode");
		if (mode === "solo") 
			sessionStorage.setItem("player2", data.player1 + "_2");

		console.log(`🎮 Loaded players: ${data.player1} vs ${data.player2}`); //DEBUG
	}

	if (data.type === "matchmaking:forfeitStatus" && !isForfeit && data.isForfeit) {
		console.log("☠️ Opponent forfeited (checked from status)");
		const side = sessionStorage.getItem("side");
		const playerName = side === "left"
			? sessionStorage.getItem("player1") || "You"
			: sessionStorage.getItem("player2") || "You";
		const userId = sessionStorage.getItem("userId");
		sessionStorage.setItem("winner", String(userId));
		isForfeit = true;
		showForfeitModal(playerName);
	}

	if (data.type === "matchmaking:connectionError") {
		//const socket = new WebSocket("/ws");
		showConnectionErrorModal();
		const mode = sessionStorage.getItem("mode");
		if (mode === "Tournament")
			tournamentDisconnect(socket);
	}

	if (data.type === "tournament:created") {
		handler.handleTournamentCreated(data);
	}
	if (data.type === "tournament:listed") {
		handler.handleTournamentListed(data);
	}
	if (data.type === "tournament:registered") {
		handler.handleTournamentRegister(data);
	}
	if (data.type === "tournament:exists") {
		handler.handleTournamentExists(data);
	}
	if (data.type === "tournament:matches_generated") {
		handler.handleMatchesGenerated(data);
	}
	if (data.type === "tournament:finished") {
		handler.handleTournamentFinished(data);
	}
});

export async function joinMatchmaking(userId: number) {
	if (!userId) 
		throw new Error("Invalid userId");
	if (isMatchmaking) 
		return; // avoid double call if match already exists
	isMatchmaking = true;
	send("matchmaking:JOIN_MATCH", { userId });
	console.log("🟢 Sent matchmaking:JOIN_MATCH"); //DEBUG
}
  
export async function createSoloMatch(userId: number) {
	if (!userId) 
		throw new Error("Invalid userId");
	const mode = sessionStorage.getItem("mode");
    console.log(`🟢 Sending matchmaking:INIT_SOLO for userId: ${userId}, in mode ${mode}`); //DEBUG
	send("matchmaking:INIT_SOLO", { userId, mode });
	// console.log("🟢 Sent matchmaking:createSoloMatch"); //DEBUG
}

export function joinTournamentMatch(player1Id : string, player2Id : string) {
	send('matchmaking:JOIN_TOURNAMENT', {
		player1Id,
		player2Id
	});
}

export async function ResumeGame(canvas: HTMLCanvasElement) {
	const settings = JSON.parse(sessionStorage.getItem("settings") || "{}");

	const mode = sessionStorage.getItem("mode");
	let ballSpeed;
	let paddleSpeed;
	let paddleSize;
	let ballSize;

	if (mode === "1to1" || mode === "Tournament" ){
		ballSpeed = "NORMAL";
		paddleSpeed = "NORMAL";
		paddleSize = "SMALL";
		ballSize = "SMALL";
	}
	else {
		 	ballSpeed = settings.ballSpeed === "fast" ? "FAST" : "NORMAL";
			paddleSpeed = settings.paddleSpeed === "fast" ? "FAST" : "NORMAL";
			paddleSize = settings.paddleSize === "large" ? "LARGE" : "SMALL";
			ballSize = settings.ballSize === "large" ? "LARGE" : "SMALL";
	}
	const matchId = sessionStorage.getItem("matchId");
	const side = sessionStorage.getItem("side");

	const config = {
		ballSpeed,
		paddleSpeed,
		paddleSize,
		ballSize,
	};

	if (!gameStarted) {
		console.log("▶️ Sending START..."); //DEBUG
		if (matchId && (side || mode === "solo" || mode === "soloIA")) {
			send("game:start", { matchId, side, ...config});
			if (mode === 'soloIA'){
				send("AI:START", { matchId, ...config});
			}
		 }
		gameStarted = true;
	} else {
		console.log("⏯️ Sending RESUME..."); //DEBUG
		send("game:resume", { matchId, ...config });
		if (mode === 'soloIA')
			send("AI:RESUME", { matchId, ...config});
	}
}
export function resetIA(socket: WebSocket)
{
	if (socket?.readyState === WebSocket.OPEN) {
	  send("AI:RESET");
	}
}

export function gameDisconnect(socket: WebSocket) {
	const userId = sessionStorage.getItem("userId");
	if (socket?.readyState === WebSocket.OPEN) {
	  	send("game:disconnect", {});
		matchmakingDisconnect(socket);
	}
	
}

export function tournamentDisconnect(socket: WebSocket) {
	const userId = sessionStorage.getItem("userId");
	if (userId)
		send("tournament:disconnect", { userId });
}

export function matchmakingDisconnect(socket: WebSocket) {
	const userId = sessionStorage.getItem("userId");
	if (!resultSent && userId){
		send("matchmaking:DISCONNECT", { userId });}
}
  
export function sendPaddleMovement(side: string, position: number, socket: WebSocket) {
	socket.send(JSON.stringify({
		type: "game:paddleMove",
		side,
		position,
		matchId: sessionStorage.getItem("matchId")
	}));
}

export function checkForfeit() {
	if (!isForfeit) {
		send("matchmaking:IS_FORFEIT", {
			matchId: sessionStorage.getItem("matchId")
		});
	}
}

export function requestTournamentList(userId: string | number) {
    const numericUserId = Number(userId);
    send("tournament:list", { userId: numericUserId });
}


export function setupTournamentCreation(userId: string) {
    const button = document.getElementById("createTournamentBtn");
    if(!button)
        return;

    button.addEventListener("click", () => {
        const nameInput = document.getElementById("tournamentName") as HTMLInputElement;
        const select = document.getElementById("participantCount") as HTMLSelectElement;

        const name = nameInput?.value.trim();
        const participants = parseInt(select?.value || "4");

        if(!name) {
            alert("Please enter a name for this tournament");
            return;
        }
        send("tournament:create", {
            name,
            participants,
            userId,
        });
    });
}

export function sendTournamentRoundData() {
	const tournamentId = sessionStorage.getItem("tournamentId");
	const userId = sessionStorage.getItem("userId");
	const opponentId = sessionStorage.getItem("opponentId");
	const winnerId = Number(sessionStorage.getItem("winner"));
	const round = Number(sessionStorage.getItem("round"));
	const side = sessionStorage.getItem("side");

	if (!tournamentId || !userId || !opponentId || isNaN(winnerId) || isNaN(round) || !side ) {
		console.error("❌ Incomplete Data:", { tournamentId, userId, opponentId,  winnerId, round, side });
		return;
	}
	const player1Id = side === "left" ? userId : opponentId;
	const player2Id = side === "left" ? opponentId : userId;
	send("tournament:reportResult", {
		tournamentId,
		player1Id,
		player2Id,
		winnerId,
		round,
	});
}

