import { PoseLandmark } from './types';
import { landmarkToCanvas } from './hitbox';

export interface DodgeHudState {
  score: number;
  timeLeftSeconds: number;
  isRunning: boolean;
  isFinished: boolean;
  /** true = el cuerpo está dentro de la zona bloqueada */
  inDangerZone: boolean;
  /** Segundos restantes del ciclo de zona (0–3) */
  zoneCountdown: number;
  combo: number;
  /** Nivel visual 1…n (sube con el tiempo) */
  level: number;
}

/** Polígono en coords normalizadas 0–1 (pantalla completa). */
type NormPoly = Array<[number, number]>;

interface DangerZone {
  poly: NormPoly;
  color: { r: number; g: number; b: number };
  /** Centroide para el contador */
  labelX: number;
  labelY: number;
}

type PartitionKind =
  | 'corner-bl'
  | 'corner-br'
  | 'corner-tl'
  | 'corner-tr'
  | 'half-left'
  | 'half-right'
  | 'half-bottom'
  | 'half-top'
  | 'slash-left'
  | 'slash-right';

interface ZoneDesign {
  id: string;
  kind: PartitionKind;
  /** 0–3 → tamaño base del diseño */
  sizeTier: number;
  /** -1 | 0 | 1 → asimetría del corte */
  skew: number;
}

const DEFAULT_SECONDS = 60;
const ZONE_DURATION_BASE_MS = 3000;
const ZONE_DURATION_MIN_MS = 2400;
const SCORE_TICK_MS = 160;

const ZONE_COLORS: Array<{ r: number; g: number; b: number }> = [
  { r: 220, g: 38, b: 38 },
  { r: 234, g: 88, b: 12 },
  { r: 202, g: 138, b: 4 },
  { r: 190, g: 24, b: 93 },
  { r: 5, g: 150, b: 105 },
  { r: 8, g: 145, b: 178 },
  { r: 79, g: 70, b: 229 },
  { r: 124, g: 58, b: 237 },
];

const ALL_KINDS: PartitionKind[] = [
  'corner-bl',
  'corner-br',
  'corner-tl',
  'corner-tr',
  'half-left',
  'half-right',
  'half-bottom',
  'half-top',
  'slash-left',
  'slash-right',
];

/**
 * Pool de diseños (10 kinds × 4 tamaños × 3 sesgos = 120).
 * Se reparte con shuffle-bag: no se repite el mismo id seguido.
 */
const DESIGN_POOL: ZoneDesign[] = (() => {
  const pool: ZoneDesign[] = [];
  const skews = [-1, 0, 1] as const;
  for (const kind of ALL_KINDS) {
    for (let sizeTier = 0; sizeTier < 4; sizeTier++) {
      for (const skew of skews) {
        pool.push({
          id: `${kind}-s${sizeTier}-k${skew}`,
          kind,
          sizeTier,
          skew,
        });
      }
    }
  }
  return pool;
})();

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Zonas = particiones grandes de pantalla (esquinas / mitades diagonales),
 * no figuras pequeñas flotantes. La dificultad sube suavemente con el tiempo.
 */
export class DodgeEngine {
  private elapsedSessionMs = 0;
  private lastTimestamp = 0;
  private sessionSeconds = DEFAULT_SECONDS;
  private zoneElapsedMs = 0;
  private zoneDurationMs = ZONE_DURATION_BASE_MS;
  private scoreTickAccum = 0;
  private combo = 0;
  private zoneIndex = 0;
  private zone: DangerZone | null = null;
  private lastW = 0;
  private lastH = 0;
  private lastPointsPopup = 0;
  /** Bolsa barajada de diseños (shuffle-bag). */
  private designBag: ZoneDesign[] = [];
  private lastDesignId: string | null = null;
  private lastDesignKind: PartitionKind | null = null;
  private colorBag: number[] = [];
  private lastColorIndex = -1;
  private readonly hitProbe = document.createElement('canvas');
  private hud: DodgeHudState = this.emptyHud();

  constructor() {
    this.hitProbe.width = 1;
    this.hitProbe.height = 1;
  }

  getHudState(): DodgeHudState {
    return { ...this.hud };
  }

  /** Puntos recién ganados para feedback (+N), 0 si no hay. */
  consumePointsPopup(): number {
    const v = this.lastPointsPopup;
    this.lastPointsPopup = 0;
    return v;
  }

