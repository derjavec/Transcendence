// Game.ts (game)
import { Ball } from "./Ball";

export class Game {
  ball: Ball;
  leftPaddleY: number;
  rightPaddleY: number;
  leftScore: number = 0;
  rightScore: number = 0;
  isPaused: boolean = true;
  isGameOver: boolean = false;
  maxScore: number = 5;
  fieldWidth: number = 719;
  fieldHeight: number = 359;
  paddleHeight: number;
  paddleWidth: number;
  margin: number;
  matchId: string;
  lastState: string = '';

  constructor(
    public ballSpeed: string,
    public ballSize: string,
    public paddleSize: string,
    matchId: string
  ) {
    this.matchId = matchId;
    this.paddleHeight = paddleSize === 'LARGE' ? this.fieldHeight * 0.25 : this.fieldHeight * 0.15;
    this.paddleWidth = this.fieldWidth * 0.0125;
   // this.margin = this.fieldWidth * 0.0125;
    this.margin = 0;
    const vy = ballSpeed === 'FAST' ? this.fieldHeight * 0.020 : this.fieldHeight * 0.015;
    const vx = ballSpeed === 'FAST' ? this.paddleWidth * 0.9 : this.paddleWidth * 0.66;
    const radius = ballSize === 'LARGE' ? this.fieldHeight * 0.05 : this.fieldHeight * 0.03;
    this.ball = new Ball(this.fieldWidth / 2, this.fieldHeight / 2, vx, vy, radius, this.fieldHeight);
    this.leftPaddleY = (this.fieldHeight - this.paddleHeight) / 2;
    this.rightPaddleY = (this.fieldHeight - this.paddleHeight) / 2;
  }

  pause() {
    this.isPaused = true;
  }

  resume(ballSpeed: string, ballSize: string, paddleSize: string) {
    this.ballSpeed = ballSpeed;
    this.ballSize = ballSize;
    this.paddleSize = paddleSize;
    this.paddleHeight = paddleSize === 'LARGE' ? this.fieldHeight * 0.25 : this.fieldHeight * 0.15;
    const vy = ballSpeed === 'FAST' ? this.fieldHeight * 0.020 : this.fieldHeight * 0.015;
    const vx = ballSpeed === 'FAST' ? this.paddleWidth * 0.9 : this.paddleWidth * 0.66;
    const radius = ballSize === 'LARGE' ? this.fieldHeight * 0.05 : this.fieldHeight * 0.03;
    this.ball.reset(this.fieldWidth / 2, this.fieldHeight / 2, vx, vy, radius, this.fieldHeight);
    this.isPaused = false;
  }

  update() {
    if (this.isPaused || this.isGameOver) 
        return;
    // console.log(`[GameLoop] L=${this.leftPaddleY} R=${this.rightPaddleY}`); //DEBUG

    this.ball.update();
    this.checkCollisions();
    this.checkScore();
  }

  
  checkCollisions() {
    const m = 3;
    const verticalMargin = 5;
    const b = this.ball;
  
    const leftX = this.margin + this.paddleWidth;
    const rightX = this.fieldWidth - this.margin - this.paddleWidth;
  
    const inLeftXZone = b.x - b.radius <= leftX + m && b.x + b.radius >= this.margin - m;
    if (inLeftXZone) {
      const paddleTop = this.leftPaddleY + verticalMargin;
      const paddleBottom = this.leftPaddleY + this.paddleHeight - verticalMargin;
      const insideLeftY = b.y >= paddleTop && b.y <= paddleBottom;
  
      if (b.x - b.radius <= leftX + m && insideLeftY && b.vx < 0) {
        b.x = leftX + b.radius + 1;
        this.handlePaddleCollision(this.leftPaddleY);
      }
    }
  
    const inRightXZone = b.x + b.radius >= rightX - m && b.x - b.radius <= this.fieldWidth - this.margin + m;
    if (inRightXZone) {
      const paddleTop = this.rightPaddleY + verticalMargin;
      const paddleBottom = this.rightPaddleY + this.paddleHeight - verticalMargin;
      const insideRightY = b.y >= paddleTop && b.y <= paddleBottom;
  
      if (b.x + b.radius >= rightX - m && insideRightY && b.vx > 0) {
        b.x = rightX - b.radius - 1;
        this.handlePaddleCollision(this.rightPaddleY);
      }
    }
  }
  
  
  

  handlePaddleCollision(paddleY: number) {
    const paddleCenter = paddleY + this.paddleHeight / 2;
    const distance = this.ball.y - paddleCenter;
    let newVy = distance / 6 || (Math.random() < 0.5 ? 1 : -1);
    this.ball.setSpeed(this.ball.vx, newVy);
    this.ball.reverseX();
  }

  checkScore() {
    const b = this.ball;
    if (b.x + b.radius -+this.margin <= 0 && b.vx < 0) {
      this.rightScore++;
      this.resetRound();
    }
    if (b.x - b.radius - this.margin >= this.fieldWidth && b.vx > 0) {
      this.leftScore++;
      this.resetRound();
    }
    if (this.leftScore >= this.maxScore || this.rightScore >= this.maxScore) {
      this.isGameOver = true;
      this.pause();
    }
  }

  resetRound() {
    this.ball.reset(this.fieldWidth / 2, this.fieldHeight / 2, this.ball.vx, this.ball.vy, this.ball.radius, this.fieldHeight);
    this.leftPaddleY = (this.fieldHeight - this.paddleHeight) / 2;
    this.rightPaddleY = (this.fieldHeight - this.paddleHeight) / 2;
    this.pause();
  }

  updatePaddle(side: string, y: number) {
    // console.log("🔥 [GAME CONTAINER] updating paddles ", side, y); //DEBUG
    if (side === 'left') 
        this.leftPaddleY = y;
    else if (side === 'right') 
        this.rightPaddleY = y;
  }

  getState() {
    return {
      ball: { x: this.ball.x, y: this.ball.y, dx: this.ball.vx, dy: this.ball.vy },
      paddles: { leftY: this.leftPaddleY, rightY: this.rightPaddleY },
      score: { left: this.leftScore, right: this.rightScore },
      isPaused: this.isPaused,
      isGameOver: this.isGameOver,
      gameId: this.matchId,
    };
  }
}
