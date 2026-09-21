import { PoseLandmark } from './types';

const LANDMARK_COUNT = 33;

/**
 * Suavizado exponencial (EMA) sobre landmarks crudos de MediaPipe Pose.
 * alpha ≈ 0.35 equilibra respuesta y estabilidad para adultos mayores.
 */
export class PoseSmoother {
  private readonly alpha: number;
  private smoothed: PoseLandmark[] | null = null;

  constructor(alpha = 0.35) {
    this.alpha = alpha;
  }

  reset(): void {
    this.smoothed = null;
  }

  update(raw: PoseLandmark[]): PoseLandmark[] {
    if (raw.length < LANDMARK_COUNT) {
      return this.smoothed ?? raw;
    }

    if (!this.smoothed) {
      this.smoothed = raw.slice(0, LANDMARK_COUNT).map((l) => ({ ...l }));
      return this.smoothed;
    }

    for (let i = 0; i < LANDMARK_COUNT; i++) {
      const r = raw[i];
      const s = this.smoothed[i];
      s.x = this.alpha * r.x + (1 - this.alpha) * s.x;
      s.y = this.alpha * r.y + (1 - this.alpha) * s.y;
      s.z = this.alpha * r.z + (1 - this.alpha) * s.z;
      s.visibility = this.alpha * r.visibility + (1 - this.alpha) * s.visibility;
    }

    return this.smoothed;
  }
}
