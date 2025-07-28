// Définition de l'interface des messages standards

export interface StandardWSMessage {
  clientId: string;       // userId pour clients frontend, identifiant aléatoire pour microservices
  clientName: string;     // "frontend", "security", "friendzone", "matchmaking", etc.
  type: string;           // instruction: "auth", "disconnect", "connect", "matchId", etc.
  dest: string;           // destinataire du message ("gateway", "game", "matchmaking", etc.)
  message: any;           // contenu du message/requête
}
