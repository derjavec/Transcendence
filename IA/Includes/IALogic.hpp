#ifndef IALOGIC_HPP
#define IALOGIC_HPP

#include <string>
#include <sstream>
#include <iostream>
#include <cstdlib>
#include <vector>

class IALogic {
private:
    time_t _lastUpdateTime;
    float _fieldWidth;
    float _fieldHeight;
    std::string _paddleSize;
    float _paddleHeight;
    float _paddleWidth;
    float _paddleY;
    float _ballX;
    float _ballY;
    std::string _ballSpeed;
    float _ballVx;
    float _ballVy;
    float _offset;  
    int _lastScoreDifference;
    float _speed; 
    float _targetX;
    int _rightScore;
    int _leftScore;
    bool _isPaused;
    bool _gameOverFlag;

public:
    IALogic();
    IALogic(std::string ballSpeed, std::string paddleSize);
    IALogic(const IALogic& other);
    IALogic& operator=(const IALogic& other);
    ~IALogic();

    void updatePaddleY();
    float calculateMarginOfError();
    int getPaddleY() const;
    void updateData(const std::string& message);
    std::vector<std::string> tokenizeMessage(const std::string& message);
    void updateBallState(const std::vector<std::string>& tokens);
    void updateScore(const std::vector<std::string>& tokens);
    void updateState(const std::vector<std::string>& tokens);
    void resumeIA(std::string ballSpeed, std::string paddleSize);
    void resetIA();
   // void resizeIA(int fieldHeight, int fieldWidth);
    bool isGameOver();

private:
    float predictBallY(float ballX, float ballY, float ballVx, float ballVy, float targetX) const;
    float absolute(float value) const;
    float minimum(float a, float b) const;
    float clamp(float value, float minValue, float maxValue) const;
    float convertToFloat(const std::string& str);
    float calculateErrorOffset();
    

};

#endif
