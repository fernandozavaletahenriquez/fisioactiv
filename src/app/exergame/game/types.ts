/** Punto 2D en espacio de canvas (píxeles). */
export interface Point2D {
  x: number;
  y: number;
}

/** Landmark MediaPipe Pose suavizado. */
export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export type DisplayMode = 'shadow' | 'video' | 'skeleton';

/** Ajustes de terapia / accesibilidad expuestos en el HUD. */
export interface ExergameSettings {
  displayMode: DisplayMode;
  hitboxScale: number;
  balloonSpeed: number;
}

export const DEFAULT_EXERGAME_SETTINGS: ExergameSettings = {
  displayMode: 'video',
  hitboxScale: 2.0,
  balloonSpeed: 0.85,
};

/** Estado del HUD de la sesión (60 s). */
export interface GameHudState {
  score: number;
  poppedCount: number;
  timeLeftSeconds: number;
  isRunning: boolean;
  isFinished: boolean;
}

/** Muñecas, índices, codos, nariz y tobillos — más fácil de alcanzar. */
export const HIT_LANDMARK_INDICES = [0, 13, 14, 15, 16, 19, 20, 27, 28] as const;

/** Conexiones del esqueleto (modo skeleton). */
export const POSE_CONNECTIONS: ReadonlyArray<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 7],
  [0, 4],
  [4, 5],
  [5, 6],
  [6, 8],
  [9, 10],
  [11, 12],
  [11, 13],
  [13, 15],
  [15, 17],
  [15, 19],
  [15, 21],
  [17, 19],
  [12, 14],
  [14, 16],
  [16, 18],
  [16, 20],
  [16, 22],
  [18, 20],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [27, 29],
  [28, 30],
  [27, 31],
  [28, 32],
];
