//render.ts
import { socket } from "../ws/ws-client.js";
import * as Actions from "../ws/ws-actions.js";
import * as Canvas from "./drawCanvas.js";
import { homeView } from "./views/viewHome.js";
import { lockScroll, unlockScroll } from "./utils-lockScroll.js";

let isNewGame = true;
let intervalId: number;
let leftPaddleY: number;
let rightPaddleY: number;
let spaceListenerAdded = false;
let hasShownGameOver = false;
let isStarting = false;
const BASE_WIDTH = 719;
const BASE_HEIGHT = 359;

const pressedKeys = new Set<string>();

export function updateGameButtons(
	onClick: () => void,
	isMatchStarted: boolean,
	pendingLabel?: string
) {
	const mode = sessionStorage.getItem("mode");
	const btn = document.getElementById("startGameBtn") as HTMLButtonElement;
	const joinBtn = document.getElementById("joinMatchBtn") as HTMLButtonElement;

	const label = isMatchStarted
		? "Game Started!"
		: hasShownGameOver
		? "New Game"
		: "Start Game";

	if (btn) {
		btn.textContent = pendingLabel || label;
		btn.disabled = isMatchStarted;
		btn.onclick = onClick;
	}

	if (mode === "1to1" && joinBtn) {
		const btnLabel = (pendingLabel || label).replace("Game", "Match");
		joinBtn.textContent = btnLabel;
		joinBtn.disabled = isMatchStarted;
		joinBtn.onclick = onClick;
	}
}


export async function startGame() {
	hasShownGameOver = false;
	isNewGame = true;
	isStarting = true;
	console.log("GAME STARTING...");
	lockScroll();

	updateGameButtons(() => {}, true);
	const mode = sessionStorage.getItem("mode");
	const settings = JSON.parse(sessionStorage.getItem("settings") || "{}");
	const canvasWrapper = document.getElementById("canvasWrapper");
	if (canvasWrapper) canvasWrapper.classList.remove("hidden");	
	if (mode === "solo" || mode === "soloIA") {	
		const btn = document.getElementById("startGameBtn") as HTMLButtonElement;
		if (btn) {
			btn.textContent = "Game Started!";
			btn.disabled = true;
		}
	}
	if (mode === "1to1") {
		const btn = document.getElementById("joinMatchBtn") as HTMLButtonElement;
		if (btn) {
		btn.textContent = "Match Started!";
		btn.disabled = true;
	  }
	}

	if (mode === "Tournament") {
		const tournamentName = sessionStorage.getItem("tournamentName") || "Tournament";
		const round = sessionStorage.getItem("round") || "1";

		const container = document.getElementById("tournamentContainer");
		if (container) container.classList.add("hidden");

		const messages = document.getElementById("messages");
		if (messages) messages.innerHTML = "";

		const waitingMsg = document.getElementById("waitingMessage");
		if (waitingMsg) waitingMsg.classList.add("hidden");

		const gameSection = document.getElementById("gameSection");
		if (gameSection) {
			gameSection.classList.remove("hidden");

			const tournamentTitle = document.getElementById("tournamentTitle");
			if (tournamentTitle) tournamentTitle.textContent = tournamentName;

			const roundTitle = document.getElementById("roundTitle");
			if (roundTitle) roundTitle.textContent = `Round ${round}`;

			const startBtn = document.getElementById("startGameBtn") as HTMLButtonElement;
			if (startBtn) startBtn.classList.add("hidden");
			
		}
	}

	if (intervalId) {
		clearInterval(intervalId);
	}

	isStarting = false; 

	const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
	if (!canvas)
		return;
	const ctx = canvas.getContext("2d");
	if (!ctx)
		return;
	resizeCanvas(ctx, canvas);
	await Actions.ResumeGame(canvas);

	window.addEventListener("resize", () => resizeCanvas(ctx, canvas));

	document.addEventListener("keydown", (event) => {
		pressedKeys.add(event.key);
	});
	
	document.addEventListener("keyup", (event) => {
		pressedKeys.delete(event.key);
	});

	if (!spaceListenerAdded) {
		document.addEventListener("keydown", async (event) => {
			if (event.code === "Space") {
				if (!sessionStorage.getItem("matchId")) 
					return;
				const state = Actions.getLatestState();
				if (state?.isPaused)
					await Actions.ResumeGame(canvas);
			}
		});
		spaceListenerAdded = true;
	}
	intervalId = setInterval(() =>updateGame(ctx, canvas, settings), 1000 / 60);
}