  startSession(sessionSeconds = DEFAULT_SECONDS): void {
    this.sessionSeconds = sessionSeconds > 0 ? sessionSeconds : DEFAULT_SECONDS;
    this.reset();
    this.hud.isRunning = true;
    this.hud.isFinished = false;
    this.lastTimestamp = 0;
    this.spawnZone();
  }

  reset(): void {
    this.elapsedSessionMs = 0;
    this.zoneElapsedMs = 0;
    this.zoneDurationMs = ZONE_DURATION_BASE_MS;
    this.scoreTickAccum = 0;
    this.combo = 0;
    this.zoneIndex = 0;
    this.lastTimestamp = 0;
    this.zone = null;
    this.lastPointsPopup = 0;
    this.designBag = [];
    this.lastDesignId = null;
    this.lastDesignKind = null;
    this.colorBag = [];
    this.lastColorIndex = -1;
    this.hud = this.emptyHud();
  }

  dispose(): void {
    this.reset();
  }

  tick(
    timestamp: number,
    canvasWidth: number,
    canvasHeight: number,
    landmarks: PoseLandmark[] | null,
    mirror: boolean,
  ): void {
    if (!this.hud.isRunning || this.hud.isFinished) {
      return;
    }

    this.lastW = canvasWidth;
    this.lastH = canvasHeight;

    if (!this.lastTimestamp) {
      this.lastTimestamp = timestamp;
    }
    const deltaMs = Math.min(48, timestamp - this.lastTimestamp);
    this.lastTimestamp = timestamp;

    this.elapsedSessionMs += deltaMs;
    const timeLeft = Math.max(0, this.sessionSeconds - Math.floor(this.elapsedSessionMs / 1000));
    this.hud.timeLeftSeconds = timeLeft;
    this.hud.level = 1 + Math.floor(this.zoneIndex / 3);

    if (timeLeft <= 0) {
      this.hud.isRunning = false;
      this.hud.isFinished = true;
      return;
    }

    if (!this.zone) {
      this.spawnZone();
    }

    this.zoneElapsedMs += deltaMs;
    if (this.zoneElapsedMs >= this.zoneDurationMs) {
      this.zoneElapsedMs = 0;
      this.zoneIndex += 1;
      this.spawnZone();
    }

    const remaining = Math.max(0, this.zoneDurationMs - this.zoneElapsedMs);
    this.hud.zoneCountdown = remaining / 1000;

    const body = this.bodyCenter(landmarks, canvasWidth, canvasHeight, mirror);
    if (!body || !this.zone) {
      this.hud.inDangerZone = false;
      this.combo = 0;
      this.hud.combo = 0;
      return;
    }

    const path = this.buildZonePath(this.zone, canvasWidth, canvasHeight);
    this.hud.inDangerZone = this.pointInPath(path, body.x, body.y);

    if (!this.hud.inDangerZone) {
      this.scoreTickAccum += deltaMs;
      while (this.scoreTickAccum >= SCORE_TICK_MS) {
        this.scoreTickAccum -= SCORE_TICK_MS;
        this.combo += 1;
        const bonus = Math.min(14, 5 + Math.floor(this.combo / 10));
        this.hud.score += bonus;
        this.lastPointsPopup = bonus;
      }
    } else {
      this.scoreTickAccum = 0;
      this.combo = 0;
    }
    this.hud.combo = this.combo;
  }

