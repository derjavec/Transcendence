//tournamentHandlers.ts
import * as type from "./types.js"
import { socket } from "../../../ws/ws-client.js";
import * as Game from "../../../ws/ws-actions.js";
import { navigate } from "../../../router.js";
import { setupTournamentCreation } from "../../../ws/ws-actions.js";
import { homeView } from "../viewHome.js";

export function handleTournamentListed(message: any) {
	const container = document.getElementById("tournamentContainer");
	if (!container) return;

	const tournaments = message.tournaments;
	const userId = Number(sessionStorage.getItem("userId"));

	if (!tournaments || tournaments.length === 0) {
		container.innerHTML = `
			<div id="createTournamentSection" class="text-center">
				<h2 class="text-xl font-bold">Create tournament</h2>
				<input type="text" id="tournamentName" placeholder="Tournament name" class="input mt-2" />
				<select id="participantCount" class="input mt-2">
					${[4, 5, 6, 7, 8].map(n => `<option value="${n}">${n} participants</option>`).join("")}
				</select>
				<button id="createTournamentBtn" class="btn mt-4">Create tournament</button>
				<div id="creationFeedback" class="mt-2 text-green-400"></div>
			</div>
			<div class="text-center mt-4">
				<p class="text-gray-400">No active tournament.</p>
			</div>
		`;
		setupTournamentCreation(String(userId));
		return;
	}

	const tournament = tournaments[0];
	const registered = tournament.participantList.some((p: type.Participant) => p.userId === userId);
	const isRunning = tournament.status === "running";
	const isFull = tournament.participantList.length >= tournament.participants;

	container.innerHTML = `
		<div id="tournamentActiveSection" class="text-center">
			<h2 class="text-xl font-bold text-green-400">Active tournament</h2>
			<p><strong>Tournament :</strong> ${tournament.tournamentName}</p>
			<p><strong>Created by :</strong> ${tournament.creatorName}</p>
			<p><strong>Participants (${tournament.participantList.length}/${tournament.participants}) :</strong></p>
			<ul>
				${tournament.participantList.map((p: type.Participant) => `<li>${p.name || p.userId}</li>`).join("")}
			</ul>
			${isRunning ? `<p id="tournamentRunningMessage" class="text-yellow-400 mt-2">Tournament is running.</p>` : ""}
			${isFull && !registered && !isRunning
				? `<p id="tournamentFullMessage" class="text-red-400 mt-2">Tournament is full! Try again later.</p>`
				: ""
			}
			${!isRunning && (!isFull || registered) ? `
				<button id="joinTournamentBtn"
					class="btn mt-4"
					${registered ? "disabled" : ""}
					data-tournament-id="${tournament.id}">
					${registered ? "Already joined" : "Join"}
				</button>
			` : ""}
		</div>
	`;

	if (isRunning) {
		return;
	}

	const joinBtn = document.getElementById("joinTournamentBtn") as HTMLButtonElement | null;
	if (joinBtn) {
		joinBtn.addEventListener("click", () => {
			const joinMessage = {
				type: "tournament:join",
				tournamentId: tournament.id,
				userId,
			};
			socket.send(JSON.stringify(joinMessage));
		});
	}

	setupTournamentCreation(String(userId));
}

export function handleTournamentCreated(message: any) {
    // console.log("Message reçu pour tournoi créé :", message);//DEBUG

    // Mise à jour du bouton joinTournamentBtn
    const joinBtn = document.getElementById("joinTournamentBtn") as HTMLButtonElement;
    if (joinBtn) {
        const userId = Number(sessionStorage.getItem("userId"));
        const isRegistered = message.participantList.some((p: any) => p.userId === userId);

        joinBtn.disabled = isRegistered;
        joinBtn.textContent = isRegistered ? "Already joined" : "Join";
        joinBtn.setAttribute("data-tournament-id", message.id);
    }
    const createSection = document.getElementById("createTournamentSection");
    if (createSection) {
        createSection.style.display = "none";
    }

    const feedback = document.getElementById("creationFeedback");
    if (feedback) {
        feedback.innerHTML = `<h2 class="text-xl font-semibold text-green-400">✅ Tournament created</h2>`;
    }

    console.log("✅ Tournoi créé :", message);

	// Reutiliser la logique pour renderiser la liste de tournois
    handleTournamentListed({
        type: "tournament:listed",
        tournaments: [{
            id: message.id,
            tournamentName: message.name,
            creatorName: message.creatorName,
            participants: message.participants,
            participantList: message.participantList,
			status : message.status,
        }]
    });
}

