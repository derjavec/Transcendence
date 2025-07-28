#include "Ball.hpp"

Ball::Ball(float startX, float startY, float maxVy, float maxVx, int ballRadius, int fieldHeight) {
	this->_x = startX;
	this->_y = startY;
	this->_vx = maxVy;
	this->_vy = maxVx;
	this->_startX = startX;
	this->_startY = startY;
	this->_startVx = _vx;
	this->_startVy = _vy;
	this->_minVy = 0.8f * _vy;
	this->_maxVy = _vy;
	this->_minVx = 0.8f * _vx;
	this->_maxVx = _vx;
	this->_ballRadius = ballRadius;
	this->_fieldHeight = fieldHeight;
}

Ball::~Ball () {}

void Ball::update() {
	_x += _vx;
	_y += _vy;
	checkCollision();
}

void Ball::checkCollision() {
	if (_y <= 0 || _y >= _fieldHeight)
		_vy *= -1;
}

void Ball::reverseX() {
	_vx *= -1;
}

void Ball::reset(float startX, float startY, float vx, float vy, int ballRadius, int fieldHeight) {
    _x = startX;
    _y = startY;

    _vx = (rand() % 2 == 0) ? -vx : vx;
    _vy = vy;

    _startX = startX;
    _startY = startY;
    _startVx = vx;
    _startVy = vy;

    _minVy = 0.8f * std::abs(vy);
	_maxVy = std::abs(vy);
	_minVx = 0.8f * std::abs(vx);
	_maxVx = std::abs(vx);


    _ballRadius = ballRadius;
    _fieldHeight = fieldHeight;

}

void Ball::setSpeed(float newVx, float newVy) {
	newVy = std::max(_minVy, std::min(_maxVy, std::abs(newVy)));

	newVx = std::max(_minVx, std::min(_maxVx, std::abs(newVx)));

	_vy = (_vy < 0) ? -newVy : newVy;
	_vx = (_vx < 0) ? -newVx : newVx;
	_startVx = std::abs(newVx);
	_startVy = std::abs(newVy);
}

void Ball::setField(int fieldHeight)
{
	_fieldHeight = fieldHeight;
}

float Ball::getX() const {
	return (_x);
}

float Ball::getY() const {
	return (_y);
}

int Ball::getVx() const {
	return (_vx);
}

int Ball::getVy() const {
	return (_vy);
}

int Ball::getRadius() const {
    return _ballRadius;
}
