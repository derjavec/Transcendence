// (security) auth-routes.ts
import { FastifyInstance } from "fastify";
import { hashPassword, comparePassword, sanitizeInput } from "./security";
import fetch from "node-fetch";
import { tokenBlacklist } from "./jwt-blacklist";
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { setup2FADatabase } from "./2fa-database";
import { tokenBlacklist } from "./jwt-blacklist";

export default async function (app: FastifyInstance) {
  
  app.post("/register", async (request, reply) => {
    
    const { name, email, password, enable2FA } = request.body;
    
    const hashedPassword = await hashPassword(password);
    
    try {
      // Vérifiez que toutes les données nécessaires sont présentes
      if (!name || !email || !password) {
        console.error("❌ Champs manquants dans la requête");
        return reply.code(400).send({ error: "Missing required fields" });
      }
      const res = await fetch("http://gateway-api:4000/api/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password: hashedPassword, enable2FA }),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error('❌ Error from user_management:', data);
        return reply.code(res.status).send(data);
      }

      if (enable2FA) {
        const tempToken = app.jwt.sign({
          userId: data.userId,
          tempFor2FA: true,
          exp: Math.floor(Date.now() / 1000) + (30 * 60) // Expire au bout de 30mn
        });
        return reply.send({
          ...data,
          token: tempToken
        });
      }
      reply.send(data);
    } catch (err) {
      reply.code(500).send({ error: "Failed to register user", details: err });
    }
  });

  app.post("/login", async (request, reply) => {
    const { email, password, twoFactorCode } = request.body;
    const safeEmail = sanitizeInput(email);

    try {
      const response = await fetch(`http://gateway-api:4000/api/users/email/${safeEmail}`);
      if (!response.ok) 
        return reply.code(401).send({ error: "Invalid email or password" });

      const user = await response.json();
      const isValid = await comparePassword(password, user.password);
      if (!isValid) 
        return reply.code(401).send({ error: "Invalid email or password" });
      
      // Verifier si l'utilisateur n'est pas deja connecté
      const isOnlineResponse = await fetch(`http://gateway-api:4000/api/users/isonline/${user.userId}`);

      if (!isOnlineResponse.ok) {
        console.error("❌ Erreur lors de la vérification du statut en ligne de l'utilisateur:", isOnlineResponse.statusText);
        return reply.code(500).send({ error: "Failed to check user online status" });
      }

      const isOnlineData = await isOnlineResponse.json();

      const isUserOnline = Boolean(isOnlineData.status);
      if (isUserOnline && isOnlineData) {
        console.warn("⚠️ L'utilisateur est déjà connecté:", user.userId);
        return reply.code(403).send({ error: "User already logged in" });
      }

      // Vérifier si le 2FA est activé
      if (user.enable2FA) {
        // Si le code 2FA n'est pas fourni, demander de le fournir
        if (!twoFactorCode) {
          // Générer un token temporaire spécial pour la vérification 2FA
          const tempToken = app.jwt.sign({
            userId: user.userId,
            tempFor2FA: true,  // Marquer comme token temporaire pour 2FA
            exp: Math.floor(Date.now() / 1000) + 300 // Expire dans 5 minutes
          });

          return reply.code(200).send({
            token: tempToken,
            userId: user.userId,
            enable2FA: user.enable2FA,
            message: "Two-factor authentication code required"
          });
        }

        // Vérifier que twoFactorSecret existe
        if (!user.twoFactorSecret) {
          console.error("❌ twoFactorSecret is missing for user", user.userId);
          return reply.code(500).send({ error: "2FA configuration error" });
        }

        // Vérifier le code 2FA
        console.log("Vérification du code 2FA...");
        const verified = speakeasy.totp.verify({
          secret: user.twoFactorSecret,
          encoding: 'base32',
          token: twoFactorCode,
          window: 1
        });

        if (!verified) {
          return reply.code(401).send({ error: "Invalide two-factor authentication code"});
        }
      }
      
      // Générer le token avec JTI et securityVersion
      const token = app.jwt.sign({
        userId: user.userId,
        sub: user.userId,
        secVer: user.SecurityVersion || 0,
        jti: generateUniqueId(),
        enable2FA: user.enable2FA
      });

      // Enregistrer l'utilisateur en ligne
      const onlineResponse = await fetch(`http://gateway-api:4000/api/users/${user.userId}/online`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.userId })
      });
      if (!onlineResponse.ok) {
        console.error("❌ Erreur lors de la mise à jour du statut de l'utilisateur:", onlineResponse.statusText);
        return reply.code(500).send({ error: "Failed to update user status" });
      }
      const onlineData = await onlineResponse.json();
      
      // Répondre avec le token et l'ID utilisateur
      reply.send({ token, userId: user.userId, enable2FA: user.enable2FA });
    } catch (err) {
      reply.code(500).send({ error: "Authentication failed", details: err });
    }
  });

  app.post("/logout", async (request, reply) => {
    try {
      let token;
      console.log("Logout request received!!!");
      // Vérifier si le token est présent dans l'en-tête Authorization
      const authHeader = request.headers.authorization;
      if (authHeader  && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
      // Si le token n'est pas présent dans l'en-tête, vérifier dans le corps de la requête
      else if (request.body && request.body.token) {
        token = request.body.token;
      }

      // Si le token n'est pas présent dans l'en-tête ou le corps, retourner une erreur
      if (!token) {
        return reply.code(400).send({ error: "Token manquant" });
      }
      
      let decoded;
      
      try {
        // Vérifier le token
        decoded = app.jwt.verify(token);
      } catch (err) {
        // Si le token est déjà expiré ou invalide, l'ajouter quand même à la blacklist
        try {
          // Décoder le token sans vérifier l'expiration pour récupérer les infos
          const decodedToken = app.jwt.decode(token);
          if (decodedToken && decodedToken.jti) {
            await tokenBlacklist.blacklist(token, decodedToken);
            console.log(`✅ Expired/invalid token added to blacklist during logout: ${decodedToken.jti}`);
            
            // Mettre l'utilisateur en offline même si le token est expiré
            const userId = decodedToken.userId;
            if (userId) {
              const response = await fetch(`http://gateway-api:4000/api/users/${userId}/offline`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId })
              });
              if (response.ok) {
                console.log(`✅ User ${userId} marked as offline during logout with expired token`);
              }
            }
          }
        } catch (blacklistErr) {
          console.error('❌ Erreur lors de l\'ajout du token expiré à la blacklist:', blacklistErr);
        }
        
        return reply.code(200).send({ message: "Déconnexion réussie" });
      }
      
      // Ajouter le token à la liste noire
      await tokenBlacklist.blacklist(token, decoded);
      
      // Enregistrer le user en offline
      const userId = decoded.userId;
      const response = await fetch(`http://gateway-api:4000/api/users/${userId}/offline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
      if (!response.ok) {
        console.error("❌ Erreur lors de la mise à jour du statut de l'utilisateur:", response.statusText);
        return reply.code(500).send({ error: "Échec de la mise à jour du statut de l'utilisateur" });
      }
      const data = await response.json();

      // Répondre avec un message de succès
      reply.code(200).send({ message: "Déconnexion réussie" });
    } catch (err) {
      reply.code(500).send({ error: "Échec de la déconnexion", details: err.message });
    }
  });


  app.post("/validate-token", async (request, reply) => {
    const { token, userId, checkUserInvalidation } = request.body;
  
    if (!token || !userId) {
      return reply.code(400).send({ success: false, message: "Token or userId missing" });
    }
  
    try {
      const payload = app.jwt.verify(token);
  
      if (Number(payload.userId) !== Number(userId)) {
        return reply.code(401).send({ success: false, message: "Invalid token-userId pair" });
      }
      
      if (!payload.jti) {
        return reply.code(401).send({ success: false, message: "Token does not contain JTI" });
      }
      
      // Check if the token is blacklisted
      const isBlacklisted = await tokenBlacklist.isBlacklisted(payload.jti);
      if (isBlacklisted) {
        // Mettre l'utilisateur en offline si le token est révoqué
        try {
          await fetch(`http://gateway-api:4000/api/users/${userId}/offline`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId })
          });
          console.log(`✅ User ${userId} marked asoffline due to revoked token`);
        } catch (error) {
          console.error("❌ Erreur lors de la mise à jour du statut de l'utilisateur:", error);
        }
        // Répondre avec une erreur 401 si le token est révoqué
        return reply.code(401).send({ success: false, message: "Token is revoked" });
      }

      // 🔒 SÉCURITÉ : Vérifier si l'utilisateur est vraiment connecté en base
      try {
        const connectionStatusResponse = await fetch(`http://gateway-api:4000/api/users/isonline/${userId}`);
        if (connectionStatusResponse.ok) {
          const connectionData = await connectionStatusResponse.json();
          const isUserOnline = Boolean(connectionData.status);
          
          if (!isUserOnline) {
            console.warn(`🚨 SECURITY: User ${userId} has valid token but is offline in database - invalidating session`);
            
            // Invalider le token en l'ajoutant à la blacklist
            await tokenBlacklist.blacklist(token, payload);
            
            return reply.code(401).send({ 
              success: false, 
              message: "Session invalidated - user not connected in database" 
            });
          }
        } else {
          console.error(`❌ Failed to check connection status for user ${userId}`);
          // En cas d'erreur de vérification, invalider la session par sécurité
          return reply.code(401).send({ 
            success: false, 
            message: "Unable to verify connection status" 
          });
        }
      } catch (connectionErr) {
        console.error(`❌ Error checking connection status for user ${userId}:`, connectionErr);
        // En cas d'erreur de vérification, invalider la session par sécurité
        return reply.code(401).send({ 
          success: false, 
          message: "Connection verification failed" 
        });
      }

      return reply.send({ success: true });
   } catch (err: any) {
      console.error('💥 JWT verify failed', err.message);
      
      // Si le token est expiré, l'ajouter à la blacklist
      if (err.message && err.message.includes('expired')) {
        try {
          // Décoder le token sans vérifier l'expiration pour récupérer les infos
          const decodedToken = app.jwt.decode(token);
          if (decodedToken && decodedToken.jti) {
            await tokenBlacklist.blacklist(token, decodedToken);
            console.log(`✅ Expired token added to blacklist: ${decodedToken.jti}`);
            
            // Mettre l'utilisateur en offline
            await fetch(`http://gateway-api:4000/api/users/${userId}/offline`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId })
            });
            console.log(`✅ User ${userId} marked as offline due to expired token`);
          }
        } catch (blacklistErr) {
          console.error('❌ Erreur lors de l\'ajout du token expiré à la blacklist:', blacklistErr);
        }
      }
      
      return reply.code(401).send({ success: false, message: "Token validation failed" });
    }
  });  

  // Route pour la configuration de la 2FA
  app.post("/setup-2fa", {
    preHandler: async (request, reply) => {
      try {
        // Vérification du token temporaire
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return reply.code(401).send({error: "Token d'authentification requis" });
        }

        const token = authHeader.split(' ')[1];
        const decoded = app.jwt.verify(token);

        // Vérification du Token Temporaire enregistré et comparaison
        if (!decoded.tempFor2FA) {
          return reply.code(401).send({ error: "Token temporaire invalide" });
        }
        request.user = { id: decoded.userId };
      } catch (tokenErr) {
        console.error("❌ Erreur lors de la vérification du token:", tokenErr);
        return reply.code(401).send({ error: "Token d'authentification invalide" });
      }
    }
  }, async (request, reply) => {
    try {
      const userId = request.user.id;

      // Générer une clé secrète unique pour l'utilisateur
      const secret = speakeasy.generateSecret({ name: `DreamTeam:user ${userId}` });

      // Créer un QR code pour cette clé
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

      // Générer des codes de récupération
      const recoveryCodes = Array(8).fill(0).map(() =>
        Math.random().toString(36).substring(2, 6).toUpperCase() + "-" + 
        Math.random().toString(36).substring(2, 6).toUpperCase()
      );

      // Stocker la clé secrète et les codes de récupération temporaire
      await setup2FADatabase.storeTemporary2FAData(userId, secret.base32, recoveryCodes);

      // Renvoyer le QR Code et les codes de récupération
      reply.send({
        qrCodeUrl,
        recoveryCodes,
        secret: secret.base32
      });
    } catch (err) {
      console.error("Error during 2FA setup:", err);
      reply.code(500).send({ error: "Failed to set up 2FA", details: err });
    }
  });

  // Route pour vérifier le code 2FA
  app.post("/verify-2fa", {
    preHandler: async (request, reply) => {
      try {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return reply.code(401).send({ error: "Token d'authentification requis" });
        }

        const token = authHeader.split(' ')[1];
        const decoded = app.jwt.verify(token);

        if (!decoded.tempFor2FA) {
          return reply.code(401).send({ error: "Token temporaire invalide" });
        }

        request.user = {id: decoded.userId };
      } catch (err) {
        return reply.code(401).send({ error: "ToError from user_managementken d'authentification invalide" });
      }
    }
  }, async (request, reply) => {
    const { token } = request.body;
    const userId = request.user.id;
    
    if (!token) {
      return reply.code(400).send({ error: "Token manquant" });
    }
    try {
      // Récupérer la clé secrète et les codes de récupération temporaires
      const tempData = await setup2FADatabase.getTemporary2FAData(userId);
      if (!tempData) {
        return reply.code(400).send({ error: "Aucune donnée temporaire trouvée pour cet utilisateur" });
      }

      // Vérifier le code 2FA
      const verified = speakeasy.totp.verify({
        secret: tempData.secret,
        encoding: 'base32',
        token: token,
        window: 1 // Permettre une fenêtre de 1 seconde pour la vérification
      });

      if (!verified) {
        return reply.code(400).send({ error: "Code 2FA invalide" });
      }

      // Activer définitivement le 2FA pour l'utilisateur
      if (!tempData.enable2FA) {
        const response = await fetch(`http://gateway-api:4000/api/users/${userId}/activate2fa`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            secret: tempData.secret, 
            recoveryCodes: tempData.recoveryCodes
          })
        });
  
        if (!response.ok) {
          const errorData = await response.json();
          console.error("❌ Erreur lors de l'activation 2FA:", errorData);
          return reply.code(response.status).send({ error: "Échec de l'activation du 2FA" });
        }
        
        const activationResult = await response.json();
  
        // Supprimer les données temporaires
        await setup2FADatabase.deleteTemporary2FAData(userId);
      }

      // Enregistrer l'utilisateur en ligne
      const onlineResponse = await fetch(`http://gateway-api:4000/api/users/${userId}/online`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
      // Vérifier la réponse de l'API
      if (!onlineResponse.ok) {
        // Capturer et afficher le corps de la réponse d'erreur
        const errorBody = await onlineResponse.text();
        console.error(`❌ Erreur lors de la mise à jour du statut de l'utilisateur: ${onlineResponse.status} ${onlineResponse.statusText}`);
        console.error(`Détails de l'erreur: ${errorBody}`);
        
        // Continuer malgré l'erreur mais enregistrer l'incident
        console.warn("Poursuite de l'authentification malgré l'échec de mise à jour du statut");
      } else {
        const onlineData = await onlineResponse.json();
      }
      
      // Générer le token et terminer l'authentification comme avant
      // Générer un nouveau token avec 2FA activé
      const newToken = app.jwt.sign({
        userId: userId,
        sub: userId,
        secVer: Date.now(), // On incrémente la version de sécurité
        jti: generateUniqueId(),
        enable2FA: true
      });

      reply.send({
        success: true,
        token: newToken,
        userId: userId
      });
    } catch (err) {
      console.error("Erreur verify-2fa:", err);
      reply.code(500).send({ error: "Echec de la vérification 2FA" });
    }
  });


  // Route pour verifier le code de secours 2FA
  app.post("/rescueCode-2fa", {
    preHandler: async (request, reply) => {
      try {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return reply.code(401).send({ error: "Token d'authentification requis" });
        }

        const token = authHeader.split(' ')[1];
        const decoded = app.jwt.verify(token);

        if (!decoded.tempFor2FA) {
          return reply.code(401).send({ error: "Token temporaire invalide" });
        }

        request.user = {id: decoded.userId };
      } catch (err) {
        return reply.code(401).send({ error: "Token d'authentification invalide" });
      }
    }
  }, async (request, reply) => {
    const { rescueCode } = request.body;
    const userId = request.user.id;

    if (!rescueCode) {
      return reply.code(400).send({ error: "Code de secours manquant" });
    }
    // Récupérer l'utilisateur depuis son Id
    const response = await fetch(`http://gateway-api:4000/api/users/${userId}`);
    if (!response.ok) {
      return reply.code(404).send({ error: "Utilisateur introuvable" });
    }

    const user = await response.json();
    // Verifier si l'utilisateur a le 2FA activé et des codes de secours encore valides
    if (!user.enable2FA || !user.twoFactorRecoveryCodes) {
      return reply.code(400).send({ error: "2FA n'est pas activé ou aucun code de secours valide" });
    }
    // Normaliser le format du code de secours
    const normalizedRescueCode = rescueCode.replace(/-/g, "").toUpperCase();
    
    let recoveryCodes = [];
    try {
      // Vérifier si le code de secours est valide
      if (typeof user.twoFactorRecoveryCodes === 'string') {
        recoveryCodes = JSON.parse(user.twoFactorRecoveryCodes);
        } else if (Array.isArray(user.twoFactorRecoveryCodes)) {
        // Si c'est déjà un tableau
        recoveryCodes = user.twoFactorRecoveryCodes;
      } else {
        throw new Error("Invalid recovery codes format");
      }

      if (!recoveryCodes.length) {
        return reply.code(400).send({ error: "Aucun code de recuperation disponible" });
      }

      // Normaliser tous les codes de récupération pour la comparaison
      const normalizedRecoveryCodes = recoveryCodes.map(code => 
        typeof code === 'string' ? code.replace(/-/g, "").toUpperCase() : ''
      );

      // Verifier si le code de secours est valide
      const codeIndex = normalizedRecoveryCodes.indexOf(normalizedRescueCode);
      if (codeIndex === -1) {
        return reply.code(400).send({ error: "Code de secours invalide" });
      }

      // Supprimer le code de secours utilisé
      recoveryCodes.splice(codeIndex, 1);
      
      const updateResponse = await fetch(`http://gateway-api:4000/api/users/${userId}/new-recovery-codes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recoveryCodes })
      });

      if (!updateResponse.ok) {
        throw new Error("Échec de la mise à jour des codes de récupération");
      }

      // Générer un nouveau token avec 2FA activé
      const newToken = app.jwt.sign({
        userId: userId,
        sub: userId,
        secVer: user.SecurityVersion || 0, // On incrémente la version de sécurité
        jti: generateUniqueId(),
        enable2FA: true
      });

      // Répondre avec le nouveau token
      reply.send({
        success: true,
        token: newToken,
        userId: userId,
        remainingCodes: recoveryCodes.length,
        message: recoveryCodes.length <= 3 
      ? "Attention: il vous reste peu de codes de secours. Pensez à en générer de nouveaux."
      : "Code de secours valide."
      });
    } catch (parseError) {
      console.error("Erreur lors du traitement des codes de récupération:", parseError);
      return reply.code(500).send({ 
        error: "Erreur lors du traitement des codes de récupération", 
        details: parseError.message 
      });
    }
  });

  // Route pour regenerer les codes de secours 2FA
  app.post("/new-recovery-codes", {
    preHandler: async (request, reply) => {
      try {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return reply.code(401).send({ error: "Token d'authentification requis" });
        }

        const token = authHeader.split(' ')[1];
        const decoded = app.jwt.verify(token);

        // Verifier que l'utilisateur a le 2FA activé
        if (!decoded.enable2FA) {
          return reply.code(401).send({ error: "2FA n'est pas activé pour cet utilisateur" });
        }
        request.user = { id: decoded.userId };

      } catch (err) {
        return reply.code(401).send({ error: "Token d'authentification invalide" });
      }
    }
  }, async (request, reply) => {
    const userId = request.user.id;

    try {
      // Generer de nouveaux codes de secours
      const newRecoveryCodes = Array(8).fill(0).map(() =>
        Math.random().toString(36).substring(2, 6).toUpperCase() + "-" +
        Math.random().toString(36).substring(2, 6).toUpperCase()
      );
      
      console.log("Nouveaux codes de secours générés:", newRecoveryCodes);
      // Mettre à jour les codes de secours dans la base de données
      const updateResponse = await fetch(`http://gateway-api:4000/api/users/${userId}/new-recovery-codes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recoveryCodes: newRecoveryCodes })
      });
      if (!updateResponse.ok) {
        return reply.code(500).send({ error: "Échec de la mise à jour des codes de secours" });
      }

      // Renvoyer les nouveaux codes de secours
      reply.send({
        success: true,
        recoveryCodes: newRecoveryCodes,
        message: "Nouveaux codes de secours générés avec succès"
      });
    } catch (err) {
      console.error("Erreur lors de la régénération des codes de secours:", err);
      reply.code(500).send({ error: "Échec de la régénération des codes de secours" });
    }
  });

  app.post("/hashpassword", async (request, reply) => {
    const { password } = request.body;
    if (!password) return reply.code(400).send({ error: "Missing fields" });

    const hashedPassword = await hashPassword(password);
    reply.send(hashedPassword);
  });

  // Route pour générer un token temporaire pour la configuration 2FA
  app.post("/get-temp-2fa-token", async (request, reply) => {
    try {
      // Vérifier l'authentification de l'utilisateur actuel
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send({ error: "Token d'authentification requis" });
      }

      const token = authHeader.split(' ')[1];
      let decoded;
      
      try {
        decoded = app.jwt.verify(token);
      } catch (tokenErr) {
        decoded = app.jwt.decode(token);
        if (decoded?.userId) {
          await setUserOffline(decoded.userId);
        }
        console.error("❌ Erreur lors de la vérification du token:", tokenErr);
        return reply.code(401).send({ error: "Token d'authentification invalide" });
      }

      // Vérifier si le token est dans la liste noire
      if (decoded.jti) {
        const isBlacklisted = await tokenBlacklist.isBlacklisted(decoded.jti);
        if (isBlacklisted) {
          return reply.code(401).send({ error: "Token révoqué" });
        }
      }

      const userId = decoded.userId;
      
      // Ajouter l'ancien token à la liste noire
      // Cette étape est importante car nous allons créer un nouveau token temporaire
      if (decoded.jti) {
        await tokenBlacklist.blacklist(token, decoded);
      }
      
      // Générer un token temporaire pour la configuration 2FA
      const tempToken = app.jwt.sign({
        userId: userId,
        tempFor2FA: true,
        exp: Math.floor(Date.now() / 1000) + (30 * 60) // Expire dans 30 minutes
      });

      // Renvoyer le token temporaire
      reply.send({
        success: true,
        tempToken: tempToken,
        userId: userId
      });
    } catch (err) {
      console.error("Erreur lors de la génération du token temporaire 2FA:", err);
      reply.code(500).send({ error: "Échec de la génération du token temporaire 2FA" });
    }
  });
  
  // Route pour générer un nouveau token après la désactivation de la 2FA
  app.post("/deactivate-2fa-token", async (request, reply) => {
    try {
      // Vérifier l'authentification de l'utilisateur actuel
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send({ error: "Token d'authentification requis" });
      }

      const token = authHeader.split(' ')[1];
      let decoded;
      
      try {
        decoded = app.jwt.verify(token);
      } catch (tokenErr) {
        console.error("❌ Erreur lors de la vérification du token:", tokenErr);
        return reply.code(401).send({ error: "Token d'authentification invalide" });
      }

      // Vérifier si le token est dans la liste noire
      if (decoded.jti) {
        const isBlacklisted = await tokenBlacklist.isBlacklisted(decoded.jti);
        if (isBlacklisted) {
          return reply.code(401).send({ error: "Token révoqué" });
        }
      }

      const userId = decoded.userId;
      
      // Ajouter l'ancien token à la liste noire
      if (decoded.jti) {
        await tokenBlacklist.blacklist(token, decoded);
      }
      
      // Générer un nouveau token sans 2FA
      const newToken = app.jwt.sign({
        userId: userId,
        sub: userId,
        secVer: Date.now(), // Incrémenter la version de sécurité
        jti: generateUniqueId(),
        enable2FA: false // Important: désactiver le flag 2FA
      });

      // Renvoyer le nouveau token
      reply.send({
        success: true,
        token: newToken
      });
    } catch (err) {
      console.error("Erreur lors de la génération du token après désactivation 2FA:", err);
      reply.code(500).send({ error: "Échec de la génération du token" });
    }
  });

}

const generateUniqueId = () => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
