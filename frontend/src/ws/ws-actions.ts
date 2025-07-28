// ws-actions.ts
import { send, onMessage } from "./ws-client.js";
import { startGame, stopGame } from "../ui/render.js";
import { showForfeitModal } from "../ui/drawCanvas.js";

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
		//console.log("📥 game:state received", latestState); //DEBUG

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

			send("matchmaking:gameOver", { matchId, winnerId, loserId, winnerScore, loserScore });

			console.log(`📤 Reported match result: ${winnerId} won over user ${loserId} (${winnerScore} - ${loserScore})`);
			
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
		
		send("matchmaking:getPlayerNames", { matchId });
		startGame();
	}
	if (data.type === "matchmaking:playerNames") {
		sessionStorage.setItem("player1", data.player1);
		sessionStorage.setItem("player2", data.player2);
		const mode = sessionStorage.getItem("mode");
		if (mode === "solo") 
			sessionStorage.setItem("player2", data.player1 + "_2");

		//console.log(`🎮 Loaded players: ${data.player1} vs ${data.player2}`); //DEBUG
	}

	if (data.type === "matchmaking:forfeitStatus" && !isForfeit && data.isForfeit) {
		console.log("☠️ Opponent forfeited (checked from status)");
		const side = sessionStorage.getItem("side");
		const playerName = side === "left"
			? sessionStorage.getItem("player1") || "You"
			: sessionStorage.getItem("player2") || "You";
		stopGame();
		isForfeit = true;
		showForfeitModal(playerName);
	}

});

export async function joinMatchmaking(userId: number) {
	if (!userId) 
		throw new Error("Invalid userId");
	if (isMatchmaking) 
		return; // avoid double call if match already exists
	isMatchmaking = true;
	send("matchmaking:join", { userId });
	console.log("🟢 Sent matchmaking:join");
}
  
export async function createSoloMatch(userId: number) {
	if (!userId) 
		throw new Error("Invalid userId");
    console.log("🟢 Sending matchmaking:createSoloMatch for userId:", userId);
	send("matchmaking:createSoloMatch", { userId });
	console.log("🟢 Sent matchmaking:createSoloMatch");
}
export async function ResumeGame(canvas: HTMLCanvasElement) {
	const settings = JSON.parse(sessionStorage.getItem("settings") || "{}");

	const mode = sessionStorage.getItem("mode");
	let ballSpeed;
	let paddleSpeed;
	let paddleSize;
	let ballSize;

	if (mode === "tournament"){
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
		console.log("▶️ Sending START...");
		if (matchId && (side || mode === "solo" || mode === "soloIA")) {
			send("game:start", { matchId, side, ...config});
			if (mode === 'soloIA'){
				send("IA:START", { matchId, ...config});
			}
		 }
		gameStarted = true;
	} else {
		console.log("⏯️ Sending RESUME...");
		send("game:resume", { matchId, ...config });
		if (mode === 'soloIA')
			send("IA:RESUME", { matchId, ...config});
	}
}
export function resetIA(socket: WebSocket)
{
	if (socket?.readyState === WebSocket.OPEN) {
	  send("IA:RESET");
	}
}

export function gameDisconnect(socket: WebSocket) {
	const userId = sessionStorage.getItem("userId");
	if (socket?.readyState === WebSocket.OPEN) {
	  	send("game:disconnect", {});
		if (!resultSent)
			send("matchmaking:disconnect", { userId });
	}
}
  
export function sendPaddleMovement(side: string, position: number, socket: WebSocket) {
	socket.send(JSON.stringify({
		type: "game:paddleMove",
		side,
		position
	}));
}

export function checkForfeit() {
	if (!isForfeit) {
		send("matchmaking:isForfeit", {
			matchId: sessionStorage.getItem("matchId")
		});
	}
}