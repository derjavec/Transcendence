#pragma once

#include "IALogic.hpp"
#include <map>
#include <cstring>
#include <unistd.h>
#include <fcntl.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <sys/epoll.h>
#include <pthread.h>
#include <ctime>


#define MAX_EVENTS 10
#define BUFFER_SIZE 1024

class TCPServer {
	public:
		TCPServer(int port);
		~TCPServer();
		void run(); // init server

	private:

		struct ThreadData {
			TCPServer* server;
			int client_fd;
			std::string matchId;
		};
		std::map<int, bool> _running;
		int _port;
		int _server_fd;
		int _epoll_fd;
		std::map<int, std::string> _residualBuffers;
		std::map<int, IALogic*> _iaLogics;

		void setupServerSocket();
		void epollLoop();
		void handleNewConnection();
		void handleClientMessage(int client_fd);
		void processMessage(int client_fd, const std::string& msg);
		void startStatePolling(int fd, std::string matchId);
		static void* statePollingTask(void* arg);
		void startPaddleMovementLoop(int client_fd, std::string matchId);
		static void* paddleMovementTask(void* arg);
		

};

