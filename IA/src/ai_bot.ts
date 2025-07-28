// // ai_bot.ts

export class AIBot {
  fieldWidth = 719;
  fieldHeight = 359;
  paddleWidth = this.fieldWidth * 0.0125;
  paddleHeight: number;
  paddleY: number;
  matchId: string;

  ball = { x: this.fieldWidth / 2, y: this.fieldHeight / 2, dx: 1, dy: 1 };

  isPaused = true;
  isGameOver = false;
  speed = 0;
  offset = 0;
  lastScoreDifference = 0;
  rightScore = 0;
  leftScore = 0;

  constructor(
    public ballSpeed: string,
    public ballSize: string,
    public paddleSize: string,
    matchId: string
  ) {
    this.matchId = matchId;
    this.paddleHeight = paddleSize === 'LARGE' ? this.fieldHeight * 0.25 : this.fieldHeight * 0.15;
    this.paddleY = (this.fieldHeight - this.paddleHeight) / 2;
    this.speed = Math.abs(this.ball.dy) * 1.1;
  }

  clamp(value: number, minValue: number, maxValue: number): number {
    return Math.max(minValue, Math.min(maxValue, value));
  }

  absolute(value: number): number {
    return Math.abs(value);
  }

  predictBallY(ballX: number, ballY: number, dx: number, dy: number, targetX: number): number {
    let predictedX = ballX;
    let predictedY = ballY;
    let vx = dx;
    let vy = dy;

    while ((vx > 0 && predictedX < targetX) || (vx < 0 && predictedX > targetX)) {
      const timeToWallY = vy > 0
        ? (this.fieldHeight - predictedY) / vy
        : -predictedY / vy;
      const timeToTargetX = (targetX - predictedX) / vx;
      const minXDistance = this.fieldHeight * 0.015;

      if (this.absolute(timeToWallY) < this.absolute(timeToTargetX) && this.absolute(targetX - predictedX) > minXDistance) {
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

  calculateMarginOfError(): number {
    const scoreDifference = this.leftScore - this.rightScore;
    return this.clamp(1 + (scoreDifference / 5) * 0.5, 0.8, 1.8);

  }

  calculateErrorOffset(): number {
    const scoreDifference = this.rightScore - this.leftScore;
    if (scoreDifference === this.lastScoreDifference) return this.offset;

    this.lastScoreDifference = scoreDifference;
    const normalized = this.clamp(scoreDifference / 5, 0, 1);
    return normalized * this.paddleHeight * 2;
  }

  private lastScoreDiff: number = 0;
  private lastReactionRatio: number = 0.45;

  calculateReactionThreshold(): number {
    const scoreDiff = this.rightScore - this.leftScore;

    if (scoreDiff === this.lastScoreDiff) {
      return this.lastReactionRatio;
    }

    this.lastScoreDiff = scoreDiff;

    const minRatio = 0.45;
    const maxRatio = 0.75;
    const normalized = this.clamp(scoreDiff / 5, 0, 1);

    this.lastReactionRatio = minRatio + normalized * (maxRatio - minRatio);
    return this.lastReactionRatio;
  }

  

  tick() {
    if (this.isPaused || this.isGameOver) return;

    const reactionRatio = this.calculateReactionThreshold();
    const reactionX = this.fieldWidth * reactionRatio;
    if (this.ball.x < reactionX) return;

    const rawPrediction = this.predictBallY(
      this.ball.x,
      this.ball.y,
      this.ball.dx,
      this.ball.dy,
      this.fieldWidth - this.paddleWidth - 10
    );

    const marginOfError = this.calculateMarginOfError();
    this.offset = this.calculateErrorOffset();
    const predictedBallY = rawPrediction + this.offset;
    const paddleCenterY = this.paddleY + this.paddleHeight / 2;
    const distance = this.absolute(predictedBallY - paddleCenterY);
    let dynamicSpeed = Math.min(this.speed, distance * 0.5 * marginOfError);

    // if (this.absolute(this.ball.x - (this.fieldWidth - this.paddleWidth - 10)) < 100) {
    //   dynamicSpeed *= 3;
    // }

    if (predictedBallY > paddleCenterY) {
      this.paddleY += dynamicSpeed;
    } else {
      this.paddleY -= dynamicSpeed;
    }

    this.paddleY = this.clamp(this.paddleY, 0, this.fieldHeight - this.paddleHeight);
  }

  private lastUpdate = 0;
  updateState(state: any) {
    const now = Date.now();
    if (now - this.lastUpdate < 1000) return;
    this.lastUpdate = Date.now();
    this.ball = {
      x: state.ball.x,
      y: state.ball.y,
      dx: state.ball.dx,
      dy: state.ball.dy
    };
    this.leftScore = state.score?.left || 0;
    this.rightScore = state.score?.right || 0;
    this.isPaused = state.isPaused;
    this.isGameOver = state.isGameOver;
  }

  reset() {
    this.isPaused = true;
    this.paddleY = (this.fieldHeight - this.paddleHeight) / 2;
  }

  resume(ballSpeed: string, ballSize: string, paddleSize: string) {
    this.ballSpeed = ballSpeed;
    this.ballSize = ballSize;
    this.paddleSize = paddleSize;
    this.paddleHeight = paddleSize === 'LARGE' ? this.fieldHeight * 0.25 : this.fieldHeight * 0.15;
    this.paddleY = (this.fieldHeight - this.paddleHeight) / 2;
    this.speed = Math.abs(this.ball.dy) * 1.1;
    this.isPaused = false;
  }
}
