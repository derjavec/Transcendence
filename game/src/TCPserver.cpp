#include "TCPserver.hpp"


TCPServer* TCPServer::_instance = NULL;


TCPServer* TCPServer::getInstance(int port) {
        if (_instance == NULL)
            _instance = new TCPServer(port);
        return _instance;
    }

TCPServer::TCPServer(int port) : _port(port), _server_fd(-1), _epoll_fd(-1)
{
	pthread_mutex_init(&_globalMutex, NULL);

}

TCPServer::~TCPServer() {

	std::map<std::string, Game*>::iterator it;
	for (it = _games.begin(); it != _games.end(); ++it) {
		delete it->second;
	}
	
	if (_server_fd != -1) close(_server_fd);
	if (_epoll_fd != -1) close(_epoll_fd);
}

void TCPServer::run() {
	setupServerSocket();
	epollLoop();
}

void TCPServer::setupServerSocket() {
	_server_fd = socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK, 0);

	struct sockaddr_in addr;
	std::memset(&addr, 0, sizeof(addr));
	addr.sin_family = AF_INET;
	addr.sin_addr.s_addr = INADDR_ANY;
	addr.sin_port = htons(_port);

	bind(_server_fd, (struct sockaddr*)&addr, sizeof(addr));
	listen(_server_fd, SOMAXCONN);

	_epoll_fd = epoll_create1(0);
	struct epoll_event ev;
	ev.events = EPOLLIN;
	ev.data.fd = _server_fd;
	epoll_ctl(_epoll_fd, EPOLL_CTL_ADD, _server_fd, &ev);

	std::cout << "⌛ waiting to establish connections on port: " << _port << std::endl;
}

void TCPServer::epollLoop() {
	struct epoll_event events[MAX_EVENTS];

	while (true) {
		int n = epoll_wait(_epoll_fd, events, MAX_EVENTS, 1);

		for (int i = 0; i < n; i++) {
			int fd = events[i].data.fd;

			if (fd == _server_fd) {
				handleNewConnection();
			 }
		}
	}
}

void* TCPServer::gameLoop(void* arg) {
    std::string matchId = *(std::string*)arg;
    delete (std::string*)arg;
    TCPServer* server = TCPServer::getInstance();

    while (true) {
        usleep(1000);

        pthread_mutex_lock(&server->_matchMutexes[matchId]);

        if (server->_games.count(matchId) > 0 && server->_games[matchId]) {			
            server->_games[matchId]->update();
            server->sendGameState(matchId);
        }
        pthread_mutex_unlock(&server->_matchMutexes[matchId]);
    }
    pthread_exit(NULL);
}


void* TCPServer::handleClientWrapper(void* arg) {
	int client_fd = *((int*)arg);
	delete (int*)arg;

	TCPServer* server = TCPServer::getInstance();
    std::string userId = "";
    std::string matchId = "";

	char buffer[BUFFER_SIZE];
	std::string residual;

	while (true) {
		int bytesRead = recv(client_fd, buffer, sizeof(buffer) - 1, 0);
		if (bytesRead == -1) {
			if (errno == EAGAIN || errno == EWOULDBLOCK) {
				continue;
			} else {
				perror("recv failed");
				server->disconnectClient(client_fd);
				break;
			}
		} else if (bytesRead == 0) {
			server->disconnectClient(client_fd);
			break;
		}else {
            buffer[bytesRead] = '\0';
            residual += buffer;
            size_t pos;
            while ((pos = residual.find('\n')) != std::string::npos) {
                std::string message = residual.substr(0, pos);
                server->processMessage(client_fd, message);
                residual.erase(0, pos + 1);
            }
        }
    }
	pthread_exit(NULL);
}

