import { Point2D } from './types';

const BALLOON_COLORS = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#a29bfe', '#fd79a8', '#74b9ff'];

/** Globo que cae desde arriba con oscilación horizontal. */
export class Balloon {
  readonly id: number;
  readonly color: string;
  readonly radius: number;
  readonly x0: number;
  readonly wobbleAmplitude: number;
  readonly wobbleSpeed: number;
  readonly fallSpeed: number;
  private phase: number;
  y: number;
  alive = true;

  constructor(id: number, canvasWidth: number, canvasHeight: number) {
    this.id = id;
    this.color = BALLOON_COLORS[id % BALLOON_COLORS.length];
    this.radius = Math.max(36, Math.min(canvasWidth, canvasHeight) * 0.055);
    this.x0 = this.radius + Math.random() * Math.max(1, canvasWidth - this.radius * 2);
    // Aparece arriba de la pantalla y cae hacia abajo.
    this.y = -this.radius - Math.random() * 60;
    this.wobbleAmplitude = 20 + Math.random() * 36;
    this.wobbleSpeed = 1.1 + Math.random() * 1.4;
    this.fallSpeed = 70 + Math.random() * 45;
    this.phase = Math.random() * Math.PI * 2;
  }

  getCenter(now: number): Point2D {
    const phase = this.phase + now * this.wobbleSpeed * 0.001;
    return {
      x: this.x0 + Math.sin(phase) * this.wobbleAmplitude,
      y: this.y,
    };
  }

  update(deltaMs: number, speedMultiplier: number): void {
    if (!this.alive) {
      return;
    }
    this.y += (this.fallSpeed * speedMultiplier * deltaMs) / 1000;
  }

  isOffScreen(canvasHeight: number): boolean {
    return this.y - this.radius > canvasHeight + 40;
  }

  draw(ctx: CanvasRenderingContext2D, now: number): void {
    if (!this.alive) {
      return;
    }
    const { x, y } = this.getCenter(now);

    ctx.save();
    // Cuerda hacia arriba (como globo que cae / flota)
    ctx.strokeStyle = 'rgba(40,40,40,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + this.radius * 0.85);
    ctx.lineTo(x, y + this.radius + 34);
    ctx.stroke();

    const grad = ctx.createRadialGradient(x - 8, y - 10, 4, x, y, this.radius);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.35, this.color);
    grad.addColorStop(1, this.shade(this.color, -30));

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y, this.radius * 0.92, this.radius, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.ellipse(
      x - this.radius * 0.25,
      y - this.radius * 0.35,
      this.radius * 0.18,
      this.radius * 0.12,
      -0.4,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    ctx.restore();
  }

  private shade(hex: string, amount: number): string {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.max(0, ((n >> 16) & 0xff) + amount));
    const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amount));
    const b = Math.min(255, Math.max(0, (n & 0xff) + amount));
    return `rgb(${r},${g},${b})`;
  }
}
