#include "Game.hpp"

Game::Game(std::string ballSpeed, std::string ballSize, std::string paddleSize, std::string matchId) 
	: _fieldWidth(719),
	  _fieldHeight(359),
	  _leftPaddleY(0),
	  _rightPaddleY(0),
	  _leftScore(0),
	  _rightScore(0),
	  _isPaused(true),
	  _maxScore(5),
	  _paddleSize(paddleSize),
	  _paddleHeight((_paddleSize == "LARGE") ? _fieldHeight * 0.25f : _fieldHeight * 0.15f),
	  _paddleWidth(_fieldWidth * 0.0125f),
	  _margin(_fieldWidth * 0.025f),
	  _ballSpeed(ballSpeed),
	  _ballSpeedVy((_ballSpeed == "FAST") ? _fieldHeight * 0.020f : _fieldHeight * 0.015f),
	  _ballSpeedVx((_ballSpeed == "FAST") ? _paddleWidth * 0.9f : _paddleWidth * 0.66f),
	  _ballSize(ballSize),
	  _ballRadius((_ballSize == "LARGE") ? _fieldHeight * 0.05f : _fieldHeight * 0.03f),
	  _ball(new Ball(_fieldWidth / 2, _fieldHeight / 2, _ballSpeedVx, _ballSpeedVy, _ballRadius,_fieldHeight)),
	  _matchId(matchId)
{
	_leftPaddleY = (_fieldHeight - _paddleHeight) / 2;
	_rightPaddleY = (_fieldHeight - _paddleHeight) / 2;
}


Game::~Game() {
	std::cout << "THE END" << std::endl;
	delete _ball;
}

void Game::update() {
	if (_isPaused || isGameOver())
		return;
	try {
		_ball->update();
		checkCollisions();
		checkScore();
	}
	catch (const std::exception& e) {
		std::cerr << "Error: " << e.what() << std::endl;
	}
	usleep(16000);
}

void Game::checkCollisions() {
    const float collisionMargin = 2.0f;

    float ballX = _ball->getX();
    float ballY = _ball->getY();
    float ballRadius = _ball->getRadius();
    float paddleLeftX = _margin + _paddleWidth;
    float paddleRightX = _fieldWidth - _margin - _paddleWidth;
	const float verticalCollisionMargin = _fieldWidth * 0.010f; 

    bool inLeftXZone = (ballX - ballRadius <= paddleLeftX + collisionMargin) &&
                       (ballX + ballRadius >= _margin - collisionMargin);
    if (inLeftXZone) {
        bool overlapsLeftPaddleX = (ballX - ballRadius <= paddleLeftX + collisionMargin);
		
        bool insideLeftPaddleY = (ballY >= _leftPaddleY - verticalCollisionMargin) &&
                                 (ballY <= _leftPaddleY + _paddleHeight + verticalCollisionMargin);

        // std::cout << "🟥 [LEFT ZONE]" << std::endl; //DEBUG
        // std::cout << "BallX: " << ballX << " | BallY: " << ballY << " | Radius: " << ballRadius << std::endl;
        // std::cout << "Left paddle Y range: " << _leftPaddleY << " - " << (_leftPaddleY + _paddleHeight) << std::endl;
        // std::cout << "Overlap X: " << (overlapsLeftPaddleX ? "YES" : "NO") << " | Inside Y: " << (insideLeftPaddleY ? "YES" : "NO") << " | Vitesse : " << (_ball->getVx() <= 0? "YES" : "NO") << std::endl;
        // std::cout << "Ball Velocity (Vx, Vy): " << _ball->getVx() << " " << _ball->getVy() << std::endl;
        // std::cout << std::endl;

        if (overlapsLeftPaddleX && insideLeftPaddleY && _ball->getVx() <= 0) {
            handlePaddleCollision(_leftPaddleY);
        }
    }

    bool inRightXZone = (ballX + ballRadius >= paddleRightX - collisionMargin) &&
                        (ballX - ballRadius <= _fieldWidth + collisionMargin);
    if (inRightXZone) {
        bool overlapsRightPaddleX = (ballX + ballRadius >= paddleRightX - collisionMargin);
        bool insideRightPaddleY = (ballY >= _rightPaddleY - verticalCollisionMargin) &&
                                  (ballY <= _rightPaddleY + _paddleHeight + verticalCollisionMargin) ;

        // std::cout << "🟦 [RIGHT ZONE]" << std::endl; //DEBUG
        // std::cout << "BallX: " << ballX << " | BallY: " << ballY << " | Radius: " << ballRadius << std::endl;
        // std::cout << "Right paddle Y range: " << _rightPaddleY << " - " << (_rightPaddleY + _paddleHeight) << std::endl;
        // std::cout << "Overlap X: " << (overlapsRightPaddleX ? "YES" : "NO") << " | Inside Y: " << (insideRightPaddleY ? "YES" : "NO") << std::endl;
        // std::cout << "Ball Velocity (Vx, Vy): " << _ball->getVx() << " " << _ball->getVy() << std::endl;
        // std::cout << std::endl;

        if (overlapsRightPaddleX && insideRightPaddleY && _ball->getVx() >= 0) {
            handlePaddleCollision(_rightPaddleY);
        }
    }
}

