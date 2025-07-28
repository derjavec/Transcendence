// drawCanvas.ts
import { navigate } from "../router.js"
import * as render from "./render.js"

export function drawGameOver(canvas: HTMLCanvasElement, state: any) {
	const mode = sessionStorage.getItem("mode");
	const canvasWrapper = document.getElementById("canvasWrapper");
	if (canvasWrapper) canvasWrapper.classList.add("hidden");
	if (mode === "Tournament"){
		if (state.winnerId === sessionStorage.getItem("userId")) {
			document.getElementById("victoryScreen")?.classList.remove("hidden");
		} else {
			document.getElementById("loseScreen")?.classList.remove("hidden");
		}
	}
	if (mode === "solo" || mode === "soloIA"){
		const iaToggle = document.getElementById("iaToggle") as HTMLInputElement;
		if (iaToggle) {
			iaToggle.checked = mode === "soloIA";
			iaToggle.disabled = false;
		}
	}
	showGameOverModal(state);
}


export function drawGame(
	ctx: CanvasRenderingContext2D,
	canvas: HTMLCanvasElement,
	state: any,
	settings: any,
	leftPaddleY: number,
	rightPaddleY: number
) {
	const mode = sessionStorage.getItem("mode");

	const bgColor = settings.bgColor || "#121212";
	const paddleColor = settings.paddleColor || "#E5E7EB";
	const ballColor = settings.ballColor || "#E5E7EB";
	const fontColor = settings.fontColor || "#E5E7EB";

	let paddleSize: string;
	let ballSizeSetting: string;
	if (mode === "1to1" || mode === "Tournament" ){
		paddleSize = "small";
		ballSizeSetting = "small";
	} else {
		paddleSize = settings.paddleSize || "small";
		ballSizeSetting = settings.ballSize || "small";
	}

	if (!state?.ball || !state?.score || !state?.paddles) return;

	const { x: ballX, y: ballY } = state.ball;
	const { left: leftScore = 0, right: rightScore = 0 } = state.score;

	const borderWidth = 2;
	const paddleWidth = canvas.width * 0.0125;
	const paddleHeight =
		paddleSize === "large" ? canvas.height * 0.25 : canvas.height * 0.15;
	// const leftPaddleX = canvas.width * 0.0125;
	// const rightPaddleX = canvas.width - paddleWidth - leftPaddleX;
	const leftPaddleX = borderWidth;
	const rightPaddleX = canvas.width - borderWidth - paddleWidth;
	const ballRadius =
		ballSizeSetting === "large"
			? canvas.width * 0.0125
			: canvas.width * 0.00625;

	const side = sessionStorage.getItem("side");

	// 🔍 DEBUG: Logs solo cuando la bola está cerca del paddle
	const threshold = 30;

	if (Math.abs(ballX - leftPaddleX) <= threshold) {
		console.log(` ⬅️ Cerca del paddle izquierdo`);
		console.log(` 🎾 Ball position: x=${ballX}, y=${ballY}`);
		console.log(` 🪵 Paddle izquierdo: x=${leftPaddleX}, y=${state.paddles.leftY}`);
		console.log(` 📏 Rango Y paddle izquierdo: ${state.paddles.leftY} → ${state.paddles.leftY+ paddleHeight}`);
	}

	if (Math.abs(ballX - rightPaddleX) <= threshold) {
		console.log(` ➡️ Cerca del paddle derecho`);
		console.log(` 🎾 Ball position: x=${ballX}, y=${ballY}`);
		console.log(` 🪵 Paddle derecho: x=${rightPaddleX}, y=${state.paddles.rightY}`);
		console.log(` 📏 Rango Y paddle derecho: ${state.paddles.rightY} → ${state.paddles.rightY + paddleHeight}`);
	}

	// background
	ctx.fillStyle = bgColor;
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = paddleColor;

	
	// ctx.fillRect(0, 0, borderWidth, canvas.height); // left border
	// ctx.fillRect(canvas.width - borderWidth, 0, borderWidth, canvas.height); // right border

	// middle dashed line
	const dashHeight = 10;
	const dashGap = 15;
	for (let y = 0; y < canvas.height; y += dashHeight + dashGap) {
		ctx.fillRect(canvas.width / 2 - 1, y, 2, dashHeight);
	}

	if (mode === "solo") {
		ctx.fillRect(leftPaddleX, leftPaddleY, paddleWidth, paddleHeight);
		ctx.fillRect(rightPaddleX, rightPaddleY, paddleWidth, paddleHeight);
	} else if (side === "left") {
		ctx.fillRect(leftPaddleX, leftPaddleY, paddleWidth, paddleHeight);
		ctx.fillRect(rightPaddleX, state.paddles.rightY, paddleWidth, paddleHeight);
	} else if (side === "right") {
		ctx.fillRect(leftPaddleX, state.paddles.leftY, paddleWidth, paddleHeight);
		ctx.fillRect(rightPaddleX, rightPaddleY, paddleWidth, paddleHeight);
	}

	// ball
	ctx.beginPath();
	ctx.fillStyle = ballColor;
	ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
	ctx.fill();

	// scores
	const player1 = sessionStorage.getItem("player1") || "Player1";
	const player2 = sessionStorage.getItem("player2") || "Player2";
	ctx.font = "12px 'Press Start 2P'";
	ctx.fillStyle = fontColor;
	ctx.textAlign = "left";
	ctx.fillText(`${player1}: ${leftScore}`, 20, 20);
	ctx.textAlign = "right";
	ctx.fillText(`${player2}: ${rightScore}`, canvas.width - 20, 20);
}

// export function drawGame(
// 	ctx: CanvasRenderingContext2D,
// 	canvas: HTMLCanvasElement,
// 	state: any,
// 	settings: any,
// 	leftPaddleY: number,
// 	rightPaddleY: number
// ) {
// 	const mode = sessionStorage.getItem("mode");

