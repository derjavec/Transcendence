#pragma once

#include "Game.hpp"
#include <map>
#include <string>
#include <iostream>
#include <sstream>
#include <cstring>
#include <unistd.h>
#include <fcntl.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <sys/epoll.h>
#include <sqlite3.h>

#include <vector>
#include <errno.h>
#include <queue>

#define MAX_EVENTS 10
#define BUFFER_SIZE 1024

class TCPServer {
	public:
		
		~TCPServer();
		void run();
		static TCPServer* getInstance(int port = 4002);
		void processMessage(int client_fd, const std::string& msg);
		void disconnectClient(int client_fd);
		


	private:
		int _port;
		int _server_fd;
		int _epoll_fd;
		std::map<int, std::string> _residualBuffers;
		std::map<std::string, Game*> _games;
		std::map<int, std::string> _fdToUserId;
		static TCPServer* _instance;
		std::map<std::string, std::string> _userIdToMatchId;
		std::map<int, pthread_t> _clientThreads;
		pthread_mutex_t _globalMutex;
		std::map<std::string, pthread_mutex_t> _matchMutexes;
		std::map<std::string, pthread_t> _gameThreads;
		std::map<std::string, std::string> _lastSentGameState;


		TCPServer(int port);
		void setupServerSocket();
		void epollLoop();
		void handleNewConnection();
		void handleClientMessage(int client_fd);
		void handleSetUser(int client_fd, std::istringstream& stream);
		std::string getUserId(int client_fd);
		std::string getMatchId(const std::string& userId);
		void handleStart(const std::string& matchId, std::istringstream& stream);
		void handleResume(const std::string& matchId, std::istringstream& stream);
		void handleResize(const std::string& matchId, std::istringstream& stream);
		void handleUpdatePaddle(const std::string& matchId, std::istringstream& stream);
		void handleIAPaddleMove(const std::string& command, const std::string& matchId);
		void sendGameState(std::string matchId);
		static void* handleClientWrapper(void* arg);
		static void* gameLoop(void* arg);
};

