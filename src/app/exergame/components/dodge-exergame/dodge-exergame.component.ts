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
import { DodgeEngine, DodgeHudState } from '../../game/dodge-engine';
import { PoseLandmark } from '../../game/types';
import { landmarkToCanvas } from '../../game/hitbox';
import { CameraPermissionService } from '../../services/camera-permission.service';
import { PoseTrackingService } from '../../services/pose-tracking.service';

@Component({
  selector: 'app-dodge-exergame',
  templateUrl: './dodge-exergame.component.html',
  styleUrls: ['./dodge-exergame.component.scss'],
  standalone: false,
})
export class DodgeExergameComponent implements OnDestroy {
  @ViewChild('gameCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('poseVideo', { static: true }) videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('stage', { static: true }) stageRef!: ElementRef<HTMLDivElement>;

  @Input() sessionSeconds = 60;
  @Input() mirror = true;

  @Output() hudChange = new EventEmitter<DodgeHudState>();
  @Output() cameraError = new EventEmitter<string>();
  @Output() ready = new EventEmitter<void>();
  @Output() statusChange = new EventEmitter<string>();
  @Output() poseDetected = new EventEmitter<boolean>();

  private engine = new DodgeEngine();
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
      this.statusChange.emit('Cargando modelo de cuerpo…');

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
      this.statusChange.emit('¡Listo! Colócate frente a la cámara.');
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
    this.engine.startSession(Number(this.sessionSeconds) || 60);
    this.emitHud();
  }

  resetSession(): void {
    this.engine.reset();
    this.emitHud();
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
    this.engine = new DodgeEngine();
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

    if (!this.initialized) {
      this.emitHud();
      return;
    }

    this.engine.tick(timestamp, w, h, this.landmarks, this.mirror);
    this.engine.renderOverlay(ctx, w, h);

    if (this.landmarks) {
      this.drawBodyMarker(ctx, w, h);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = `600 ${Math.max(16, w * 0.028)}px Figtree,sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Buscando tu cuerpo… aléjate 1–2 m', w / 2, h * 0.12);
    }

    this.emitHud();
  };

  private drawBodyMarker(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this.landmarks) {
      return;
    }
    const leftHip = this.landmarks[23];
    const rightHip = this.landmarks[24];
    if (!leftHip || !rightHip) {
      return;
    }
    const a = landmarkToCanvas(leftHip, w, h, this.mirror);
    const b = landmarkToCanvas(rightHip, w, h, this.mirror);
    const x = (a.x + b.x) / 2;
    const y = (a.y + b.y) / 2;
    const hud = this.engine.getHudState();

    ctx.beginPath();
    ctx.arc(x, y, Math.max(14, w * 0.018), 0, Math.PI * 2);
    ctx.fillStyle = hud.inDangerZone
      ? 'rgba(248, 113, 113, 0.95)'
      : 'rgba(52, 211, 153, 0.95)';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

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