// 	const bgColor = settings.bgColor || "#121212";
// 	const paddleColor = settings.paddleColor || "#E5E7EB";
// 	const ballColor = settings.ballColor || "#E5E7EB";
// 	const fontColor = settings.fontColor || "#00FF41";

// 	let paddleSize: string;
// 	let ballSizeSetting: string;
// 	if (mode === "tournament" || mode === "multiTournament" ){
// 		paddleSize = "small";
// 		ballSizeSetting = "small";
// 	}
// 	else{
// 		paddleSize = settings.paddleSize || "small";
// 		ballSizeSetting = settings.ballSize || "small";
// 	}
// 	//console.log("mode ", mode, "paddle size ", paddleSize, "ballSize ", ballSizeSetting);
// 	if (!state?.ball || !state?.score || !state?.paddles) return;
// 	const { x: ballX, y: ballY } = state.ball;
// 	const { left: leftScore = 0, right: rightScore = 0 } = state.score;
// 	const paddleWidth = canvas.width * 0.0125;
// 	const paddleHeight =
// 		paddleSize === "large" ? canvas.height * 0.25 : canvas.height * 0.15;
// 	console.log("paddle height ", paddleHeight);
// 	const leftPaddleX = canvas.width * 0.025;
// 	const rightPaddleX = canvas.width - paddleWidth - leftPaddleX;
// 	const ballRadius =
// 		ballSizeSetting === "large"
// 			? canvas.width * 0.0125
// 			: canvas.width * 0.00625;
// 	ctx.fillStyle = bgColor;
// 	ctx.fillRect(0, 0, canvas.width, canvas.height);
// 	ctx.fillStyle = paddleColor;
// 	const side = sessionStorage.getItem("side");

// 	if (mode === "solo") {
// 		ctx.fillRect(leftPaddleX, leftPaddleY, paddleWidth, paddleHeight);
// 		ctx.fillRect(rightPaddleX, rightPaddleY, paddleWidth, paddleHeight);
// 	}
// 	else if (side === "left") {
// 		ctx.fillRect(leftPaddleX, leftPaddleY, paddleWidth, paddleHeight);
// 		ctx.fillRect(rightPaddleX, state.paddles.rightY, paddleWidth, paddleHeight);

// 	} else if (side === "right") {
// 		ctx.fillRect(leftPaddleX, state.paddles.leftY, paddleWidth, paddleHeight);
// 		ctx.fillRect(rightPaddleX, rightPaddleY, paddleWidth, paddleHeight);
// 	}
// 	ctx.beginPath();
// 	ctx.fillStyle = ballColor;
// 	ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
// 	ctx.fill();
// 	const player1 = sessionStorage.getItem("player1") || "Player1";
// 	const player2 = sessionStorage.getItem("player2") || "Player2";
// 	ctx.font = "12px 'Press Start 2P'";
// 	ctx.fillStyle = fontColor;
// 	ctx.textAlign = "left";
// 	ctx.fillText(`${player1}: ${leftScore}`, 20, 20);
// 	ctx.textAlign = "right";
// 	ctx.fillText(`${player2}: ${rightScore}`, canvas.width - 20, 20);
// }

export function showForfeitModal(winnerName: string) {
	const modal = document.createElement("div");
	modal.className = "fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center";

	modal.innerHTML = `
		<div class="bg-pongDark2 border border-matrix p-6 rounded text-white w-[90%] max-w-md text-center">
			<h2 class="text-matrix text-lg glow mb-4">☠ Match Forfeited</h2>
			<p class="text-pongGray mb-2">The match ended due to disconnection.</p>
			<p class="text-white mt-2">🏆 <strong>Winner:</strong> ${winnerName}</p>
			<button id="closeForfeitBtn" class="btn mt-4">Close</button>
		</div>
	`;

	document.body.appendChild(modal);

	document.getElementById("closeForfeitBtn")?.addEventListener("click", async () => {
		modal.remove();
		await render.stopGame();
	});
}

export function showGameOverModal(state: any) {
	const player1 = sessionStorage.getItem("player1") || "Left";
	const player2 = sessionStorage.getItem("player2") || "Right";

	const modal = document.createElement("div");
	modal.className = "fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center";

	modal.innerHTML = `
		<div class="bg-pongDark2 border border-matrix p-6 rounded text-white w-[90%] max-w-md text-center">
			<h2 class="text-matrix text-xl font-bold glow mb-4">🏆 GAME OVER</h2>
			<p class="text-white mb-2">${player1}: ${state.score.left} | ${player2}: ${state.score.right}</p>
			<button id="closeGameOverBtn" class="btn mt-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
				Close
			</button>
		</div>
	`;

	document.body.appendChild(modal);

	document.getElementById("closeGameOverBtn")?.addEventListener("click", () => {
		modal.remove();
	});
}

export function showConnectionErrorModal() {
	const modal = document.createElement("div");
	modal.className = "fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center";

	modal.innerHTML = `
		<div class="bg-pongDark2 border border-matrix p-6 rounded text-white w-[90%] max-w-md text-center">
			<h2 class="text-matrix text-lg glow mb-4">⚠️ Connection Error</h2>
			<p class="text-pongGray mb-2">There was a connection error during your tournament match.</p>
			<p class="text-white mt-2">We apologize for the inconvenience.</p>
			<button id="closeConnectionErrorBtn" class="btn mt-4">Close</button>
		</div>
	`;

	document.body.appendChild(modal);

	document.getElementById("closeConnectionErrorBtn")?.addEventListener("click", async () => {
		modal.remove();
		await render.stopGame();
		navigate("/");
	});
}

