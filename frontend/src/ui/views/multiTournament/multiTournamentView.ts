//testView.ts
import * as Actions from "../../../ws/ws-actions.js";
import { connectWebSocket } from "../../../ws/ws-client.js";

export async function TournamentView() {
	const app = document.getElementById("app");
	if (!app) return;

	sessionStorage.setItem("mode", "Tournament");
	app.innerHTML = getTournamentViewHTML();

	const userId = sessionStorage.getItem("userId");
	if (!userId) return;

	try {
		await connectWebSocket();
		Actions.setupTournamentCreation(userId);
		Actions.requestTournamentList(userId);
	} catch (err) {
		console.error("❌ WebSocket connection failed", err);
		const msg = document.getElementById("messages");
		if (msg) msg.innerText = "Erreur de connexion WebSocket.";
	}
}

function getTournamentViewHTML(): string {
	return `
	<div class="text-center mb-4" id="lobbySection">
		<h1 class="text-2xl font-bold text-green-400">Tournament</h1>
		<div id="tournamentContainer"></div>
		<div id="messages" class="mt-6 text-center"></div>
	</div>

	<div class="text-center space-y-6 mt-6 hidden" id="gameSection">
		<h2 id="tournamentTitle" class="text-xl font-bold text-white"></h2>
		<h3 id="roundTitle" class="text-md font-medium text-gray-400"></h3>
		<button id="startGameBtn" class="btn w-full max-w-xs mx-auto">Start Match</button>
		<div id="canvasWrapper" class="w-full max-w-[90vw] sm:max-w-[800px] mx-auto aspect-[2/1] border border-matrix bg-black">
			<canvas id="gameCanvas" class="w-full h-full" />
		</div>


		<!-- VICTORY SCREEN (Initially hidden) -->
		<div id="victoryScreen" class="hidden flex flex-col items-center mt-6 space-y-4">
			<h2 class="text-green-400 text-xl font-bold">🎉 You won this round!</h2>	
		</div>

		<!-- LOSE SCREEN (Initially hidden) -->
		<div id="loseScreen" class="hidden flex flex-col items-center mt-6 space-y-4">
			<h2 class="text-red-500 text-xl font-bold">😞 You lose this round</h2>
			<p id="finalScoreLose" class="text-white mb-4"></p>
		</div>

		<!-- WAITING MESSAGE (Initially hidden) -->
		<div id="waitingMessage" class="hidden flex flex-col items-center mt-4">
			<p class="glow text-center text-base">⏳ Waiting for opponent to finish...</p>
			<div class="blink-loader">
				<div class="blip"></div>
				<div class="blip"></div>
				<div class="blip"></div>
				<div class="blip"></div>
				<div class="blip"></div>
			</div>
		</div>

		<!-- TOURNAMENT WIN SCREEN (Initially hidden) -->
		<div id="tournamentWinScreen" class="hidden flex flex-col items-center mt-10 space-y-4">
			<h2 class="text-green-600 text-3xl font-bold">🏆 Congratulations, Champion!</h2>
			<p class="text-lg text-gray-700">You won the <span id="tournamentNameWinner" class="font-semibold"></span> tournament.</p>
			<button id="backToHomeBtn" class="btn bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded">
				Back to Home
			</button>
		</div>

	</div>
`;
}