  renderOverlay(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (!this.zone || !this.hud.isRunning) {
      return;
    }

    ctx.save();
    const progress = Math.min(1, this.zoneElapsedMs / this.zoneDurationMs);
    const opacity = 0.62 - progress * 0.32;
    const lighten = progress * 0.4;
    const { r, g, b } = this.zone.color;
    const rr = Math.round(r + (255 - r) * lighten);
    const gg = Math.round(g + (255 - g) * lighten);
    const bb = Math.round(b + (255 - b) * lighten);

    const path = this.buildZonePath(this.zone, width, height);

    ctx.fillStyle = `rgba(${rr}, ${gg}, ${bb}, ${opacity})`;
    ctx.fill(path);

    // Borde brillante tipo referencia
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.55 + progress * 0.35})`;
    ctx.lineWidth = Math.max(4, Math.min(width, height) * 0.007);
    ctx.stroke(path);
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.9)`;
    ctx.lineWidth = Math.max(2, Math.min(width, height) * 0.004);
    ctx.stroke(path);

    // Marco neon suave de pantalla
    ctx.strokeStyle = `rgba(45, 212, 191, ${0.35 + progress * 0.2})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, width - 12, height - 12);

    const lx = this.zone.labelX * width;
    const ly = this.zone.labelY * height;
    const secs = this.hud.zoneCountdown;
    const label = secs >= 1 ? Math.ceil(secs).toString() : secs.toFixed(1);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fontSize = Math.max(48, Math.min(width, height) * 0.11);
    ctx.font = `800 ${fontSize}px Syne, sans-serif`;
    ctx.lineWidth = Math.max(5, fontSize * 0.09);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.strokeText(label, lx, ly);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.95 - progress * 0.12})`;
    ctx.fillText(label, lx, ly);

    ctx.restore();
  }

  private difficulty01(): number {
    // 0 → 1 a lo largo de la sesión (suave).
    const byTime = this.elapsedSessionMs / Math.max(1, this.sessionSeconds * 1000);
    const byZones = this.zoneIndex / 14;
    return Math.min(1, Math.max(byTime, byZones) * 0.95);
  }

  private spawnZone(): void {
    const d = this.difficulty01();
    this.zoneDurationMs = Math.round(
      ZONE_DURATION_BASE_MS - d * (ZONE_DURATION_BASE_MS - ZONE_DURATION_MIN_MS),
    );

    const design = this.nextDesign();
    // sizeTier 0..3 → cobertura base; la dificultad empuja un poco más.
    const coverage = 0.52 + design.sizeTier * 0.08 + d * 0.12;
    const poly = this.buildPartition(design.kind, coverage, design.skew);
    const color = ZONE_COLORS[this.nextColorIndex()];
    const centroid = this.polygonCentroid(poly);

    this.zone = {
      poly,
      color,
      labelX: centroid[0],
      labelY: centroid[1],
    };
  }

  /** Saca el siguiente diseño de la bolsa barajada; nunca el mismo id ni la misma figura seguida. */
  private nextDesign(): ZoneDesign {
    if (this.designBag.length === 0) {
      this.refillDesignBag();
    }

    let next = this.designBag.pop()!;

    // Evita repetir el mismo diseño o la misma familia (ej. corner-bl) seguidos.
    const isRepeat =
      next.id === this.lastDesignId ||
      (this.lastDesignKind != null && next.kind === this.lastDesignKind);

    if (isRepeat && this.designBag.length > 0) {
      const altIdx = this.designBag.findIndex(
        (d) => d.id !== this.lastDesignId && d.kind !== this.lastDesignKind,
      );
      if (altIdx >= 0) {
        const alt = this.designBag.splice(altIdx, 1)[0];
        this.designBag.push(next);
        next = alt;
      } else {
        const alt = this.designBag.pop()!;
        this.designBag.push(next);
        next = alt;
      }
    }

    this.lastDesignId = next.id;
    this.lastDesignKind = next.kind;
    return next;
  }

  private refillDesignBag(): void {
    this.designBag = shuffleInPlace([...DESIGN_POOL]);
    // Evita que el primero de la nueva bolsa sea igual al último jugado (id o kind).
    if (this.designBag.length > 1 && this.lastDesignKind) {
      const last = this.designBag.length - 1;
      if (
        this.designBag[last].id === this.lastDesignId ||
        this.designBag[last].kind === this.lastDesignKind
      ) {
        const i = this.designBag.findIndex(
          (d, idx) =>
            idx < last && d.kind !== this.lastDesignKind && d.id !== this.lastDesignId,
        );
        if (i >= 0) {
          const tmp = this.designBag[last];
          this.designBag[last] = this.designBag[i];
          this.designBag[i] = tmp;
        }
      }
    }
  }

  private nextColorIndex(): number {
    if (this.colorBag.length === 0) {
      this.colorBag = shuffleInPlace(ZONE_COLORS.map((_, i) => i));
      if (
        this.lastColorIndex >= 0 &&
        this.colorBag.length > 1 &&
        this.colorBag[this.colorBag.length - 1] === this.lastColorIndex
      ) {
        const i = Math.floor(Math.random() * (this.colorBag.length - 1));
        const last = this.colorBag.length - 1;
        const tmp = this.colorBag[last];
        this.colorBag[last] = this.colorBag[i];
        this.colorBag[i] = tmp;
      }
    }
    let idx = this.colorBag.pop()!;
    if (idx === this.lastColorIndex && this.colorBag.length > 0) {
      const alt = this.colorBag.pop()!;
      this.colorBag.push(idx);
      idx = alt;
    }
    this.lastColorIndex = idx;
    return idx;
  }

  /**
   * Particiones grandes ancladas a bordes.
   * `skew` deforma el corte para generar más diseños distintos.
   */
  private buildPartition(kind: PartitionKind, coverage: number, skew = 0): NormPoly {
    const c = Math.min(0.84, Math.max(0.5, coverage));
    const reach = Math.min(0.96, c * 1.32);
    const k = Math.max(-1, Math.min(1, skew)) * 0.12;

    switch (kind) {
      case 'corner-bl':
        return [
          [0, 1],
          [0, 1 - reach],
          [Math.min(0.98, reach + k), 1],
        ];
      case 'corner-br':
        return [
          [1, 1],
          [Math.max(0.02, 1 - reach - k), 1],
          [1, 1 - reach],
        ];
      case 'corner-tl':
        return [
          [0, 0],
          [Math.min(0.98, reach + k), 0],
          [0, reach],
        ];
      case 'corner-tr':
        return [
          [1, 0],
          [1, reach],
          [Math.max(0.02, 1 - reach - k), 0],
        ];
      case 'half-left':
        return [
          [0, 0],
          [Math.min(0.9, c + k), 0],
          [Math.max(0.2, c - 0.14 - k), 1],
          [0, 1],
        ];
      case 'half-right':
        return [
          [Math.max(0.1, 1 - c - k), 0],
          [1, 0],
          [1, 1],
          [Math.max(0.1, 1 - Math.max(0.2, c - 0.14) + k), 1],
        ];
      case 'half-bottom':
        return [
          [0, 1],
          [0, 1 - Math.min(0.85, c + k)],
          [1, 1 - Math.max(0.32, c - 0.1 - k)],
          [1, 1],
        ];
      case 'half-top':
        return [
          [0, 0],
          [1, 0],
          [1, Math.max(0.32, c - 0.1 + k)],
          [0, Math.min(0.85, c - k)],
        ];
      case 'slash-left':
        return [
          [0, 0],
          [Math.min(0.92, c + k), 0],
          [0, Math.min(1, c * 1.2 - k)],
        ];
      case 'slash-right':
        return [
          [1, 0],
          [1, Math.min(1, c * 1.2 + k)],
          [Math.max(0.08, 1 - c - k), 0],
        ];
      default:
        return [
          [0, 1],
          [0, 1 - reach],
          [reach, 1],
        ];
    }
  }

  private polygonCentroid(poly: NormPoly): [number, number] {
    let x = 0;
    let y = 0;
    for (const p of poly) {
      x += p[0];
      y += p[1];
    }
    const n = Math.max(1, poly.length);
    return [x / n, y / n];
  }

  private buildZonePath(zone: DangerZone, width: number, height: number): Path2D {
    const path = new Path2D();
    zone.poly.forEach((p, i) => {
      const x = p[0] * width;
      const y = p[1] * height;
      if (i === 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    });
    path.closePath();
    return path;
  }

  private pointInPath(path: Path2D, x: number, y: number): boolean {
    const ctx = this.hitProbe.getContext('2d');
    if (!ctx) {
      return false;
    }
    return ctx.isPointInPath(path, x, y);
  }

  private emptyHud(): DodgeHudState {
    return {
      score: 0,
      timeLeftSeconds: this.sessionSeconds || DEFAULT_SECONDS,
      isRunning: false,
      isFinished: false,
      inDangerZone: false,
      zoneCountdown: ZONE_DURATION_BASE_MS / 1000,
      combo: 0,
      level: 1,
    };
  }

  private bodyCenter(
    landmarks: PoseLandmark[] | null,
    width: number,
    height: number,
    mirror: boolean,
  ): { x: number; y: number } | null {
    if (!landmarks) {
      return null;
    }
    const pts: PoseLandmark[] = [];
    for (const lm of [landmarks[23], landmarks[24], landmarks[11], landmarks[12]]) {
      if (lm && lm.visibility >= 0.35) {
        pts.push(lm);
      }
    }
    if (pts.length < 2) {
      return null;
    }

    let x = 0;
    let y = 0;
    for (const lm of pts) {
      const p = landmarkToCanvas(lm, width, height, mirror);
      x += p.x;
      y += p.y;
    }
    return { x: x / pts.length, y: y / pts.length };
  }
}
