// drawCanvas.ts
import { navigate } from "../router.js"

export function drawGameOver(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: any) {
	ctx.fillStyle = "#121212"; // pongDark
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	const centerX = canvas.width / 2;

	// Game Over
	ctx.font = "bold 20px 'Press Start 2P'";
	ctx.fillStyle = "#00FF41"; // matrix green
	ctx.textAlign = "center";
	ctx.fillText("🏆 GAME OVER", centerX, canvas.height / 2 - 40);

	// Scores
	const player1 = sessionStorage.getItem("player1") || "Left";
	const player2 = sessionStorage.getItem("player2") || "Right";
	ctx.font = "14px 'Press Start 2P'";
	ctx.fillStyle = "#E5E7EB"; // white
	ctx.fillText(`${player1}: ${state.score.left}  |  ${player2}: ${state.score.right}`, centerX, canvas.height / 2);

	// Restart message
	ctx.font = "12px 'Press Start 2P'";
	ctx.fillStyle = "#9CA3AF"; // pongGray
	ctx.fillText("PRESS START TO PLAY AGAIN", centerX, canvas.height / 2 + 40);
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
	const fontColor = settings.fontColor || "#00FF41";

	let paddleSize: string;
	let ballSizeSetting: string;
	if (mode === "tournament"){
		paddleSize = "small";
		ballSizeSetting = "small";
	}
	else{
		paddleSize = settings.paddleSize || "small";
		ballSizeSetting = settings.ballSize || "small";
	}
	if (!state?.ball || !state?.score || !state?.paddles) return;
	const { x: ballX, y: ballY } = state.ball;
	const { left: leftScore = 0, right: rightScore = 0 } = state.score;
	const paddleWidth = canvas.width * 0.0125;
	const paddleHeight =
		paddleSize === "large" ? canvas.height * 0.25 : canvas.height * 0.15;
	const leftPaddleX = canvas.width * 0.025;
	const rightPaddleX = canvas.width - paddleWidth - leftPaddleX;
	const ballRadius =
		ballSizeSetting === "large"
			? canvas.width * 0.0125
			: canvas.width * 0.00625;
	const BASE_HEIGHT = 359;
	const scaleFactor = canvas.height / BASE_HEIGHT;
	ctx.fillStyle = bgColor;
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = paddleColor;
	const side = sessionStorage.getItem("side");
	const distanceThreshold = 30; // margen de proximidad en píxeles

if (mode === "solo") {
	ctx.fillRect(leftPaddleX, leftPaddleY, paddleWidth, paddleHeight);
	ctx.fillRect(rightPaddleX, rightPaddleY, paddleWidth, paddleHeight);

	// if (Math.abs(ballX - leftPaddleX) <= distanceThreshold) {
	// 	console.log(
	// 		`🎾 canvas LEFT paddle: from y=${leftPaddleY}px to y=${leftPaddleY + paddleHeight}px ballY = ${ballY}px`
	// 	);
	// }

	// if (Math.abs(ballX - (rightPaddleX)) <= distanceThreshold) {
	// 	console.log(
	// 		`🎾canvas  RIGHT paddle (opponent): from y=${rightPaddleY}px to y=${rightPaddleY + paddleHeight}px ballY = ${ballY}px`
	// 	);
	// } //DEBUG
}
	else if (side === "left") {
		ctx.fillRect(leftPaddleX, leftPaddleY, paddleWidth, paddleHeight);
		ctx.fillRect(rightPaddleX, state.paddles.rightY, paddleWidth, paddleHeight); // oponente
	// 	if (Math.abs(ballX - leftPaddleX) <= distanceThreshold) {
	// 	console.log(
	// 		`🎾 canvas LEFT paddle: from y=${leftPaddleY}px to y=${leftPaddleY + paddleHeight}px ballY = ${ballY}px`
	// 	);
	// }
	// 	if (Math.abs(ballX - (rightPaddleX)) <= distanceThreshold) {
	// 	console.log(
	// 		`🎾canvas  RIGHT paddle (opponent): from y=${rightPaddleY}px to y=${rightPaddleY + paddleHeight}px ballY = ${ballY}px`
	// 	);
	// }

	} else if (side === "right") {
		ctx.fillRect(leftPaddleX, state.paddles.leftY, paddleWidth, paddleHeight); // oponente
		ctx.fillRect(rightPaddleX, rightPaddleY, paddleWidth, paddleHeight); // control local
	// 	if (Math.abs(ballX - (rightPaddleX)) <= distanceThreshold) {
	// 	console.log(
	// 		`🎾canvas  RIGHT paddle (opponent): from y=${rightPaddleY}px to y=${rightPaddleY + paddleHeight}px ballY = ${ballY}px`
	// 	);
	// }
	}
	ctx.beginPath();
	ctx.fillStyle = ballColor;
	ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
	ctx.fill();
	const player1 = sessionStorage.getItem("player1") || "Player1";
	const player2 = sessionStorage.getItem("player2") || "Player2";
	ctx.font = "12px 'Press Start 2P'";
	ctx.fillStyle = fontColor;
	ctx.textAlign = "left";
	ctx.fillText(`${player1}: ${leftScore}`, 20, 20);
	ctx.textAlign = "right";
	ctx.fillText(`${player2}: ${rightScore}`, canvas.width - 20, 20);
}

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

	document.getElementById("closeForfeitBtn")?.addEventListener("click", () => {
		modal.remove();
		navigate("/tournament"); 
	});
}