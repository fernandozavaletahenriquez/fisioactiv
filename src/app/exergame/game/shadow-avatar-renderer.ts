import { DisplayMode, POSE_CONNECTIONS, PoseLandmark } from './types';
import { landmarkToCanvas } from './hitbox';

const SHADOW_COLOR = '#090d16';
const LIMB_SEGMENTS: ReadonlyArray<[number, number]> = [
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [11, 12],
  [23, 24],
  [11, 23],
  [12, 24],
];

const MIN_VISIBILITY = 0.3;
const LIMB_WIDTH = 48;
const HEAD_RADIUS_FACTOR = 0.1;

export class ShadowAvatarRenderer {
  draw(
    ctx: CanvasRenderingContext2D,
    landmarks: PoseLandmark[],
    width: number,
    height: number,
    mode: DisplayMode,
    mirror: boolean,
  ): void {
    if (mode === 'skeleton') {
      this.drawSkeleton(ctx, landmarks, width, height, mirror);
      return;
    }

    // Modo video: solo la persona (el tracking sigue activo, sin marcadores).
    if (mode === 'video') {
      return;
    }

    // Modo sombra pura.
    ctx.fillStyle = '#c5d4e8';
    ctx.fillRect(0, 0, width, height);
    this.drawShadowBody(ctx, landmarks, width, height, mirror);
  }

  drawVideoBackground(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    width: number,
    height: number,
    mirror: boolean,
  ): void {
    ctx.save();
    if (mirror) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    // Estirado al canvas para que los landmarks (0–1) coincidan 1:1.
    ctx.drawImage(video, 0, 0, width, height);
    ctx.restore();
  }

  drawIdleBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#f8fcfb');
    grad.addColorStop(0.45, '#e3f4f0');
    grad.addColorStop(1, '#9fd4cb');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  private drawShadowBody(
    ctx: CanvasRenderingContext2D,
    landmarks: PoseLandmark[],
    width: number,
    height: number,
    mirror: boolean,
  ): void {
    ctx.save();
    ctx.strokeStyle = SHADOW_COLOR;
    ctx.fillStyle = SHADOW_COLOR;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(28, Math.min(width, height) * 0.055);

    for (const [a, b] of LIMB_SEGMENTS) {
      this.drawSegment(ctx, landmarks, a, b, width, height, mirror);
    }

    this.fillTorso(ctx, landmarks, width, height, mirror);
    this.drawHead(ctx, landmarks, width, height, mirror);
    ctx.restore();
  }

  private drawSegment(
    ctx: CanvasRenderingContext2D,
    landmarks: PoseLandmark[],
    i: number,
    j: number,
    width: number,
    height: number,
    mirror: boolean,
  ): void {
    const la = landmarks[i];
    const lb = landmarks[j];
    if (!la || !lb || la.visibility < MIN_VISIBILITY || lb.visibility < MIN_VISIBILITY) {
      return;
    }
    const pa = landmarkToCanvas(la, width, height, mirror);
    const pb = landmarkToCanvas(lb, width, height, mirror);
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }

  private fillTorso(
    ctx: CanvasRenderingContext2D,
    landmarks: PoseLandmark[],
    width: number,
    height: number,
    mirror: boolean,
  ): void {
    const ls = landmarks[11];
    const rs = landmarks[12];
    const lh = landmarks[23];
    const rh = landmarks[24];
    if (!ls || !rs || !lh || !rh) {
      return;
    }
    if ([ls, rs, lh, rh].some((l) => l.visibility < MIN_VISIBILITY)) {
      return;
    }
    const p11 = landmarkToCanvas(ls, width, height, mirror);
    const p12 = landmarkToCanvas(rs, width, height, mirror);
    const p23 = landmarkToCanvas(lh, width, height, mirror);
    const p24 = landmarkToCanvas(rh, width, height, mirror);

    ctx.beginPath();
    ctx.moveTo(p11.x, p11.y);
    ctx.lineTo(p12.x, p12.y);
    ctx.lineTo(p24.x, p24.y);
    ctx.lineTo(p23.x, p23.y);
    ctx.closePath();
    ctx.fill();
  }

  private drawHead(
    ctx: CanvasRenderingContext2D,
    landmarks: PoseLandmark[],
    width: number,
    height: number,
    mirror: boolean,
  ): void {
    const nose = landmarks[0];
    if (!nose || nose.visibility < MIN_VISIBILITY) {
      return;
    }
    const center = landmarkToCanvas(nose, width, height, mirror);
    const radius = Math.min(width, height) * HEAD_RADIUS_FACTOR;
    ctx.beginPath();
    ctx.arc(center.x, center.y - radius * 0.15, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawSkeleton(
    ctx: CanvasRenderingContext2D,
    landmarks: PoseLandmark[],
    width: number,
    height: number,
    mirror: boolean,
  ): void {
    ctx.fillStyle = '#1a2332';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#5eead4';
    ctx.lineWidth = 3;
    for (const [a, b] of POSE_CONNECTIONS) {
      this.drawSegment(ctx, landmarks, a, b, width, height, mirror);
    }
  }
}
