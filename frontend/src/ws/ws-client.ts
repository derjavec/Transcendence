////ws-client.ts
let socket: WebSocket;
let messageHandlers: ((data: any) => void)[] = [];

export function connectWebSocket(): Promise<void> {
	return new Promise((resolve, reject) => {
		const token = sessionStorage.getItem("authToken");
        const userId = sessionStorage.getItem("userId");

		if (!token || !userId || userId === "undefined") 
			return reject("Missing token or userId");

		socket = new WebSocket(`wss://${window.location.host}/ws`); // se connecte au websocket server en tant que client

		socket.onopen = () => {
			
			socket.send(JSON.stringify({
				type: "auth",
				userId: Number(userId),
				token
			}));
		};

		socket.onmessage = (event) => {
			const data = JSON.parse(event.data);
			if (data.type === "auth:success") {
				console.log("🟢 WebSocket connected as user", data.userId);
				resolve();
			} else if (data.type === "auth:error") {
				console.error("❌ Auth failed");
				reject("WebSocket auth failed");
			} else {
				messageHandlers.forEach((cb) => cb(data));
			}
		};

		socket.onerror = (err) => {
			console.error("WebSocket error 1:", err);
			reject(err);
		};

		socket.onclose = () => {
			console.warn("🔌 WebSocket closed");
		};
	});
}

export function onMessage(handler: (data: any) => void) {
	messageHandlers.push(handler);
}

export function send(type: string, payload: any = {}) {
	if (socket?.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify({ type, ...payload }));
	} else {
		console.warn("🔴 WebSocket not ready");
	}
}
// Exporter les fonctions et le socket pour utilisation dans d'autres modules

export { socket };