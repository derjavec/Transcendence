// friends routes 

import { 
	FriendRequest, 
	UserStats, 
	UserSearchResult, 
	RemoveFriendPayload
} from "../types/models";

let friendsRefreshIntervalId: number | undefined;

// Fonction pour charger la liste d'amis
export async function loadFriendsList() {
	const userId = Number(sessionStorage.getItem("userId"));
	const friendsListElement = document.getElementById("friendsList");
	if (!friendsListElement) return;
	
	try {
	  	const response = await fetch(`/api/friends/search/${userId}`, {
			method: "GET",
			headers: {
				"Authorization": `Bearer ${sessionStorage.getItem("authToken")}`, 
				"Content-Type": "application/json"
			}
	  	});
		// console.log("Response:", response); // DEBUG

		if (!response.ok) {
			throw new Error(`Failed to load friends list: ${response.status}`);
		}
		
		const responseData = await response.json();
		
		const friends: UserSearchResult[] = Array.isArray(responseData) ? responseData : [];

		// console.log("Friends data:", friends); //DEBUG

		if (friends.length === 0) {
			friendsListElement.innerHTML = `
			<div class="text-center text-gray-400 py-4">
				You don't have any friends yet. Search for users to add friends!
			</div>
			`;
			return;
		}
	  
		const friendsHtml = friends.map((friend: UserSearchResult) => {
			if (!friend.userId || !friend.userName) {
				console.warn("Friend object missing required properties", friend);
				return ''; // Skip this friend in rendering
			}
			
		return `
				<div class="flex items-center justify-between bg-gray-800 p-3 rounded">
				<div>
					<div class="font-semibold">${friend.userName}</div>
					<div class="text-xs ${friend.isOnline ? 'text-green-400' : 'text-gray-400'}">
					${friend.isOnline === true ? '● Online' : '○ Offline'}
					</div>
				</div>
				<div class="flex gap-2">
					<button class="btn-sm viewStatsBtn" data-userid="${friend.userId}">Stats</button>
					<button class="btn-sm bg-red-600 removeFriendBtn" data-userid="${friend.userId}">Remove</button>
				</div>
				</div>
			`;
		}).join('');
	  
		friendsListElement.innerHTML = friendsHtml;
		
		// Ajouter des event listeners pour les boutons
		document.querySelectorAll(".viewStatsBtn").forEach(button => {
			button.addEventListener("click", (e) => {

				const friendIdAttr = (e.currentTarget as HTMLElement).getAttribute("data-userid");
				console.log("Accept button clicked, data-userid:", friendIdAttr);
			
				if (!friendIdAttr) {
				console.error("No friendId found on button");
				return;
				}
				const numericId = Number(friendIdAttr);
				console.log("Converted to number:", numericId, "Is NaN?", isNaN(numericId));

				if (!isNaN(numericId)) {
					viewFriendStats(numericId);
				} else {
					console.error("Invalid friend ID:", friendIdAttr);
				}
			});
	 	 });
	  
		document.querySelectorAll(".removeFriendBtn").forEach(button => {
			button.addEventListener("click", (e) => {
			const friendId = (e.currentTarget as HTMLElement).getAttribute("data-userid");
			removeFriend(Number(friendId));
			});
		});
	  
	} catch (error) {
		console.error("Failed to load friends list:", error);
		friendsListElement.innerHTML = `
			<div class="text-center text-red-500 py-4">
			Failed to load friends list. Please try again later.
			</div>
		`;
	}
}

// Fonction pour rafraichir la liste d'amis toutes les 30s
export function startFriendsStatusAutoRefresh (intervalMs = 30000) {
	loadFriendsList();
	loadFriendRequests();

	// Rafraichissement périodique de la liste d'amis
	const intervalId = setInterval(() => {
		loadFriendsList();
		loadFriendRequests();
	}, intervalMs);

	// Retourner l'ID d'intervalle pour pouvoir l'arreter si necessaire
	return intervalId;
}