export function stopGame() {
	unlockScroll();
	const mode = sessionStorage.getItem("mode");
	const canvasWrapper = document.getElementById("canvasWrapper");	
	if (canvasWrapper)
		canvasWrapper.classList.add("hidden");

	if (mode === "Tournament") {
		const userId = Number(sessionStorage.getItem("userId"));
		let winnerId = sessionStorage.getItem("winner");
		const startBtn = document.getElementById("startGameBtn") as HTMLButtonElement;
		const victoryScreen = document.getElementById("victoryScreen");
		const loseScreen = document.getElementById("loseScreen");
		const waitingMessage = document.getElementById("waitingMessage");
		if (waitingMessage) {
			waitingMessage.classList.add("hidden");}
		if (startBtn) startBtn.classList.remove("hidden");
		if (userId === Number(winnerId)) {
			if (victoryScreen) victoryScreen.classList.remove("hidden");
			if (loseScreen)loseScreen.classList.add("hidden");
			
			updateGameButtons(() => {
				Actions.sendTournamentRoundData();
				sessionStorage.removeItem("matchId");
				sessionStorage.removeItem("side");
				let round = sessionStorage.getItem("round");
				const nextRound = Number(round || "1") + 1;
				const roundTitle = document.getElementById("roundTitle");
				if (roundTitle) {
					roundTitle.textContent = `Round ${nextRound}`;
				}
				sessionStorage.setItem("round", String(nextRound));
				if (canvasWrapper) canvasWrapper.classList.add("hidden");
				if (startBtn) startBtn.classList.add("hidden");
				if (victoryScreen) victoryScreen.classList.add("hidden");
				if (loseScreen) loseScreen.classList.add("hidden");
				if (waitingMessage) waitingMessage.classList.remove("hidden");				
				sessionStorage.removeItem("winner");
				winnerId = null;
			}, false, "Continue");			
		} else {
			sessionStorage.removeItem("matchId");
			sessionStorage.removeItem("side");
			if (loseScreen)loseScreen.classList.remove("hidden");		
			if (victoryScreen)victoryScreen.classList.add("hidden");
			
			updateGameButtons(() => {
				hasShownGameOver = false;
				isStarting = false;
				homeView();
			}, false, "Back to Home");
		}
	} else {
		sessionStorage.removeItem("matchId");
		sessionStorage.removeItem("side");
		updateGameButtons(async () => {
			console.log("🔄 Restarting game...");
			hasShownGameOver = false;
			isStarting = false;

			const userId = Number(sessionStorage.getItem("userId"));
			const iaToggle = document.getElementById("iaToggle") as HTMLInputElement;
			if (iaToggle)
				iaToggle.disabled = false;

			if (mode === "1to1") {
				updateGameButtons(() => {}, true, "Searching for opponent...");
				await Actions.joinMatchmaking(userId);
			} else {
				const iaMode = iaToggle?.checked;
				sessionStorage.setItem("mode", iaMode ? "soloIA" : "solo");
				iaToggle.disabled = true;
				await Actions.createSoloMatch(userId);
			}
		}, false);
	}

	if (intervalId) {
		clearInterval(intervalId);
		intervalId = 0;
	}
	spaceListenerAdded = false;

	Actions.gameDisconnect(socket);
	Actions.resetGameFlags();
	console.log("🛑 Game stopped");
}



let lastScoreDifference = 0;
let justScored = false; 

async function updateGame(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, settings :any) {
	const rawState = Actions.getLatestState();
	if (!rawState) 
		return;
	const state = scaleStateToCanvas(rawState, canvas, settings);
	if (state.isGameOver && !isStarting) {
		if (!hasShownGameOver) {
			clearInterval(intervalId);
			const userId = Number(sessionStorage.getItem("userId"));
			const side = sessionStorage.getItem("side");
			const myScore = side === "left" ? state.score.left : state.score.right;
	
			if (myScore === 5) 
				sessionStorage.setItem("winner", String(userId));

			 Canvas.drawGameOver(canvas,state);
			hasShownGameOver = true;
			stopGame();
			const mode = sessionStorage.getItem("mode");
			const winner = sessionStorage.getItem("winner");
			if (mode === "Tournament" && !winner){
				Actions.tournamentDisconnect(socket);}
		}
		return;
	}
	
	if (!Actions.hasShownForfeit())
		await Actions.checkForfeit();

	const scoreDifference = state.score.right - state.score.left;

	if (scoreDifference !== lastScoreDifference) {
		lastScoreDifference = scoreDifference;
		justScored = true;
		if (sessionStorage.getItem("mode") === "soloIA")
			Actions.resetIA(socket);
	} else {
		justScored = false;
	}
	const isPaused = state.isPaused;
	handlePaddleMovement(canvas, justScored, isPaused);
	Canvas.drawGame(ctx, canvas, state, settings, leftPaddleY, rightPaddleY);
}