void Game::handlePaddleCollision(int paddleY) {
	int paddleCenter = paddleY + _paddleHeight / 2;
	int distanceFromCenter = _ball->getY() - paddleCenter;
	int newVy = distanceFromCenter / 6;

	if (newVy == 0)
		newVy = (std::rand() % 2 == 0) ? 1 : -1;

	int vx = _ball->getVx();
	_ball->setSpeed(vx, newVy);
	_ball->reverseX();

// 	std::cout << "[CollisionCheck] BallX: " << _ball->getX() 
//           << " BallY: " << _ball->getY() 
//           << " BallRadius: " << _ball->getRadius() 
//           << " Vx: " << _ball->getVx() 
//           << " Vy: " << _ball->getVy()
//           << " PaddleY_Left: " << _leftPaddleY 
//           << " PaddleY_Right: " << _rightPaddleY << std::endl;
 }

void Game::checkScore() {
	if (_ball->getX() +  _ball->getRadius()  + _margin <= 0 && _ball->getVx() < 0) {
		_rightScore++;
		std::cout << "🎯 Right player gets a point! Score: " << _leftScore << " - " << _rightScore << std::endl;
		resetRound();
		_isPaused = true;
	}
	if (_ball->getX() +   _ball->getRadius() + _margin >= _fieldWidth && _ball->getVx() > 0) {
		_leftScore++;
		std::cout << "🎯 Left player gets a point! Score: " << _leftScore << " - " << _rightScore << std::endl;
		resetRound();
		_isPaused = true;
	}
}

void Game::resetRound() {
	_ball->reset(_fieldWidth / 2, _fieldHeight / 2, _ballSpeedVx, _ballSpeedVy, _ballRadius, _fieldHeight);
	_leftPaddleY = (_fieldHeight - _paddleHeight) / 2;
	_rightPaddleY = (_fieldHeight - _paddleHeight) / 2;
}

void Game::updateOnePaddle(const std::string& side, int y) {
	if (side == "left") {
		_leftPaddleY = y;
	} else if (side == "right") {
		_rightPaddleY = y;
	}
}

// void Game::printDebug() {
// 	std::cout << "🎾 Ball: " << _ball->getX() << ", " << _ball->getY()
// 			  << " | 🏓 Left Paddle: " << _leftPaddleY
// 			  << " | 🏓 Right Paddle: " << _rightPaddleY
// 			  << " | 🔢 Score: " << _leftScore << " - " << _rightScore
// 			  << std::endl;
// }

int Game::getBallX() const { 
	return (_ball->getX());
}

int Game::getBallY() const {
	return (_ball->getY()); 
}

int Game::getBallVx() const { 
	return (_ball->getVx()); 
}

int Game::getBallVy() const { 
	return (_ball->getVy()); 
}

int Game::getLeftScore() const { 
	return (_leftScore); 
}

int Game::getRightScore() const { 
	return (_rightScore); 
}


int Game::getLeftPaddleY() const { 
	return (_leftPaddleY); 
}

int Game::getRightPaddleY() const { 
	return (_rightPaddleY); 
}

std::string Game::getSpeed() const { 
	return (_ballSpeed); 
}

std::string Game::getMatchId() const { 
	return (_matchId); 
}

bool Game::isPaused() const { 
	return (_isPaused); 
}

void Game::resume(std::string ballSpeed, std::string ballSize, std::string paddleSize) {
    _ballSpeed = ballSpeed;
    _ballSize = ballSize;
    _paddleSize = paddleSize;

    _paddleHeight = (_paddleSize == "LARGE") ? _fieldHeight * 0.25f : _fieldHeight * 0.15f;
    _paddleWidth = _fieldWidth * 0.0125f;
    _margin = 2 * _paddleWidth;
    _ballSpeedVy = (_ballSpeed == "FAST") ? _fieldHeight * 0.020f : _fieldHeight * 0.015f;
    _ballSpeedVx = (_ballSpeed == "FAST") ? _paddleWidth * 0.9f : _paddleWidth * 0.66f;

    _ballRadius = (_ballSize == "LARGE") ? _fieldHeight * 0.05f : _fieldHeight * 0.03f;

    if (_ball)
        _ball->reset(_fieldWidth / 2, _fieldHeight / 2, _ballSpeedVx, _ballSpeedVy, _ballRadius, _fieldHeight);

    _isPaused = false;
	//std::cout << "parametros resume : "<< " "<<_leftPaddleY << " "<<_rightPaddleY <<std::endl;
}

bool Game::isGameOver() const { 
	return (_leftScore >= _maxScore || _rightScore >= _maxScore); 
}

