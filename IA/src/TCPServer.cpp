#include "TCPServer.hpp"

TCPServer::TCPServer(int port) : _port(port), _server_fd(-1), _epoll_fd(-1) {}

TCPServer::~TCPServer() {
	std::map<int, IALogic*>::iterator it;
	for (it = _iaLogics.begin(); it != _iaLogics.end(); ++it) {
		delete it->second;
	}
	if (_server_fd != -1)
		close(_server_fd);
	if (_epoll_fd != -1)
		close(_epoll_fd);
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
			} else {
				handleClientMessage(fd);
			}
		}
	}
}

void TCPServer::handleNewConnection() {
	struct sockaddr_in client_addr;
	socklen_t addrlen = sizeof(client_addr);
	int client_fd = accept(_server_fd, (struct sockaddr*)&client_addr, &addrlen);

	if (client_fd == -1) return;

	fcntl(client_fd, F_SETFL, O_NONBLOCK);
	struct epoll_event ev;
	ev.events = EPOLLIN | EPOLLET;
	ev.data.fd = client_fd;
	epoll_ctl(_epoll_fd, EPOLL_CTL_ADD, client_fd, &ev);

	_residualBuffers[client_fd] = "";
	_iaLogics[client_fd] = NULL;
}

void TCPServer::handleClientMessage(int client_fd) {
	char buffer[BUFFER_SIZE];
	int bytesRead = recv(client_fd, buffer, sizeof(buffer) - 1, 0);

	if (bytesRead <= 0) {
		close(client_fd);
		epoll_ctl(_epoll_fd, EPOLL_CTL_DEL, client_fd, NULL);
		delete _iaLogics[client_fd];
		_iaLogics.erase(client_fd);
		_residualBuffers.erase(client_fd);
		std::cout << "❌ Client disconnected: FD " << client_fd << std::endl;
		return;
	}

	buffer[bytesRead] = '\0';
	_residualBuffers[client_fd] += buffer;
	size_t pos;
	while ((pos = _residualBuffers[client_fd].find('\n')) != std::string::npos) {
		std::string message = _residualBuffers[client_fd].substr(0, pos);
		processMessage(client_fd, message);
		_residualBuffers[client_fd].erase(0, pos + 1);
	}
}

void TCPServer::processMessage(int client_fd, const std::string& message) {
	//std::cout << "📩 Mensaje recibido por IA: [" << message << "]" << std::endl;
	std::istringstream stream(message);
	std::string command, matchId, ballSpeed, paddleSpeed, paddleSize, ballSize;
	stream >>  command >> matchId >>ballSpeed >> paddleSpeed >> paddleSize >> ballSize;
	if (command == "IA:START") {
		if (!_iaLogics[client_fd]) {
			_iaLogics[client_fd] = new IALogic( ballSpeed, paddleSize);
			_running[client_fd] = true;
			std::ostringstream oss;
			oss << "{\"type\":\"game:getState\", \"matchId\":\"" << matchId << "\"}\n";
			std::string request = oss.str();
			send(client_fd, request.c_str(), request.length(), 0);
			startPaddleMovementLoop(client_fd, matchId);
		}
	}
	if (command == "IA:RESUME")
		_iaLogics[client_fd]->resumeIA(ballSpeed, paddleSize);
	if (command == "IA:RESET")
		_iaLogics[client_fd]->resetIA();
	else {
		if (_iaLogics[client_fd]) {
			IALogic* logic = _iaLogics[client_fd];
			logic->updateData(message);
		}
	}
	
}

void TCPServer::startPaddleMovementLoop(int client_fd, std::string matchId) {
	ThreadData* data = new ThreadData;
	data->server = this;
	data->client_fd = client_fd;
	data->matchId = matchId; 

	pthread_t thread;
	if (pthread_create(&thread, NULL, TCPServer::paddleMovementTask, static_cast<void*>(data)) != 0) {
		std::cerr << "Error creating paddle movement thread" << std::endl;
		delete data;
	}
	else {
		pthread_detach(thread);
	}
}

void* TCPServer::paddleMovementTask(void* arg) {
	ThreadData* data = static_cast<ThreadData*>(arg);
	TCPServer* server = data->server;
	int client_fd = data->client_fd;
	std::string matchId = data->matchId;
	delete data;

	while (server->_running[client_fd]) {
		std::map<int, IALogic*>::iterator it = server->_iaLogics.find(client_fd);
		if (it != server->_iaLogics.end() && it->second != NULL) {
			IALogic* logic = it->second;
			logic->updatePaddleY();
			int newPaddleY = logic->getPaddleY();
			//std::cout << "prediction d paddle : "<< newPaddleY << std::endl;
			std::ostringstream oss;
			oss << "{"
			<< "\"type\":\"game:paddleMove\","
			<< "\"side\":\"right\","
			<< "\"position\":" << newPaddleY << ","
			<< "\"matchId\":\"" << matchId << "\""
			<< "}\n";		
			std::string response = oss.str();

			send(client_fd, response.c_str(), response.length(), 0);

			if (logic->isGameOver()) {
				server->_running[client_fd] = false;
				break;
			}
		}
		usleep(30000);
	}

	pthread_exit(NULL);
	return NULL;
}

