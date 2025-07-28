import Fastify from 'fastify';
import ConnectUsers from './connectionStatus';
import userManagement from './userManagement';

const UMapp = Fastify({
  logger: { level: 'error' }
});

// Endpoint de santé
UMapp.get('/health', async (request, reply) => {
	reply.code(200).send({ status: 'ok', message: 'userManagement is healthy' });
});

UMapp.register(ConnectUsers);
UMapp.register(userManagement);

// Démarrer le serveur
const start = async () => {
    try {
        await UMapp.listen({ port: 4001, host: "0.0.0.0" });
        console.log("UserManagement Container listening on port 4001");
    } catch (err) {
        UMapp.log.error(err);
        process.exit(1);
    }
};

start();