void TCPServer::handleNewConnection() {
	struct sockaddr_in client_addr;
	socklen_t addrlen = sizeof(client_addr);
	int client_fd = accept(_server_fd, (struct sockaddr*)&client_addr, &addrlen);
	if (client_fd < 0) {
		perror("accept");
		return;
	}
	fcntl(client_fd, F_SETFL, O_NONBLOCK);
	struct epoll_event ev;
	ev.events = EPOLLIN | EPOLLET;
	ev.data.fd = client_fd;
	epoll_ctl(_epoll_fd, EPOLL_CTL_ADD, client_fd, &ev);

	_residualBuffers[client_fd] = "";

	pthread_t thread;
	int* pClientFd = new int(client_fd);

	if (pthread_create(&thread, NULL, TCPServer::handleClientWrapper, (void*)pClientFd) != 0) {
		perror("pthread_create");
		close(client_fd);
		delete pClientFd;
		return;
	}
	pthread_mutex_lock(&_globalMutex);
	_clientThreads[client_fd] = thread;
	pthread_mutex_unlock(&_globalMutex);

	// std::cout << "✅ New client connected: FD " << client_fd << std::endl; // DEBUG
}

void TCPServer::disconnectClient(int client_fd) {
	pthread_mutex_lock(&_globalMutex);

	std::string userId = _fdToUserId.count(client_fd) ? _fdToUserId[client_fd] : "";
	std::string matchId = _userIdToMatchId.count(userId) ? _userIdToMatchId[userId] : "";

	if (!matchId.empty() && _games.count(matchId)) {
		if (_gameThreads.count(matchId)) {
			pthread_cancel(_gameThreads[matchId]);
			pthread_detach(_gameThreads[matchId]);
			_gameThreads.erase(matchId);
			// std::cout << "🧹 Game loop thread cancelled for matchId " << matchId << std::endl; //DEBUG
		}

		delete _games[matchId];
		_games.erase(matchId);
		std::cout << "🗑️ Deleted game for matchId " << matchId << std::endl;
		if (_matchMutexes.count(matchId)) {
			pthread_mutex_destroy(&_matchMutexes[matchId]);
			_matchMutexes.erase(matchId);
		}

	}

	close(client_fd);
	_fdToUserId.erase(client_fd);
	_userIdToMatchId.erase(userId);
	_residualBuffers.erase(client_fd);

	if (_clientThreads.count(client_fd)) {
		pthread_detach(_clientThreads[client_fd]); // Limpieza
		_clientThreads.erase(client_fd);
	}

	pthread_mutex_unlock(&_globalMutex);

	std::cout << "❌ Client disconnected (from thread): FD " << client_fd << std::endl;
}


void TCPServer::processMessage(int client_fd, const std::string& message) {
//	std::cout << "📩 Mensaje recibido por GAME: [" << message << "]" << std::endl;

	std::istringstream stream(message);
	std::string command;
	stream >> command;

	if (command == "SET_USER") {
		handleSetUser(client_fd, stream);
		return;
	}

	std::string userId = getUserId(client_fd);
	if (userId.empty()) {
		std::cerr << "⚠️ Unknown userId for client_fd " << client_fd << std::endl;
		return;
	}

	std::string matchId = getMatchId(userId);
	if (matchId.empty()) {
		std::cerr << "⚠️ No matchId registered for userId " << userId << std::endl;
		return;
	}

	if (command == "START") handleStart(matchId, stream);
	else if (command == "RESUME") handleResume(matchId, stream);
	else if (command == "UPDATE_PADDLE") handleUpdatePaddle(matchId, stream);
	else if (command == "GET_STATE") sendGameState(matchId);
	else if (command.rfind("IA:PADDLE_MOVE", 0) == 0) handleIAPaddleMove(command, matchId);
}

void TCPServer::handleSetUser(int client_fd, std::istringstream& stream) {
	std::string userId, matchId;
	stream >> userId >> matchId;
	_fdToUserId[client_fd] = userId;
	_userIdToMatchId[userId] = matchId;
	std::cout << "📝 client_fd " << client_fd << " associated with userId " << userId << " and matchId " << matchId << std::endl;
}

std::string TCPServer::getUserId(int client_fd) {
	if (_fdToUserId.count(client_fd)) return _fdToUserId[client_fd];
	return "";
}

std::string TCPServer::getMatchId(const std::string& userId) {
	if (_userIdToMatchId.count(userId)) return _userIdToMatchId[userId];
	return "";
}

