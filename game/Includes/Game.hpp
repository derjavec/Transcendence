#pragma once
#include "Ball.hpp"
#include <stdexcept>
#include <sstream>
#include <cmath>

class Game {
	private:
		int  _fieldWidth, _fieldHeight;
		int _leftPaddleY, _rightPaddleY;
		int _leftScore, _rightScore;
		bool _isPaused;
		int _maxScore;
		std::string _paddleSize;
		int _paddleHeight, _paddleWidth;
		int _margin;
		std::string _ballSpeed;
		float _ballSpeedVy;
		float _ballSpeedVx;
		std::string _ballSize;
		int _ballRadius;
		Ball* _ball;
		std::string	_matchId;

	public:
		Game(std::string ballSpeed, std::string ballSize, std::string paddleSize, std::string matchId);
		~Game();

		void update();
		//void resize(int fieldHeight, int fieldWidth);
		void checkScore();
		void checkCollisions();
		void handlePaddleCollision(int paddleY);
		void resetRound();
		void updateOnePaddle(const std::string& side, int y);
		//void resize(int newWidth, int newHeight);
		void printDebug();

		int getBallX() const;
		int getBallY() const;
		int getBallVx() const;
		int getBallVy() const;

		int getLeftScore() const;
		int getRightScore() const;
		int getLeftPaddleY() const;
		int getRightPaddleY() const;
		std::string getSpeed() const;
		std::string getMatchId() const;
		bool isPaused() const;
		void resume(std::string ballSpeed, std::string ballSize, std::string paddleSize);
		bool isGameOver() const;

};