export function handleTournamentExists(message: { message: string }) {
	alert(message.message);
	console.warn("Erreur tournoi :", message.message);
}

export function handleTournamentRegister(message: any) {
	//console.log("✅ Inscription confirmée :", message);

	const joinBtn = document.getElementById("joinTournamentBtn") as HTMLButtonElement;
	if (!joinBtn) 
		return;

	const userId = Number(sessionStorage.getItem("userId"));
	if (!userId) 
		return;
	sessionStorage.setItem("tournamentId", message.tournamentId);
	sessionStorage.setItem("tournamentName", message.tournamentName);
	sessionStorage.setItem("round", "1");
	const round = sessionStorage.getItem("round");
	if (Number(joinBtn.getAttribute("data-tournament-id")) === message.tournamentId) {
		joinBtn.disabled = true;
		joinBtn.textContent = "Already joined";
	}
	handleTournamentListed({
		type: "tournament:listed",
		tournaments: [{
			id: message.tournamentId,
			tournamentName: message.tournamentName,
			creatorName: message.creatorName,
			participants: message.participants,
			participantList: message.participantsList,
		}]
	});
}

export function handleMatchesGenerated(message: type.MatchesMessage): void {
	console.log(message);
	const { tournamentName, round, matches, byePlayer} = message;
	sessionStorage.setItem("round", String(round));
	const userId = Number(sessionStorage.getItem("userId"));
	const msgDiv = document.getElementById("messages");
	if (msgDiv) {
		const matchList = matches.map(
			(m) => `<li>${m.player1Id} vs ${m.player2Id ?? "BYE"}</li>`
		).join("");
		msgDiv.innerHTML = `
			<h3>Round ${round} - Matches generated </h3>
			<ul>${matchList}</ul>
			${byePlayer ? `<p>BYE: ${byePlayer.userId}</p>` : ""}
		`;
	}

	if (byePlayer && String(byePlayer.userId) === String(userId)) {
		const startBtn = document.getElementById("startGameBtn") as HTMLButtonElement;
		const canvasWrapper = document.getElementById("canvasWrapper");
		const waitingMessage = document.getElementById("waitingMessage");
		const gameSection = document.getElementById("gameSection");
		const lobbySection = document.getElementById("lobbySection");
		
		const tournamentTitle = document.getElementById("tournamentTitle");
		if (tournamentTitle) {
			tournamentTitle.textContent = `Tournament: ${sessionStorage.getItem("tournamentName") || "Unknown"}`;
		}

		const round = Number(sessionStorage.getItem("round") || "1");
		const nextRound = round + 1;
		sessionStorage.setItem("round", String(nextRound));
		const roundTitle = document.getElementById("roundTitle");
		if (roundTitle) {
			roundTitle.textContent = `Round ${nextRound}`;
		}

		if (startBtn) startBtn.classList.add("hidden");
		if (lobbySection) lobbySection.classList.add("hidden");
		if (canvasWrapper) canvasWrapper.classList.add("hidden");
		if (gameSection) gameSection.classList.remove("hidden");
		if (waitingMessage) waitingMessage.classList.remove("hidden");
	
		console.log(`🚨 You (${userId}) have a BYE this round. Waiting...`);
		return;
	}
	

	for (const match of matches) {
		const isMyMatch = match.player1Id === userId || match.player2Id === userId;
		if (isMyMatch) {
			Game.joinTournamentMatch(String(match.player1Id), String(match.player2Id));
			break;
	}
}
}

export function handleTournamentFinished(message: any) {
	const { tournamentName, winnerId } = message;
	const userId = sessionStorage.getItem("userId");
	const mode = sessionStorage.getItem("mode");
	if (String(winnerId) === String(userId)) {
		document.getElementById("canvasWrapper")?.classList.add("hidden");
		document.getElementById("gameSection")?.classList.remove("hidden");
		document.getElementById("lobbySection")?.classList.add("hidden");
		document.getElementById("waitingMessage")?.classList.add("hidden");
		document.getElementById("startGameBtn")?.classList.add("hidden");
		document.getElementById("tournamentWinScreen")?.classList.remove("hidden");

		const nameSpan = document.getElementById("tournamentNameWinner");
		if (nameSpan) {
			nameSpan.textContent = tournamentName;
		}

		const backBtn = document.getElementById("backToHomeBtn");
		if (backBtn) {
			backBtn.addEventListener("click", () => {
				homeView();
			});
		}
	} else if (mode === "Tournament") {
		navigate("/Tournament");
	}
}

