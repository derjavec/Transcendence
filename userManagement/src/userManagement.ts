//userManagement.ts
import Fastify from 'fastify';
import { openDb } from './db';
import bcrypt from 'bcrypt';
import { isBase64ImageValid } from './isBase64ImageValid';

export default async function (app: Fastify) {
  const isValidEmail = (email: string): boolean => {
    // Expression régulière pour valider l'email
    const regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    return regex.test(email);
  };

  app.post('/verify', async(req, reply) =>{
    const { email, password } = req.body
    const db = await openDb();
    try{
        
        if(!email || ! password){
            throw new Error('Email and password required');
        }

        const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);

        if(!user) {
            throw new Error('User not found');
        }

        const isValid = await bcrypt.compare(password, user.password);
        if(!isValid){
            throw new Error('Invalid password');
        }
        return reply.code(201).send({success: true, userId: user.userId});
    }catch(error){
        console.error("error verifying user: ", error);
        return reply.code(500).send({success: false, message: 'error verifying user'});
    }
  })

  app.get('/:id', async (req, reply) => {
    const db = await openDb();
    const { id } = req.params;

    const user = await db.get('SELECT * FROM users WHERE userId = ?', [id]);
  
    if (!user) {
      console.log(`❌ User not found for id: ${id}`);
      return reply.status(404).send({ message: 'User not found' });
    }
  
    //  console.log(`✅ User retrieved: ${JSON.stringify(user)}`);
    return reply.send({
      userId: user.userId,
      name: user.name,
      email: user.email,
      enable2FA: user.enable2FA,
      twoFactorRecoveryCodes: user.twoFactorRecoveryCodes,
      profile_picture: user.profile_picture,
    });
  });

  app.get('/:userId/stats', async (req, reply) => {
    const db = await openDb();
    const { userId } = req.params;

    const stats = await db.get('SELECT * FROM user_stats WHERE userId = ?', [userId]);

    if (!stats) {
      return reply.code(404).send({ message: "Stats not found for this user" });
    }

    return reply.send(stats);
  });

  app.get('/:userId/history', async (req, reply) => {
    const db = await openDb();
    const { userId } = req.params;

    try {
      const rows = await db.all(
        `SELECT
          matchId,
          created_at,
          mode,
          player1,
          player2,
          winner_id,
          loser_id,
          winner_score,
          loser_score,
          status
        FROM matches
        WHERE player1 = ? OR player2 = ?
        ORDER BY created_at DESC`,
        userId, userId
      );

      const formatted = await Promise.all(rows.map(async row => {
        const isUserWinner = String(row.winner_id) === String(userId);
        const isForfeit = row.status === 'forfeit';
        const result = isForfeit ? 'forfeit' : isUserWinner ? 'win' : 'loss';

        let opponentName = 'Unknown';
        const opponentId = String(row.player1) === String(userId) ? row.player2 : row.player1;

        if (opponentId.startsWith('AI')) {
          opponentName = '🤖 AI';
        } else {
          const opp = await db.get('SELECT name FROM users WHERE userId = ?', opponentId);
          opponentName = opp?.name || `User ${opponentId}`;
        }

        const score = isUserWinner
          ? `${row.winner_score} - ${row.loser_score}`
          : `${row.loser_score} - ${row.winner_score}`;

        return {
          matchId: row.matchId,
          created_at: new Date(row.created_at).toISOString().split('T')[0],
          mode: row.mode,
          opponent: opponentName,
          result,
          score
        };
      }));
      // console.log(`📦 Matches fetched for user ${userId}:`, formatted);
      reply.send(formatted);
    } catch (err) {
      console.error('Failed to fetch match history:', err);
      reply.status(500).send({ error: 'Failed to fetch match history' });
    }
  });
    

  app.get('/email/:email', async (req, reply) => {
    const db = await openDb();
    const { email } = req.params;
  
    const userMail = await db.get('SELECT * FROM users WHERE email = ?', [email]);
  
    if (!userMail) {
        console.log(`❌ User not found for email: ${email}`);
        return reply.status(404).send({ message: 'User not found' });
    }
    console.log(`✅ User found: ${JSON.stringify(userMail)}`);
    return {
        userId: userMail.userId,
        name: userMail.name,
        email: userMail.email,
        password: userMail.password,
        enable2FA: userMail.enable2FA,
        twoFactorSecret: userMail.twoFactorSecret
    };
  });  

  app.post('/register', async(req, reply) => {
      
      console.log("Tentative d'enregistrement de l'utilisateur", req.body);
      const db = await openDb();
      const { name, email, password, enable2FA } = req.body;

      if(!isValidEmail(email)){
          return reply.status(400).send({ message: "Invalid email format"});
      }

    try {
        const result = await db.run('INSERT INTO users (name, email, password, enable2FA) VALUES (?, ?, ?, ?)', 
            [name, email, password, enable2FA ? 1 : 0]);
        const createConnectClient = await db.run('INSERT INTO player_connection (userId) VALUES (?)', [result.lastID]);
        if (!createConnectClient) {
          return reply.status(500).send({ message: 'Failed to create connection client' });
        }
        const stats = await db.run(
            'INSERT INTO user_stats (userId, games_played, games_won, highest_score) VALUES (?, 0, 0, 0)',
            [result.lastID]
        );
        if (!stats) {
          return reply.status(500).send({ message: 'Failed to create user stats' });
        }
        console.log("Utilisateur enregistré avec succès", result);

        return reply.status(201).send({ success: true, message: 'User created successfully', userId: result.lastID });
    } catch(error) {
        console.error("Erreur d'enregistrement de l'utilisateur", error);
        console.error("Erreur de base de données", error.stack); 
        return reply.status(400).send({ message: 'Error creating user', error: error.message});
    }
});

  app.put('/:id', async (req, reply) => {
    try {
      const db = await openDb();
      const { id } = req.params;
      const { name, email, password, enable2FA } = req.body;

      if (email && !isValidEmail(email)) {
        return reply.status(400).send({ message: 'Invalid email format' });
      }

      // Vérifie que l’email n’est pas déjà utilisé
      if (email) {
        const userWithEmail = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (userWithEmail && userWithEmail.userId != id) {
          return reply.status(400).send({ message: 'Email already in use' });
        }
      }

      const fieldsToUpdate = [];
      const values = [];

      if (name) {
        fieldsToUpdate.push("name = ?");
        values.push(name);
      }

      if (email) {
        fieldsToUpdate.push("email = ?");
        values.push(email);
      }

      if (password) {
        console.log("mdp avant hash ", password);
        const hashedPassword = await hashUpdatedPassword(password);
        console.log("mdp après hash ", hashedPassword);
        if (!hashedPassword) {
          return reply.status(500).send({ message: 'Failed to hash password' });
        }
        fieldsToUpdate.push("password = ?");
        values.push(hashedPassword);
      }

      fieldsToUpdate.push("enable2FA = ?");
      values.push(enable2FA);

      if (enable2FA === 0 || enable2FA === false) {
        fieldsToUpdate.push("twoFactorSecret = NULL");
        fieldsToUpdate.push("twoFactorRecoveryCodes = NULL");
        fieldsToUpdate.push("SecurityVersion = SecurityVersion + 1");
      }

      if (fieldsToUpdate.length === 0) {
        return reply.status(400).send({ message: 'No valid fields to update' });
      }

      values.push(id);
      const query = `UPDATE users SET ${fieldsToUpdate.join(', ')} WHERE userId = ?`;

      const result = await db.run(query, values);

      if (!result || result.changes === 0) {
        return reply.status(404).send({ message: 'User not found or no change made' });
      }

      return reply.send({ message: 'User successfully updated', id, name, email });

    } catch (err) {
      console.error('Error while updating user:', err);
      return reply.status(500).send({ message: 'Internal server error' });
    }
  });

    
  app.delete('/users/:id', async(req, reply) =>{
      const db = await openDb();
      const { id } = req.params;

      const result = await db.run('DELETE FROM users WHERE userId = ?', [id]);
      const eraseConnectClient = await db.run('DELETE FROM player_connection WHERE userId = ?', [id]);
      
      if(result.changes === 0 || eraseConnectClient.changes === 0){
          console.log(`❌ User not found for id: ${id}`);
          return reply.status(404).send({ message: 'User not found' });
      }
      console.log(`user successfully deleted`);
      return reply.send({ message: 'User deleted successfully' })

  });

  // Route d'activation définitive du 2FA
  app.post('/:userId/activate2fa', async (request, reply) => {
      const { userId } = request.params;
      const { secret, recoveryCodes } = request.body;
      const db = await openDb();

      if (!secret || !Array.isArray(recoveryCodes)) {
          return reply.code(400).send({ error: "Données 2FA Invalides" });
      }

      try {
          // Mettre à jour l'utilisateur des données 2FA
          await db.run(
              `UPDATE users SET 
                  twoFactorSecret = ?,
                  twoFactorRecoveryCodes = ?,
                  enable2FA = 1,
                  SecurityVersion = SecurityVersion + 1
              WHERE userId = ?`,
              [secret, JSON.stringify(recoveryCodes), userId]
          );
          
          reply.send({ success: true });
      } catch (err) {
          console.error("Erreur d'activation 2FA: ", err);
          reply.code(500).send({ error: "Echec de l'activation 2FA" });
      }
  });

  // Route de désactivation définitive du 2FA
  app.post('/:userId/deactivate2fa', async (request, reply) => {
    try {
        const { userId } = request.params;

        const db = await openDb();
        // Vérifier que la requête est authentifiée
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return reply.code(401).send({ error: "Authentification requise" });
        }

        // Mettre à jour l'utilisateur pour désactiver le 2FA
        const updateResult = await db.run(
            `UPDATE users SET
                twoFactorSecret = NULL,
                twoFactorRecoveryCodes = NULL,
                enable2FA = 0,
                SecurityVersion = SecurityVersion + 1
            WHERE userId = ?`,
            [userId]
        );

        if (updateResult.changes === 0) {
          return reply.code(404).send({ error: "Utilisateur non trouvé" });
        }

        // Requête vers le service de sécurité pour obtenir un nouveau token sans 2FA
        const securityResponse = await fetch("http://security:4003/deactivate-2fa-token", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": authHeader
          },
          body: JSON.stringify({ userId })
        });
        
        if (!securityResponse.ok) {
          throw new Error("Échec de la génération du nouveau token");
        }
        
        const securityData = await securityResponse.json();
        
        // Renvoyer le nouveau token et la confirmation
        reply.send({
          success: true,
          message: "Authentification à deux facteurs désactivée avec succès",
          token: securityData.token
        });
      } catch (err) {
        console.error("Erreur de désactivation 2FA: ", err);
        reply.code(500).send({ error: "Echec de la désactivation 2FA" });
      }
  });

  // Route de mise à jour des codes de récupération 2FA
  app.post('/:userId/new-recovery-codes', async (request, reply) => {
      const userId = request.params.userId;
      const { recoveryCodes } = request.body;
      const db = await openDb();
      
      if (!recoveryCodes || !Array.isArray(recoveryCodes)) {
          return reply.code(400).send({ error: "Données de récupération invalides" });
      }

      try {
          // Convertir les codes de récupération en chaîne JSON
          const recoveryCodesJson = JSON.stringify(recoveryCodes);

          // Mettre à jour les codes de récupération de l'utilisateur
          await db.run(
              `UPDATE users SET
                  twoFactorRecoveryCodes = ?,
                  SecurityVersion = SecurityVersion + 1
              WHERE userId = ?`,
              [recoveryCodesJson, userId]
          );
          return reply.send({ 
              success: true, 
              message: "Codes de récupération mis à jour avec succès",
              remainingCodes: recoveryCodesJson,

          });
      } catch (err) {
          console.error("Erreur de mise à jour des codes de récupération: ", err);
          return reply.code(500).send({ error: "Echec de la mise à jour des codes de récupération" });
      }
  });


  app.post('/:id/upload-base64', async (req, reply) => {
    const db = await openDb();
    const { id } = req.params as { id: string };
    const { image } = req.body as { image: string };

    console.log('Image reçue:', image);

    if(!image || typeof image !== "string"){
      return reply.status(400).send({ error: "Format base64 incorrect."});
    }

    const isValid = await isBase64ImageValid(image);
    if (!isValid) {
      console.log('❌ Image rejetée : format base64 ou type MIME invalide.');
      return reply.status(400).send({ error: "Image base64 invalide ou format incorrect." });
    }

    const matches = image.match(/^data:(image\/\w+);base64,(.+)$/);
    if(!matches) {
      return reply.status(400).send({error: "Format base 64 incorrect."});
    }

    const base64Data = matches[2];

    try {
      await db.run('UPDATE users SET profile_picture = ? WHERE userId = ?', [base64Data, id]);
      return reply.send({ success: true, message: "Image enregistrée", filename: id });
    } catch (error) {
      console.error("Erreur upload base64", error);
      return reply.status(500).send({ error: "Erreur serveur lors de l'enregistrement de l'image"});
    }

  });


  app.get('/:id/preferences', async (req, reply) => {
    const db = await openDb();
    const { id } = req.params;

    try {
      const user = await db.get('SELECT language, language_mode FROM users WHERE userId = ?', [id]);
      if(!user){
        return reply.status(404).send( { message: 'User not found'});
      }

      return reply.send({
        language: user.language,
        languageMode: user.language_mode
      });
    } catch (error) {
      console.error('Error retrieving user preferences:', error);
      return reply.status(500).send( { message: 'Internal server error'});
    }
  });

  app.put('/:id/preferences', async(req, reply) => {
    const db = await openDb();
    const { id } = req.params;
    const { language, languageMode } = req.body;

    if(!language || !languageMode) {
      return reply.status(400).send( { message: 'Language and language mode are required'});
    }

    try {
      const user = await db.get('SELECT * FROM users WHERE userId = ?', [id]);
      if(!user) {
        return reply.status(400).send( { message: 'User not found'});
      }

      const result = await db.run(
        'UPDATE users SET language = ?, language_mode = ? WHERE userId = ?',
        [language, languageMode, id]
      );

      if(result.changes === 0) {
        return reply.status(400).send( { message: 'No preferences were updated' });
      }

      return reply.send( { message: 'Preferences updated successfully'});

    } catch (error) {
      console.error("Error updating user preferences:", error);
      return reply.status(500).send( { message: 'Internal server error'});
    }
  });
}

async function hashUpdatedPassword(password: string): Promise<string | null> {
    try {
        const response = await fetch('http://security:4003/hashpassword',{
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        body: JSON.stringify( { password }),
        });

        if(! response.ok) {
            console.error('Failed to hash password with security service');
            return null;
        }

        const hashedPassword = await response.text();
        return hashedPassword;
    } catch (error) {
        console.error('Error calling the security service to hash the password:', error);
        return null;
    }
}
// server.ts