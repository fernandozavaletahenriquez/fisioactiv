import { Balloon } from './balloon';
import { checkBalloonHits } from './hitbox';
import { PopParticleSystem } from './pop-particles';
import { PopSynth } from './pop-synth';
import { ExergameSettings, GameHudState, PoseLandmark } from './types';

const SESSION_SECONDS = 60;
const SPAWN_INTERVAL_MS = 1200;

export class ExergameEngine {
  private balloons: Balloon[] = [];
  private readonly particles = new PopParticleSystem();
  private readonly popSynth = new PopSynth();
  private nextBalloonId = 0;
  private spawnAccumulator = 0;
  private elapsedSessionMs = 0;
  private lastTimestamp = 0;
  private hud: GameHudState = {
    score: 0,
    poppedCount: 0,
    timeLeftSeconds: SESSION_SECONDS,
    isRunning: false,
    isFinished: false,
  };

  getHudState(): GameHudState {
    return { ...this.hud };
  }

  startSession(): void {
    this.reset();
    this.hud.isRunning = true;
    this.hud.isFinished = false;
    this.lastTimestamp = 0;
    // Primer globo inmediato para que el jugador vea la mecánica al instante.
    this.spawnAccumulator = SPAWN_INTERVAL_MS;
  }

  reset(): void {
    this.balloons = [];
    this.particles.clear();
    this.spawnAccumulator = 0;
    this.elapsedSessionMs = 0;
    this.hud = {
      score: 0,
      poppedCount: 0,
      timeLeftSeconds: SESSION_SECONDS,
      isRunning: false,
      isFinished: false,
    };
  }

  dispose(): void {
    this.popSynth.dispose();
    this.reset();
  }

  tick(
    timestamp: number,
    canvasWidth: number,
    canvasHeight: number,
    landmarks: PoseLandmark[] | null,
    settings: ExergameSettings,
    mirror: boolean,
  ): void {
    if (!this.hud.isRunning || this.hud.isFinished) {
      return;
    }

    if (!this.lastTimestamp) {
      this.lastTimestamp = timestamp;
    }
    const deltaMs = Math.min(48, timestamp - this.lastTimestamp);
    this.lastTimestamp = timestamp;

    this.elapsedSessionMs += deltaMs;
    const timeLeft = Math.max(0, SESSION_SECONDS - Math.floor(this.elapsedSessionMs / 1000));
    this.hud.timeLeftSeconds = timeLeft;
    if (timeLeft <= 0) {
      this.hud.isRunning = false;
      this.hud.isFinished = true;
    }

    this.spawnAccumulator += deltaMs;
    while (this.spawnAccumulator >= SPAWN_INTERVAL_MS) {
      this.spawnAccumulator -= SPAWN_INTERVAL_MS;
      if (canvasWidth > 40 && canvasHeight > 40) {
        this.balloons.push(new Balloon(this.nextBalloonId++, canvasWidth, canvasHeight));
      }
    }

    const now = timestamp;
    for (const balloon of this.balloons) {
      balloon.update(deltaMs, settings.balloonSpeed);
    }

    this.balloons = this.balloons.filter((b) => b.alive && !b.isOffScreen(canvasHeight));

    if (landmarks) {
      for (const balloon of this.balloons) {
        if (!balloon.alive) {
          continue;
        }
        const center = balloon.getCenter(now);
        if (
          checkBalloonHits(
            landmarks,
            center,
            balloon.radius,
            canvasWidth,
            canvasHeight,
            settings.hitboxScale,
            mirror,
          )
        ) {
          balloon.alive = false;
          this.particles.spawn(center, balloon.color);
          this.popSynth.playPop();
          this.hud.poppedCount += 1;
          this.hud.score += 100;
        }
      }
    }

    this.particles.update(deltaMs);
  }

  renderBalloonsAndParticles(ctx: CanvasRenderingContext2D, timestamp: number): void {
    for (const balloon of this.balloons) {
      balloon.draw(ctx, timestamp);
    }
    this.particles.draw(ctx);
  }
}
