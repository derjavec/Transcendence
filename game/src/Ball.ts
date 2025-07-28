// Ball.ts
export class Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  fieldHeight: number;
  minVy: number;
  maxVy: number;
  minVx: number;
  maxVx: number;

  constructor(
    x: number,
    y: number,
    vx: number,
    vy: number,
    radius: number,
    fieldHeight: number 
  ) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = radius;
    this.fieldHeight = fieldHeight;
    this.minVy = 0.8 * Math.abs(vy);
    this.maxVy = Math.abs(vy);
    this.minVx = 0.8 * Math.abs(vx);
    this.maxVx = Math.abs(vx);
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    if (this.y <= 0 || this.y >= this.fieldHeight) this.vy *= -1;
  }

  reverseX() {
    this.vx *= -1;
  }

  reset(x: number, y: number, vx: number, vy: number, radius: number, fieldHeight: number) {
    this.x = x;
    this.y = y;
    this.vx = Math.random() < 0.5 ? -vx : vx;
    this.vy = vy;
    this.radius = radius;
    this.fieldHeight = fieldHeight;
    this.minVy = 0.8 * Math.abs(vy);
    this.maxVy = Math.abs(vy);
    this.minVx = 0.8 * Math.abs(vx);
    this.maxVx = Math.abs(vx);
  }

  setSpeed(newVx: number, newVy: number) {
    newVy = Math.max(this.minVy, Math.min(this.maxVy, Math.abs(newVy)));
    newVx = Math.max(this.minVx, Math.min(this.maxVx, Math.abs(newVx)));
    this.vy = this.vy < 0 ? -newVy : newVy;
    this.vx = this.vx < 0 ? -newVx : newVx;
  }
}