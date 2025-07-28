// test-ws-connection.ts
const WebSocket = require('ws');
let popaul;

function testWebSocketConnection() {
  const popaulUrl = `wss://gateway-ws:4500/ws`;
  console.log(`Tentative de connexion à ${popaulUrl}`);
  
  popaul = new WebSocket(popaulUrl);
  
  popaul.onopen = () => {
    console.log('Connexion WebSocket établie!');
    
    // Envoyer un message d'authentification
    const authMessage = {
      clientId: 'test-frontend',
      clientName: 'frontend',
      type: 'auth',
      dest: 'gateway',
      message: {
        token: 'token-test', // Utilisez un vrai token si nécessaire
        userId: '123'
      }
    };
    
    console.log('Envoi du message d\'authentification:', authMessage);
    popaul.send(JSON.stringify(authMessage));
  };
  
  popaul.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('Message reçu:', data);
      
      // Répondre aux pings
      if (data.type === 'ping') {
        const pongMessage = {
          clientId: 'test-frontend',
          clientName: 'frontend',
          type: 'pong',
          dest: 'gateway',
          message: { timestamp: Date.now() }
        };
        popaul.send(JSON.stringify(pongMessage));
      }
    } catch (e) {
      console.error('Erreur de parsing du message:', e);
    }
  };
  
  popaul.onerror = (error) => {
    console.error('Erreur WebSocket:', error);
  };
  
  popaul.onclose = (event) => {
    console.log('Connexion WebSocket fermée:', event.code, event.reason);
  };
  
  // Retourner la connexion pour pouvoir l'utiliser ou la fermer plus tard
  return popaul;
}

// Exécuter le test
const popaulConnection = testWebSocketConnection();

// Fermer la connexion après 30 secondes
setTimeout(() => {
  if (popaulConnection.readyState === WebSocket.OPEN) {
    console.log('Fermeture de la connexion après 30 secondes de test');
    popaulConnection.close();
  }
}, 30000);