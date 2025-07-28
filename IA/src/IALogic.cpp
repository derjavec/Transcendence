#include "IALogic.hpp"

IALogic::IALogic(std::string ballSpeed, std::string paddleSize)
{
    _lastUpdateTime = time(NULL);

    _fieldHeight = 359;
    _fieldWidth = 719;
    _paddleSize = paddleSize;
    _paddleHeight = (_paddleSize == "LARGE") ? _fieldHeight * 0.25f : _fieldHeight * 0.15f;
    _paddleWidth = _fieldWidth * 0.0125f;
    _paddleY = (_fieldHeight - _paddleHeight) / 2;
    _ballX = _fieldWidth / 2;
    _ballY = _fieldHeight / 2;
    _ballSpeed = ballSpeed;
    _ballVx = (_ballSpeed == "FAST") ? _paddleWidth * 0.9f : _paddleWidth * 0.66f;
    _ballVy = (_ballSpeed == "FAST") ? _fieldHeight * 0.020f : _fieldHeight * 0.015f;
    _offset = 0;
    _lastScoreDifference = 0;
    _speed = std::abs(_ballVy) * 1.1f;
    _targetX = _fieldWidth - _paddleWidth - 10;
    _rightScore = 0;
    _leftScore = 0;
    _isPaused = true;
    _gameOverFlag = false;
}


IALogic::IALogic(const IALogic& other)
    : _lastUpdateTime(other._lastUpdateTime),
      _fieldWidth(other._fieldWidth),
      _fieldHeight(other._fieldHeight),
      _paddleSize(other._paddleSize),
      _paddleHeight(other._paddleHeight),
      _paddleWidth(other._paddleWidth),
      _paddleY(other._paddleY),
      _ballX(other._ballX),
      _ballY(other._ballY),
      _ballSpeed(other._ballSpeed),
      _ballVx(other._ballVx),
      _ballVy(other._ballVy),
      _offset(other._offset),
      _lastScoreDifference(other._lastScoreDifference),
      _speed(other._speed),
      _targetX(other._targetX),
      _rightScore(other._rightScore),
      _leftScore(other._leftScore),
      _isPaused(other._isPaused),
      _gameOverFlag(other._gameOverFlag)
{}

IALogic& IALogic::operator=(const IALogic& other) {
    if (this != &other) {
        _lastUpdateTime = other._lastUpdateTime;
        _fieldWidth = other._fieldWidth;
        _fieldHeight = other._fieldHeight;
        _paddleSize = other._paddleSize;
        _paddleHeight = other._paddleHeight;
        _paddleWidth = other._paddleWidth;
        _paddleY = other._paddleY;
        _ballX = other._ballX;
        _ballY = other._ballY;
        _ballSpeed = other._ballSpeed;
        _ballVx = other._ballVx;
        _ballVy = other._ballVy;
        _offset = other._offset;
        _lastScoreDifference = other._lastScoreDifference;
        _speed = other._speed;
        _targetX = other._targetX;
        _rightScore = other._rightScore;
        _leftScore = other._leftScore;
        _isPaused = other._isPaused;
        _gameOverFlag = other._gameOverFlag;
    }
    return *this;
}



IALogic::~IALogic() {}

void IALogic::updatePaddleY() {
    if (_isPaused || _ballX < _fieldWidth / 2.5f || std::abs(_ballX - _fieldWidth / 2.0f) < 5.0f)
        return;
        
    float rawPrediction = predictBallY(_ballX, _ballY, _ballVx, _ballVy, _targetX);
    float marginOfError = calculateMarginOfError();
    _offset = calculateErrorOffset();
    float predictedBallY = rawPrediction + _offset;
    float paddleCenterY = _paddleY + (_paddleHeight / 2.0f);
    float distance = absolute(predictedBallY - paddleCenterY);
    float dynamicSpeed = std::min(_speed, distance * 0.5f * marginOfError);
    if (std::abs(_ballX - _targetX) < 100.0f)
        dynamicSpeed = dynamicSpeed * 3.0f;
    //std::cout << "bola predecida en :" << predictedBallY << std::endl;
    if (predictedBallY > paddleCenterY)
        _paddleY += dynamicSpeed;
    else if (predictedBallY < paddleCenterY)
        _paddleY -= dynamicSpeed;
    _paddleY = clamp(_paddleY, 0.0f, _fieldHeight - _paddleHeight);
    //std::cout << "paddle predecido en :" << _paddleY << "to " << _paddleY + _paddleHeight << std::endl;
}

float IALogic::calculateMarginOfError() {
    int scoreDifference = _leftScore - _rightScore;

    return clamp(0.5f + (scoreDifference / 10.0f) * 0.4f, 0.3f, 0.7f);
}

int IALogic::getPaddleY() const {
    return static_cast<int>(_paddleY);
}

