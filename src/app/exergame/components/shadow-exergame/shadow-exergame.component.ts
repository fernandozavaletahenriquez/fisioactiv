import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { Capacitor } from '@capacitor/core';
import { ExergameEngine } from '../../game/game-engine';
import { ShadowAvatarRenderer } from '../../game/shadow-avatar-renderer';
import {
  DEFAULT_EXERGAME_SETTINGS,
  ExergameSettings,
  GameHudState,
  PoseLandmark,
} from '../../game/types';
import { CameraPermissionService } from '../../services/camera-permission.service';
import { PoseTrackingService } from '../../services/pose-tracking.service';

@Component({
  selector: 'app-shadow-exergame',
  templateUrl: './shadow-exergame.component.html',
  styleUrls: ['./shadow-exergame.component.scss'],
  standalone: false,
})
export class ShadowExergameComponent implements OnDestroy {
  @ViewChild('gameCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('poseVideo', { static: true }) videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('stage', { static: true }) stageRef!: ElementRef<HTMLDivElement>;

  @Input() settings: ExergameSettings = { ...DEFAULT_EXERGAME_SETTINGS };
  @Input() mirror = true;

  @Output() hudChange = new EventEmitter<GameHudState>();
  @Output() cameraError = new EventEmitter<string>();
  @Output() ready = new EventEmitter<void>();
  @Output() statusChange = new EventEmitter<string>();
  @Output() poseDetected = new EventEmitter<boolean>();

  private engine = new ExergameEngine();
  private avatarRenderer = new ShadowAvatarRenderer();
  private landmarks: PoseLandmark[] | null = null;
  private mediaStream: MediaStream | null = null;
  private rafId = 0;
  private resizeObserver: ResizeObserver | null = null;
  private initialized = false;
  private starting = false;
  private hasPose = false;

  constructor(
    private readonly poseTracking: PoseTrackingService,
    private readonly cameraPermission: CameraPermissionService,
  ) {}

  ngOnDestroy(): void {
    void this.teardown();
  }

  onPageLeave(): void {
    void this.teardown();
  }

  onPageEnter(): void {
    this.setupCanvasSize();
    this.watchResize();
    if (!this.rafId) {
      this.loop(performance.now());
    }
  }

  /** Activa cámara + pose. Debe llamarse desde un clic del usuario. */
  async enableCamera(): Promise<boolean> {
    if (this.initialized || this.starting) {
      return this.initialized;
    }
    this.starting = true;
    this.statusChange.emit('Pidiendo permiso de cámara…');

    try {
      this.setupCanvasSize();
      this.watchResize();
      if (!this.rafId) {
        this.loop(performance.now());
      }

      this.mediaStream = await this.cameraPermission.ensureCamera(this.videoRef.nativeElement);
      this.statusChange.emit('Cargando modelo de cuerpo (MediaPipe)…');

      await this.poseTracking.start(this.videoRef.nativeElement, (landmarks) => {
        this.landmarks = landmarks;
        const detected = !!landmarks;
        if (detected !== this.hasPose) {
          this.hasPose = detected;
          this.poseDetected.emit(detected);
        }
      });

      await this.enableKeepAwake();
      this.initialized = true;
      this.statusChange.emit('¡Listo! Colócate a 1–2 m frente a la cámara.');
      this.ready.emit();
      return true;
    } catch (err) {
      this.initialized = false;
      const message = err instanceof Error ? err.message : 'No se pudo iniciar la cámara.';
      this.cameraError.emit(message);
      this.statusChange.emit('');
      return false;
    } finally {
      this.starting = false;
    }
  }

  startSession(): void {
    this.engine.startSession();
    this.emitHud();
  }

  resetSession(): void {
    this.engine.reset();
    this.emitHud();
  }

  get isCameraReady(): boolean {
    return this.initialized;
  }

  private async teardown(): Promise<void> {
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    await this.poseTracking.stop();
    this.cameraPermission.stopStream(this.mediaStream);
    this.mediaStream = null;
    if (this.videoRef?.nativeElement) {
      this.videoRef.nativeElement.srcObject = null;
    }
    this.landmarks = null;
    this.hasPose = false;
    this.engine.dispose();
    this.engine = new ExergameEngine();
    await this.disableKeepAwake();
    this.initialized = false;
  }

  private watchResize(): void {
    if (this.resizeObserver) {
      return;
    }
    const container = this.stageRef?.nativeElement;
    if (!container) {
      return;
    }
    let scheduled = false;
    this.resizeObserver = new ResizeObserver(() => {
      if (scheduled) {
        return;
      }
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        this.setupCanvasSize();
      });
    });
    this.resizeObserver.observe(container);
  }

  private setupCanvasSize(): void {
    const canvas = this.canvasRef.nativeElement;
    const parent = this.stageRef?.nativeElement ?? canvas.parentElement;
    if (!parent) {
      return;
    }
    const rect = parent.getBoundingClientRect();
    const cssW = Math.max(320, Math.floor(rect.width));
    const cssH = Math.max(240, Math.floor(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const nextW = Math.floor(cssW * dpr);
    const nextH = Math.floor(cssH * dpr);
    if (canvas.width !== nextW || canvas.height !== nextH) {
      canvas.width = nextW;
      canvas.height = nextH;
    }
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
  }

  private loop = (timestamp: number): void => {
    this.rafId = requestAnimationFrame(this.loop);
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const w = canvas.width;
    const h = canvas.height;
    if (w < 2 || h < 2) {
      return;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const video = this.videoRef.nativeElement;
    const mode = this.settings.displayMode;

    if (!this.initialized) {
      this.avatarRenderer.drawIdleBackground(ctx, w, h);
      this.emitHud();
      return;
    }

    if (mode === 'video' && video.readyState >= 2) {
      this.avatarRenderer.drawVideoBackground(ctx, video, w, h, this.mirror);
    } else if (mode === 'skeleton') {
      ctx.fillStyle = '#1a2332';
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.fillStyle = '#c5d4e8';
      ctx.fillRect(0, 0, w, h);
    }

    if (this.landmarks) {
      this.avatarRenderer.draw(ctx, this.landmarks, w, h, mode, this.mirror);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = `600 ${Math.max(16, w * 0.03)}px system-ui,sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Buscando tu cuerpo… aléjate un poco de la cámara', w / 2, h * 0.12);
    }

    this.engine.tick(timestamp, w, h, this.landmarks, this.settings, this.mirror);
    this.engine.renderBalloonsAndParticles(ctx, timestamp);
    this.emitHud();
  };

  private emitHud(): void {
    this.hudChange.emit(this.engine.getHudState());
  }

  private async enableKeepAwake(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    try {
      await KeepAwake.keepAwake();
    } catch {
      /* ignore */
    }
  }

  private async disableKeepAwake(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    try {
      await KeepAwake.allowSleep();
    } catch {
      /* ignore */
    }
  }
}
