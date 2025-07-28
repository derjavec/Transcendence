//validation-middleware.ts

import { FastifyRequest, FastifyReply } from "fastify";
import axios from "axios";

export async function validationMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const url = request.raw.url || "";

  //exceptions pour routes publiques
  const publicRoutes = [
    "/api/auth/login",
    "/api/auth/register",
    "/api/users",
    "/api/auth/validate-token",
    "/health",
    "/ws",
    "/api/auth/logout"
  ];
  
  // Vérifier si l'URL est dans la liste des routes publiques
  if (publicRoutes.some(route => url.startsWith(route))) {
    return;
  }


  // Routes 2FA spéciales utilisées avec des tokens temporaires
  const twoFARoutes = [
    "/api/auth/setup-2fa",
    "/api/auth/verify-2fa",
    "/api/auth/rescueCode-2fa",
  ];

  // Vérifier si l'URL est dans la liste des routes 2FA
  const is2FARoute = twoFARoutes.some(route => url.startsWith(route));


  // Valider les entrées pour les routes login et register
  if (url.startsWith("/api/auth/login") || url.startsWith("/api/auth/register")) {
    const { email, password } = request.body as { email: string; password: string };
    if (!email || !password) {
      return reply.code(400).send({ success: false, message: "Missing fields" });
    }
    if (!validator.isEmail(email)) {
      return reply.code(400).send({ success: false, message: "Invalid email format" });
    }
    if (password.length < 3) {
      return reply.code(400).send({ success: false, message: "Password must be at least 3 characters" });
    }
  }
  
  // cherche dans le header http: Authorization: Bearer <JWT_TOKEN>
  const authHeader = request.headers.authorization; 
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return reply.code(401).send({ success: false, message: "Missing or invalid token" });
  }

  //extraire la valeur de <JWT_TOKEN>, par exemple: eyJhbGciOi...<HEADER>.<PAYLOAD>.<SIGNATURE>
  const token = authHeader.split(" ")[1];

  try {
    // extraire la 2e partie: le payload encodé en base64
    const payloadBase64 = token.split('.')[1];
    // décoder et convertir en objet JS
    const decoded = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
    
    // Vérifier si c'est un token temporaire pour le 2FA
    if (decoded.tempFor2FA) {
      // Si c'est un token temporaire mais pas pour une route 2FA, on refuse
      if (!is2FARoute) {
        return reply.code(401).send({ 
          success: false, 
          message: "Temporary token can only be used for 2FA setup and verification" 
        });
      }
      
      // C'est un token temporaire valide pour ces routes spécifiques 2FA
      (request as any).userId = decoded.userId;
      (request as any).preserveAuthHeader = true;
      return; // On sort du middleware
    }

   const userId = decoded.userId;

    // demander a Security de verifier si le token est valide et signé
    const res = await axios.post("http://security:4003/validate-token", {
      token,
      userId,
      checkUserInvalidation: false // il faut le mettre a false, sinon le 2me login ne peut pas acceder a user_management
    });
    
    //si userId n'est pas le meme que PAYLOAD -> erreur (token modifié ou expiré)
    if (!res.data.success) {
      return reply.code(401).send({ success: false, message: "Token invalid" });
    }

    // expose userId pour les routes suivantes via request
    (request as any).userId = userId;

  } catch (err: any) {
    console.error("❌ Token validation failed:", err.message);
    return reply.code(401).send({ success: false, message: "Unauthorized" });
  }
}