function scaleStateToCanvas(state: any, canvas: HTMLCanvasElement, settings :any) {

	if (BASE_HEIGHT === canvas.height && BASE_WIDTH === canvas.width)
		return state;
	const scaleX = canvas.width / BASE_WIDTH;
	const scaleY = canvas.height / BASE_HEIGHT;

	const velocityScale = canvas.width / BASE_WIDTH;

	const scaledLeftY = state.paddles.leftY * scaleY;
	const scaledRightY = state.paddles.rightY * scaleY;

	return {
		...state,
		ball: {
			...state.ball,
			x: state.ball.x * scaleX,
			y: state.ball.y * scaleY,
			dx: state.ball.dx * velocityScale,
			dy: state.ball.dy * velocityScale,
		},
		paddles: {
			leftY: scaledLeftY,
			rightY: scaledRightY,
		},
	};
	
}

function handlePaddleMovement(canvas: HTMLCanvasElement, justScored:boolean, isPaused:boolean) {
    const settings = JSON.parse(sessionStorage.getItem("settings") || "{}");
    const paddleSpeed = settings.paddleSpeed || "normal";
    const step = paddleSpeed === "fast" ? canvas.height * 0.04 : canvas.height * 0.025;
	const paddleSize = settings.paddleSize || "small";
	const paddleHeight = paddleSize === "large" ? canvas.height * 0.25 : canvas.height * 0.15;

    let side = sessionStorage.getItem("side");
	if (!side) return; 
	const mode = sessionStorage.getItem("mode");
	if ( isNewGame ||
	justScored === true ||
	typeof leftPaddleY !== 'number' || Number.isNaN(leftPaddleY) ||
	typeof rightPaddleY !== 'number' || Number.isNaN(rightPaddleY) ||
	leftPaddleY === undefined || rightPaddleY === undefined
	){
			leftPaddleY = canvas.height / 2 - paddleHeight / 2;
			rightPaddleY = canvas.height / 2 - paddleHeight / 2;
			isNewGame = false; 
	}
    function sendScaledPaddlePosition(side: string, paddleY: number) {
		const scaledY = paddleY * (BASE_HEIGHT / canvas.height);
		Actions.sendPaddleMovement(side, scaledY, socket);
	}
	if (isPaused){
		return;
	}
	if (side === "left") {
		if (pressedKeys.has("w") || pressedKeys.has("W")) {
			leftPaddleY = Math.max(0, leftPaddleY - step);
			sendScaledPaddlePosition(side, leftPaddleY);
		}
		if (pressedKeys.has("s") || pressedKeys.has("S")) {
			leftPaddleY = Math.min(canvas.height - paddleHeight, leftPaddleY + step);
			sendScaledPaddlePosition(side, leftPaddleY);
		}
	}

	if (side === "right" || mode === "solo") {
		if (mode === "solo") side = "right";

		if (pressedKeys.has("ArrowUp")) {
			rightPaddleY = Math.max(0, rightPaddleY - step);
			sendScaledPaddlePosition(side, rightPaddleY);
		}
		if (pressedKeys.has("ArrowDown")) {
			rightPaddleY = Math.min(canvas.height - paddleHeight, rightPaddleY + step);
			sendScaledPaddlePosition(side, rightPaddleY);
		}
	}
}

let lastCanvasWidth = 719;
let lastCanvasHeight = 359;
export function resizeCanvas(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
	const container = canvas.parentElement;
	if (container) {
		canvas.width = container.clientWidth;
		canvas.height = container.clientHeight;
	}
	if (canvas.width === lastCanvasWidth && canvas.height === lastCanvasHeight)
			return ;
	const scaleFactor = canvas.height / lastCanvasHeight;
	lastCanvasWidth = canvas.width;
	lastCanvasHeight = canvas.height;

		leftPaddleY = leftPaddleY * scaleFactor;
		rightPaddleY = rightPaddleY * scaleFactor;
};
