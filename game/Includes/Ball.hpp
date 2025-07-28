#pragma once
#include <iostream>
#include <unistd.h> 
#include <fstream>
#include <cstdlib>


class Ball {
	private:
		float _x, _y;
		int _vx, _vy;
		float _startX, _startY;
		int _startVx, _startVy;
		float _maxVy, _minVy;
		float _maxVx, _minVx;
		int _ballRadius;
		int _fieldHeight;


	public:

		Ball(float startX, float startY, float maxVy, float maxVx, int ballRadius, int fieldheight);
		~Ball();
		
		void update();
		void checkCollision();
		void reverseX();
		void reset(float startX, float startY, float maxVy, float maxVx, int ballRadius, int fieldheight);
		void setSpeed(float newVx, float newVy);
		//void resize(float scaleX, float scaleY, float newRadius, int newFieldHeight);
		float getX() const;
		float getY() const;
		// float getPrevX() const;
		// float getPrevY() const;
		int getVx() const;
		int getVy() const;
		int getRadius() const;
		void setField(int fieldHeight);

};