// Fonction pour charger les demandes d'amis
export async function loadFriendRequests() {
	const userId = Number(sessionStorage.getItem("userId"));
	const requestsElement = document.getElementById("friendRequests");
	const requestCountElement = document.getElementById("requestCount");
	if (!requestsElement || !requestCountElement) return;
	
	try {
	  const response = await fetch(`/api/friends/pending/${userId}`, {
		headers: {
		  "Authorization": `Bearer ${sessionStorage.getItem("authToken")}`,
		  "Content-Type": "application/json",
		  "Accept": "application/json"
		}
	  });
	  
	 if (!response.ok) {
			throw new Error(`Failed to load friend requests: ${response.status}`);
		}
		// DEBUG: Vérifier si userId est bien récupéré
		const requests: FriendRequest[] = await response.json();
		// console.log("Friend requests object example:", requests[0]); //DEBUG
	  
	  // Mettre à jour le compteur de demandes
	  if (requests.length > 0) {
		requestCountElement.textContent = requests.length.toString();
		requestCountElement.classList.remove("hidden");
	  } else {
		requestCountElement.classList.add("hidden");
	  }
	  
	  if (requests.length === 0) {
		requestsElement.innerHTML = `
		  <div class="text-center text-gray-400 py-4">
			No pending friend requests.
		  </div>
		`;
		return;
	  }
	  
	  const requestsHtml = requests.map((request: FriendRequest) => {
		// Make sure id exists and convert to string explicitly
		const requestId = request.Id !== undefined ? String(request.Id) : '';
		
		return `
		<div class="flex items-center justify-between bg-gray-800 p-3 rounded">
		  <div>
			<div class="font-semibold">${request.senderName}</div>
			<div class="text-xs">Wants to be your friend</div>
		  </div>
		  <div class="flex gap-2">
			<button class="btn-sm bg-green-600 acceptRequestBtn" data-requestid="${requestId}">Accept</button>
			<button class="btn-sm bg-gray-600 rejectRequestBtn" data-requestid="${requestId}">Reject</button>
		  </div>
		</div>
	  `;
	}).join('');
	  
	  requestsElement.innerHTML = requestsHtml;
	  
	  // Ajouter des event listeners pour les boutons
	  document.querySelectorAll(".acceptRequestBtn").forEach(button => {
		button.addEventListener("click", (e) => {
			const requestIdAttr = (e.currentTarget as HTMLElement).getAttribute("data-requestid");
			console.log("Accept button clicked, data-requestid:", requestIdAttr);
        
			if (!requestIdAttr) {
			console.error("No requestId found on button");
			return;
			}
			const numericId = Number(requestIdAttr);
	        console.log("Converted to number:", numericId, "Is NaN?", isNaN(numericId));

			if (!isNaN(numericId)) {
				acceptFriendRequest(numericId);
			} else {
				console.error("Invalid request ID:", requestIdAttr);
			}
		});
	  });
	  
	  document.querySelectorAll(".rejectRequestBtn").forEach(button => {
		button.addEventListener("click", (e) => {
		  const requestIdAttr = (e.currentTarget as HTMLElement).getAttribute("data-requestid");
		  console.log("Reject button clicked, data-requestid:", requestIdAttr);
        
			if (!requestIdAttr) {
			console.error("No requestId found on button");
			return;
			}
		  const numericId = Number(requestIdAttr);
          console.log("Converted to number:", numericId, "Is NaN?", isNaN(numericId));

			if (!isNaN(numericId)) {
				rejectFriendRequest(numericId);
			} else {
				console.error("Invalid request ID:", requestIdAttr);
			}
		});
	  });
	  
	} catch (error) {
	  console.error("Failed to load friend requests:", error);
	  requestsElement.innerHTML = `
		<div class="text-center text-red-500 py-4">
		  Failed to load friend requests. Please try again later.
		</div>
	  `;
	}
}
  
