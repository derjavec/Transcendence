//auth-routes.ts
import { FastifyInstance } from "fastify";
import axios from "axios";

export default async function (app: FastifyInstance) {

  // Configuration du routage des services
  const serviceRoutes = {
    // Format: 'prefixe': {service: 'nom_service', port: 'port_number'}
    'auth': { service: 'security', port: 4003 },
    'users': { service: 'userManagement', port: 4001 },
    'game': { service: 'game', port: 4002 },
    'match': { service: 'matchmaking', port: 4004 },
    'friends': { service: 'friendzone', port: 4006 },
    'tournament': { service: 'tournament', port: 4007}
  };
  // Routeur generique pour les services
  app.all('/:service/*', async (request, reply) => {
    const { service } = request.params as { service: string };

    // Verifier si le service est configure
    if (!serviceRoutes[service]) {
      return reply.code(404).send({ error: 'Service not found' });
    }

    // Extraire le chemin de la requête
    const restPath = request.params['*'] as string;
    const { service: serviceName, port } = serviceRoutes[service];
    
    // Construire l'url cible
    const targetUrl = `http://${serviceName}:${port}/${restPath}`;

    // console.log(`Service: ${service}, Path: ${restPath}`);
    // console.log(`Redirection vers ${targetUrl}`);
    
    try {

      // Transférer tous les en-têtes, sauf Authorization si absent
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(request.headers)) {
        if (typeof value === 'string' && key.toLowerCase() !== 'authorization') {
          headers[key] = value;
        }
      }

      // Ajouter l'en-tête d'autorisation si présent
      if (request.headers.authorization) {
        headers['Authorization'] = request.headers.authorization;
      }

      // Effectuer la requête avec la méthode HTTP d'origine
      const response = await axios({
        method: request.method,
        url: targetUrl,
        headers,
        data: request.method !== 'GET' ? request.body : undefined,
        validateStatus: () => true // Accepter tous les codes de statut pour les gérer nous-mêmes
      });
      
      // Transmettre le code de statut, les en-têtes et le corps de la réponse
      reply.code(response.status);
      
      // Copier les en-têtes pertinents
      for (const [key, value] of Object.entries(response.headers)) {
        if (key.toLowerCase() !== 'content-length') {
          reply.header(key, value);
        }
      }
      
      return reply.send(response.data);
    } catch (error) {
      console.error(`Erreur lors de la redirection vers ${targetUrl}:`, error);
      
      if (error.response) {
        return reply.code(error.response.status).send(error.response.data);
      }
      
      return reply.code(500).send({
        error: `Communication avec le service ${service} échouée`,
        details: error.message
      });
    }
  });
  
  app.post('/setup-2fa', async (request, reply) => {
    try {
      // Récupérer l'en-tête d'autorisation
      const authHeader = request.headers.authorization;
      
      // Appeler le service security en transmettant l'en-tête d'autorisation
      const response = await axios.post('http://security:4003/setup-2fa', request.body, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        }
      });
      
      return reply.code(response.status).send(response.data);
    } catch (error) {
      console.error("Erreur lors de la configuration 2FA:", error);
      
      if (error.response) {
        return reply.code(error.response.status).send(error.response.data);
      }
      
      return reply.code(500).send({ 
        error: "Erreur lors de la configuration 2FA",
        details: error.message 
      });
    }
  });

  app.post('/verify-2fa', async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      
      const response = await axios.post('http://security:4003/verify-2fa', request.body, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        }
      });
      
      return reply.code(response.status).send(response.data);
    } catch (error) {
      console.error("Erreur lors de la vérification 2FA:", error);
      
      if (error.response) {
        return reply.code(error.response.status).send(error.response.data);
      }
      
      return reply.code(500).send({ 
        error: "Échec de la vérification 2FA",
        details: error.message 
      });
    }
  });

  app.post('/rescueCode-2fa', async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      
      const response = await axios.post('http://security:4003/rescueCode-2fa', request.body, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        }
      });
      
      return reply.code(response.status).send(response.data);
    } catch (error) {
      console.error("Erreur lors de la vérification du code de secours:", error);
      
      if (error.response) {
        return reply.code(error.response.status).send(error.response.data);
      }
      
      return reply.code(500).send({ 
        error: "Échec de la vérification du code de secours",
        details: error.message 
      });
    }
  });
  
}