void TCPServer::handleStart(const std::string& matchId, std::istringstream& stream) {
	std::string ballSpeed, paddleSpeed, paddleSize, ballSize;

	stream >>  ballSpeed >> paddleSpeed >> paddleSize >> ballSize ;
	pthread_mutex_t& mtx = _matchMutexes[matchId];
	if (_matchMutexes.find(matchId) == _matchMutexes.end()) {
		pthread_mutex_init(&mtx, NULL);
	}
	pthread_mutex_lock(&mtx);

	if (_games.find(matchId) == _games.end() || _games[matchId]->isGameOver()) {
		delete _games[matchId];
		_games[matchId] = new Game(ballSpeed, ballSize, paddleSize, matchId);

		std::string* pMatchId = new std::string(matchId);
		pthread_t gameThread;
		if (pthread_create(&gameThread, NULL, gameLoop, (void*)pMatchId) != 0) {
			perror("Error creating game loop thread");
			delete pMatchId;
		} else {
			_gameThreads[matchId] = gameThread;
		}

		std::cout << "🎮 New game started for matchId: " << matchId << std::endl;
	} else {
		_games[matchId]->resume( ballSpeed, ballSize, paddleSize);
	}

	pthread_mutex_unlock(&mtx);
}

void TCPServer::handleResume(const std::string& matchId, std::istringstream& stream) {
	std::string ballSpeed, paddleSpeed, paddleSize, ballSize;
	stream >> ballSpeed >> paddleSpeed >> paddleSize >> ballSize;

	if (_games.find(matchId) != _games.end()) {
		_games[matchId]->resume( ballSpeed, ballSize, paddleSize);
	}
}

void TCPServer::handleUpdatePaddle(const std::string& matchId, std::istringstream& stream) {
	std::string side;
	int pos;
	stream >> side >> pos;
	if (_games.find(matchId) != _games.end())
		_games[matchId]->updateOnePaddle(side, pos);
}

void TCPServer::handleIAPaddleMove(const std::string& command, const std::string& matchId) {
	size_t pos = command.find(":", 14);
	if (pos != std::string::npos) {
		std::string paddleYStr = command.substr(pos + 1);
		std::istringstream iss(paddleYStr);
		int paddleY;
		if (iss >> paddleY) {
			if (_games[matchId]){
				_games[matchId]->updateOnePaddle("right", paddleY);
				std::cout << "right paddle in game : "<<_games[matchId]->getRightPaddleY()<<std::endl;}
		} else {
			std::cout << "Error: Could not convert paddleY to integer: " << paddleYStr << std::endl;
		}
	} else {
		std::cout << "Error: Second ':' not found in command: " << command << std::endl;
	}
}


void TCPServer::sendGameState(std::string matchId) {
	if (_games.find(matchId) == _games.end())
		return;
	std::ostringstream stream;
	stream <<  "GAME_STATE:"
	<< _games[matchId]->getBallX() << ":"
	<< _games[matchId]->getBallY() << ":"
	<< _games[matchId]->getBallVx() << ":"
	<< _games[matchId]->getBallVy() << ":"
	<< _games[matchId]->getLeftPaddleY() << ":"
	<< _games[matchId]->getRightPaddleY() << ":"
	<< _games[matchId]->getLeftScore() << ":"
	<< _games[matchId]->getRightScore() << ":"
	<< (_games[matchId]->isPaused() ? "1" : "0") << ":"
	<< (_games[matchId]->isGameOver() ? "1" : "0") << ":"
	<< _games[matchId]->getMatchId()
	<< "\n";

	std::string lastState = stream.str();

    if (_lastSentGameState[matchId] == lastState)
        return;
    _lastSentGameState[matchId] = lastState;
	std::string msg = stream.str();
	std::map<int, std::string>::iterator it;
	for (it = _fdToUserId.begin(); it != _fdToUserId.end(); ++it) {
		std::string userId = it->second;
		std::string userMatchId = _userIdToMatchId[userId];
		if (userMatchId == matchId) {
			send(it->first, msg.c_str(), msg.size(), 0);
		}
	}
}
