import { HIT_LANDMARK_INDICES, Point2D, PoseLandmark } from './types';

export function landmarkToCanvas(
  landmark: PoseLandmark,
  width: number,
  height: number,
  mirror: boolean,
): Point2D {
  const xNorm = mirror ? 1 - landmark.x : landmark.x;
  return {
    x: xNorm * width,
    y: landmark.y * height,
  };
}

/** Comprueba contacto círculo–punto con escala de hitbox para accesibilidad. */
export function checkBalloonHits(
  landmarks: PoseLandmark[],
  balloonCenter: Point2D,
  balloonRadius: number,
  canvasWidth: number,
  canvasHeight: number,
  hitboxScale: number,
  mirror: boolean,
): boolean {
  const effectiveRadius = balloonRadius * hitboxScale;

  for (const index of HIT_LANDMARK_INDICES) {
    const lm = landmarks[index];
    if (!lm || lm.visibility < 0.35) {
      continue;
    }
    const p = landmarkToCanvas(lm, canvasWidth, canvasHeight, mirror);
    const dx = p.x - balloonCenter.x;
    const dy = p.y - balloonCenter.y;
    if (dx * dx + dy * dy <= effectiveRadius * effectiveRadius) {
      return true;
    }
  }
  return false;
}