void IALogic::updateData(const std::string& message) {
    //std::cout << "mensaje recibido en ia : "<< message << std::endl;
    std::vector<std::string> tokens = tokenizeMessage(message);
    if (tokens.size() < 12 || tokens[0] != "GAME_STATE") {
        return;
    }
    time_t currentTime = time(NULL);
    if (difftime(currentTime, _lastUpdateTime) < 1.0) {
            return;
        }
    _lastUpdateTime = currentTime;
    
    updateBallState(tokens);
    updateScore(tokens);
    updateState(tokens);
}

std::vector<std::string> IALogic::tokenizeMessage(const std::string& message) {
    std::vector<std::string> tokens;
    std::istringstream stream(message);
    std::string token;

    while (std::getline(stream, token, ':')) {
        tokens.push_back(token);
    }
    return tokens;
}

void IALogic::updateBallState(const std::vector<std::string>& tokens) {
    try {
        _ballX = convertToFloat(tokens.at(1));
        _ballY = convertToFloat(tokens.at(2));
        _ballVx = convertToFloat(tokens.at(3));
        _ballVy = convertToFloat(tokens.at(4));
    } catch (const std::exception& e) {
        std::cerr << "⚠️ Failed to update ball state:" << e.what() << std::endl;
    }
}

void IALogic::updateScore(const std::vector<std::string>& tokens) {
    try {
        _leftScore = convertToFloat(tokens.at(7));
        _rightScore = convertToFloat(tokens.at(8));
    } catch (const std::exception& e) {
        std::cerr << "⚠️ Failed to update score:" << e.what() << std::endl;
    }
}

void IALogic::updateState(const std::vector<std::string>& tokens) {
    try {
        _isPaused = convertToFloat(tokens.at(9));
        _gameOverFlag = convertToFloat(tokens.at(10));
    } catch (const std::exception& e) {
        std::cerr << "⚠️ Failed to update state:" << e.what() << std::endl;
    }
}

void IALogic::resumeIA(std::string ballSpeed, std::string paddleSize)
{
    _isPaused = false;
    _paddleSize = paddleSize;
    _paddleHeight = (_paddleSize == "LARGE") ? _fieldHeight * 0.25f : _fieldHeight * 0.15f; 
    _paddleY = (_fieldHeight - _paddleHeight) / 2;
    _ballX = _fieldWidth / 2;
    _ballY = _fieldHeight / 2;
    _ballSpeed = ballSpeed;
    _ballVx = (_ballSpeed == "FAST") ? _paddleWidth * 0.9f : _paddleWidth * 0.66f;
    _ballVy = (_ballSpeed == "FAST") ? _fieldHeight * 0.020f : _fieldHeight * 0.015f;
    _speed = std::abs(_ballVy) * 1.1f;
}

void IALogic::resetIA()
{
    _isPaused = true;
     _paddleY = _fieldHeight / 2 - _paddleHeight / 2;
}

float IALogic::predictBallY(float ballX, float ballY, float ballVx, float ballVy, float targetX) const {
    float predictedY = ballY;
    float predictedX = ballX;
    float vx = ballVx;
    float vy = ballVy;

    while ((vx > 0.0f && predictedX < targetX) || (vx < 0.0f && predictedX > targetX)) {
        float timeToWallY;
        if (vy > 0.0f) {
            timeToWallY = (_fieldHeight - predictedY) / vy;
        } else {
            timeToWallY = (0.0f - predictedY) / vy;
        }

        float timeToTargetX = (targetX - predictedX) / vx;
        const float MIN_X_DISTANCE = _fieldHeight * 0.015f;
        if (absolute(timeToWallY) < absolute(timeToTargetX) && absolute(targetX - predictedX) > MIN_X_DISTANCE) {
            predictedY += vy * timeToWallY;
            predictedX += vx * timeToWallY;
            vy = -vy;
        } else {
            predictedY += vy * timeToTargetX;
            predictedX += vx * timeToTargetX;
            break;
        }
    } 
    return predictedY;
}

float IALogic::absolute(float value) const {
    if (value < 0.0f) {
        return -value;
    }
    return value;
}

float IALogic::minimum(float a, float b) const {
    if (a < b) {
        return a;
    }
    return b;
}

float IALogic::clamp(float value, float minValue, float maxValue) const {
    if (value < minValue) {
        return minValue;
    }
    if (value > maxValue) {
        return maxValue;
    }
    return value;
}

float IALogic::convertToFloat(const std::string& str) {
    std::stringstream ss(str);
    float value;
    ss >> value;
    if (ss.fail()) {
        throw std::invalid_argument("Invalid float: " + str);
    }
    return value;
}

float IALogic::calculateErrorOffset() {
    int scoreDifference = _rightScore - _leftScore;
    if (scoreDifference == _lastScoreDifference)
        return (_offset);
    _lastScoreDifference = scoreDifference;
    float normalized = clamp(scoreDifference / 10.0f, 0.0f, 1.0f);

    return normalized * _paddleHeight * 1.5f;
}

bool IALogic::isGameOver() {
    return _gameOverFlag;
}