// Fonction pour rechercher des amis
export async function searchFriends() {
	const searchInput = document.getElementById("friendSearch") as HTMLInputElement;
	const searchResultsElement = document.getElementById("searchResults");
	if (!searchInput || !searchResultsElement) return;
	
	const query = searchInput.value.trim();
	if (!query) return;
	
	searchResultsElement.innerHTML = `<div class="text-center">Searching...</div>`;
	searchResultsElement.classList.remove("hidden");
	
	try {
		// Modification pour utiliser POST avec un body au lieu de paramètres d'URL
        const userIdStr = sessionStorage.getItem("userId");
        const userId = userIdStr ? Number(userIdStr) : null;

		// Vérification que userId est valide
        if (userId === null || isNaN(userId)) {
            throw new Error("Invalid user ID");
        }

		const response = await fetch(`/api/friends/findusers`, {
            method: "POST",  // Changement en POST
            headers: {
                "Authorization": `Bearer ${sessionStorage.getItem("authToken")}`, 
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({  // Ajout du corps de la requête
                q: query,
                userId: userId
            })
        });
    
        if (!response.ok) {
            throw new Error(`Search failed: ${response.status}`);
        }
        
        const users = await response.json();

		console.log("Search for new friends -> results:", users);

		if (users.length === 0) {
			searchResultsElement.innerHTML = `<div class="text-center text-gray-400">No users found</div>`;
			return;
		}
		
		const resultsHtml: string = (users as UserSearchResult[])
			.filter((user: UserSearchResult) => user.userId !== userId) // Exclure l'utilisateur actuel
			.map((user: UserSearchResult) => `
			<div class="flex justify-between items-center bg-gray-800 p-2 rounded">
				<span>${user.userName}</span>
				<button class="btn-sm ${user.isFriend ? 'bg-gray-600' : 'bg-blue-600'} addFriendBtn" 
						data-userid="${user.userId}" 
						${user.isFriend ? 'disabled' : ''}>
				${user.isFriend ? 'Already Friend' : 'Add Friend'}
				</button>
			</div>
			`)
			.join('');
	  
	 	searchResultsElement.innerHTML = resultsHtml;
	  
		// Ajouter des event listeners pour les boutons
		document.querySelectorAll(".addFriendBtn").forEach(button => {
			if (!(button as HTMLButtonElement).disabled) {
				button.addEventListener("click", (e) => {
					const friendId = (e.currentTarget as HTMLElement).getAttribute("data-userid");
					sendFriendRequest(Number(friendId));
					(e.currentTarget as HTMLButtonElement).disabled = true;
					(e.currentTarget as HTMLButtonElement).textContent = "Request Sent";
					(e.currentTarget as HTMLButtonElement).classList.add("bg-gray-600");
					(e.currentTarget as HTMLButtonElement).classList.remove("bg-blue-600");
				});
			}
	  	});
	} catch (error) {
	  console.error("Search failed:", error);
	  searchResultsElement.innerHTML = `<div class="text-center text-red-500">Search failed. Please try again.</div>`;
	}
}
  
// Fonction pour basculer entre les onglets
export function switchTab(tabId: string) {
	const friendsListTab = document.getElementById("tabFriendsList");
	const requestsTab = document.getElementById("tabRequests");
	const friendsListContent = document.getElementById("friendsList");
	const requestsContent = document.getElementById("friendRequests");
	
	if (!friendsListTab || !requestsTab || !friendsListContent || !requestsContent) return;
	
	if (tabId === "friendsList") {
	  friendsListTab.classList.add("bg-matrix", "text-white");
	  requestsTab.classList.remove("bg-matrix", "text-white");
	  friendsListContent.classList.remove("hidden");
	  requestsContent.classList.add("hidden");
	} else {
	  friendsListTab.classList.remove("bg-matrix", "text-white");
	  requestsTab.classList.add("bg-matrix", "text-white");
	  friendsListContent.classList.add("hidden");
	  requestsContent.classList.remove("hidden");
	}
}
  
// Fonction pour voir les statistiques d'un ami
export async function viewFriendStats(friendId: number) {
	try {
		console.log("Fetching stats for friend ID:", friendId); // Debug log

		// Vérification de l'ID de l'ami
		if (!friendId || isNaN(friendId)) {
			throw new Error("Invalid friend ID");
		}
		
		const response = await fetch(`/api/friends/stats/${friendId}`, {
		method: "GET",
		headers: {
		  "Authorization": `Bearer ${sessionStorage.getItem("authToken")}`, 
		  "Content-Type": "application/json",
		  "Accept": "application/json"
		}
	  });

	  console.log("Response status:", response.status); // Debug log

	  if (!response.ok) {
		throw new Error(`Failed to load friend stats: ${response.status}`);
	  }
	  
	  const statsData = await response.json();
	  console.log("Friend stats data:", statsData);

	  const stats: UserStats = {
		userId: statsData.userId,
		playerName: statsData.playerName,
		games_played: statsData.games_played,
		games_won: statsData.games_won,
		highest_score: statsData.highest_score
	  };
	  console.log("Parsed stats:", stats);
	  // Créer une modal pour afficher les stats
	  const modal = document.createElement("div");
	  modal.className = "fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50";
	  modal.innerHTML = `
		<div class="bg-gray-900 border border-matrix p-6 rounded-lg w-full max-w-md">
		  <h3 class="text-xl mb-4">${stats.playerName}'s Stats</h3>
		  <div class="space-y-2">
			<p><strong>Games Played:</strong> ${stats.games_played}</p>
			<p><strong>Wins:</strong> ${stats.games_won}</p>
			<p><strong>Highest Score:</strong> ${stats.highest_score}</p>
		  </div>
		  <div class="mt-6 flex justify-end">
			<button class="btn closeModalBtn">Close</button>
		  </div>
		</div>
	  `;
	  
	  document.body.appendChild(modal);
	  
	  // Fermeture de la modal
	  modal.querySelector(".closeModalBtn")?.addEventListener("click", () => {
		document.body.removeChild(modal);
	  });
	  
	} catch (error) {
	  console.error("Failed to load friend stats:", error);
	  alert("Failed to load friend stats. Please try again.");
	}
}
  
// Fonction pour envoyer une demande d'ami
export async function sendFriendRequest(friendId: number) {
	const userId = Number(sessionStorage.getItem("userId"));
	
	try {
		const response = await fetch("/api/friends/request", {
		method: "POST",
		headers: {
		  "Content-Type": "application/json",
		  "Accept": "application/json",
		  "Authorization": `Bearer ${sessionStorage.getItem("authToken")}`
		},
		body: JSON.stringify({
		  senderId: userId,
		  receiverId: friendId,
		})
	  });
	  
	  if (!response.ok) {
		throw new Error(`Failed to send friend request: ${response.status}`);
	  }
	  
	  console.log("Friend request sent successfully");
	  
	} catch (error) {
	  console.error("Failed to send friend request:", error);
	  alert("Failed to send friend request. Please try again.");
	}
}
  
// Fonction pour accepter une demande d'ami
export async function acceptFriendRequest(requestId: number) {
    console.log("Accepting friend request with ID:", requestId); // Debug log

	try {
        console.log("Sending request to:", `/api/friends/request/${requestId}/accept`);

		const response = await fetch(`/api/friends/request/${requestId}/accept`, {
		method: "POST",
		headers: {
			"Authorization": `Bearer ${sessionStorage.getItem("authToken")}`,
			"Content-Type": "application/json",
			"Accept": "application/json"
			},
		body: JSON.stringify({
			requestId: requestId
		})
	  	});
	  
		console.log("Response status:", response.status);
		const responseText = await response.text();
		console.log("Response body:", responseText);

	  if (!response.ok) {
		throw new Error(`Failed to accept friend request: ${response.status}`);
	  }
	  
	  // Actualiser les listes
	  setTimeout(() => {
		loadFriendsList();
		loadFriendRequests();
	  }, 300);
	  
	} catch (error) {
	  console.error("Failed to accept friend request:", error);
	  alert("Failed to accept friend request. Please try again.");
	}
}
  
// Fonction pour rejeter une demande d'ami
export async function rejectFriendRequest(requestId: number) {
	try {
		const response = await fetch(`/api/friends/request/${requestId}/reject`, {
			method: "POST",
			headers: {
				"Authorization": `Bearer ${sessionStorage.getItem("authToken")}`,
				"Content-Type": "application/json",
				"Accept": "application/json"
				},
			body: JSON.stringify({
				requestId: requestId
			})
		});
	  
		if (!response.ok) {
			throw new Error(`Failed to reject friend request: ${response.status}`);
		}
		
		// Actualiser la liste des demandes
		setTimeout(() => {
			loadFriendRequests();
		}, 300);
		
	} catch (error) {
	  console.error("Failed to reject friend request:", error);
	  alert("Failed to reject friend request. Please try again.");
	}
}
  
// Fonction pour supprimer un ami
export async function removeFriend(friendId: number) {
	const userId = Number(sessionStorage.getItem("userId"));
	
	if (confirm("Are you sure you want to remove this friend?")) {
	  try {
		const removePayload: RemoveFriendPayload = {
		  userId: userId,
		  friendId: friendId
		};

		console.log("Removing friend with payload:", removePayload); // Debug log
		const response = await fetch(`/api/friends/remove`, {
		  method: "DELETE",
		  headers: {
			"Content-Type": "application/json",
			"Accept": "application/json",
			"Authorization": `Bearer ${sessionStorage.getItem("authToken")}`
		  },
		  body: JSON.stringify(removePayload)
		});
		
		if (!response.ok) {
		  throw new Error(`Failed to remove friend: ${response.status}`);
		}
		
		// Actualiser la liste des amis
		loadFriendsList();
		
	  } catch (error) {
		console.error("Failed to remove friend:", error);
		alert("Failed to remove friend. Please try again.");
	  }
	}
}
  
// Export d'une fonction pour initialiser les gestionnaires d'événements
export function initFriendsEventHandlers() {
	document.getElementById("searchFriendBtn")?.addEventListener("click", searchFriends);
	document.getElementById("tabFriendsList")?.addEventListener("click", () => switchTab("friendsList"));
	document.getElementById("tabRequests")?.addEventListener("click", () => switchTab("friendRequests"));

	// Démarrer le rafraichissement automatique (toutes les 30s)
	friendsRefreshIntervalId = startFriendsStatusAutoRefresh();
  }


  // Fonction pour arreter le rafraichissement automatique si l'utilisateur quitte la page
export function stopFriendsStatusAutoRefresh() {
  if (friendsRefreshIntervalId) {
    clearInterval(friendsRefreshIntervalId);
    friendsRefreshIntervalId = undefined;
  }
}