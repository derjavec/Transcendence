//render.ts
import { send, socket } from "../ws/ws-client.js";
import * as Actions from "../ws/ws-actions.js";
import * as Canvas from "./drawCanvas.js";

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

	if (mode === "tournament" && joinBtn) {
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

	updateGameButtons(() => {}, true);
	const mode = sessionStorage.getItem("mode");
	const settings = JSON.parse(sessionStorage.getItem("settings") || "{}");
	const paddleSize = settings.paddleSize || "small";
	if (mode === "solo" || mode === "soloIA") {
	  const btn = document.getElementById("startGameBtn") as HTMLButtonElement;
	  if (btn) {
		btn.textContent = "Game Started!";
		btn.disabled = true;
	  }
	}
	if (mode === "tournament") {
	  const btn = document.getElementById("joinMatchBtn") as HTMLButtonElement;
	  if (btn) {
		btn.textContent = "Match Started!";
		btn.disabled = true;
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
	resizeCanvas(canvas);
	await Actions.ResumeGame(canvas);
	send("game:getState", {});     

	window.addEventListener("resize", () => resizeCanvas(canvas));

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
	if (intervalId) {
		clearInterval(intervalId);
		intervalId = 0;
	}
	sessionStorage.removeItem("matchId");
	sessionStorage.removeItem("side");
	spaceListenerAdded = false;


	Actions.gameDisconnect(socket);
	Actions.resetGameFlags();
	console.log("🛑 Game stopped");
	const mode = sessionStorage.getItem("mode");
	const userId = Number(sessionStorage.getItem("userId"));
	const iaToggle = document.getElementById("iaToggle") as HTMLInputElement;
	if(iaToggle)
		iaToggle.disabled = false;
	updateGameButtons(async () => {
		console.log("🔄 Restarting game...");
		hasShownGameOver = false;
		isStarting = false;
		
			
		if (mode === "tournament")
			await Actions.joinMatchmaking(userId);
		else{
			const iaMode = iaToggle?.checked;
			sessionStorage.setItem("mode", iaMode ? "soloIA" : "solo");
			const mode =sessionStorage.getItem("mode");
			console.log("mode en stop :", mode);
			iaToggle.disabled = true;
			await Actions.createSoloMatch(userId);
		}
	}, false);
}

let lastScoreDifference = 0;
let justScored = false; 

async function updateGame(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, settings :any) {
	const rawState = Actions.getLatestState();
	if (!rawState) return;

	const state = scaleStateToCanvas(rawState, canvas, settings);

	if (state.isGameOver && !isStarting) {
		if (!hasShownGameOver) {
			clearInterval(intervalId);
			Canvas.drawGameOver(ctx, canvas, state);
			hasShownGameOver = true;
			stopGame();
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
	
	handlePaddleMovement(canvas, justScored);
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
	const paddleSize = settings.paddleSize;
	const paddleHeight = paddleSize === "large" ? canvas.height * 0.25 : canvas.height * 0.15;

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

function handlePaddleMovement(canvas: HTMLCanvasElement, justScored:boolean) {
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
export function resizeCanvas(canvas: HTMLCanvasElement) {
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
