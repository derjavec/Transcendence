// matchinfo.ts

export interface MatchEntry {
  matchId: string;
  created_at: string;
  mode: "solo" | "tournament";
  opponent: string;
  result: "win" | "loss" | "forfeit";
  score: string;
}

export function showMatchHistoryModal(matches: MatchEntry[]) {
  const modal = document.createElement("div");
  modal.className = "fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center";

  const tableHTML = `
    <div class="bg-pongDark2 border border-matrix p-6 rounded w-full max-w-3xl text-white">
      <h2 class="text-lg text-center glow mb-4">📜 Match History</h2>
      <div class="overflow-x-auto max-h-[60vh] overflow-y-auto">
        <table class="table-auto w-full text-left border-collapse">
          <thead class="text-matrix border-b border-matrix">
            <tr>
              <th class="px-2 py-1">Date</th>
              <th class="px-2 py-1">Mode</th>
              <th class="px-2 py-1">Opponent</th>
              <th class="px-2 py-1">Result</th>
              <th class="px-2 py-1">Score</th>
            </tr>
          </thead>
          <tbody>
            ${matches.map(match => `
              <tr class="border-b border-pongGray hover:bg-pongMid">
                <td class="px-2 py-1">${new Date(match.created_at).toLocaleDateString()}</td>
                <td class="px-2 py-1">${match.mode}</td>
                <td class="px-2 py-1">${match.opponent}</td>
                <td class="px-2 py-1 ${match.result === 'win' ? 'text-green-400' : match.result === 'loss' ? 'text-red-400' : 'text-yellow-300'}">${match.result}</td>
                <td class="px-2 py-1">${match.score}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
      <div class="text-center mt-4">
        <button class="btn" id="closeModalBtn">Close</button>
      </div>
    </div>`;

  modal.innerHTML = tableHTML;
  document.body.appendChild(modal);

  document.getElementById("closeModalBtn")?.addEventListener("click", () => {
    modal.remove();
  });
}
