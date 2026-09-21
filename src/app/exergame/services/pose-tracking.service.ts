import { Injectable } from '@angular/core';
import { PoseLandmark } from '../game/types';
import { PoseSmoother } from '../game/pose-smoother';

const POSE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/';

export type PoseFrameCallback = (landmarks: PoseLandmark[] | null) => void;

interface MediaPipePose {
  setOptions(options: Record<string, unknown>): void;
  onResults(cb: (results: {
    poseLandmarks?: Array<{ x: number; y: number; z: number; visibility?: number }>;
  }) => void): void;
  send(inputs: { image: HTMLVideoElement }): Promise<void>;
  initialize(): Promise<void>;
  close(): Promise<void>;
}

declare global {
  interface Window {
    Pose?: new (config: { locateFile: (file: string) => string }) => MediaPipePose;
  }
}

/**
 * Seguimiento corporal sin @mediapipe/camera_utils.
 * Usa el stream que ya abrimos con getUserMedia y un loop propio.
 */
@Injectable({ providedIn: 'root' })
export class PoseTrackingService {
  private pose: MediaPipePose | null = null;
  private smoother = new PoseSmoother(0.35);
  private onFrame: PoseFrameCallback | null = null;
  private video: HTMLVideoElement | null = null;
  private rafId = 0;
  private busy = false;
  private running = false;

  async start(videoElement: HTMLVideoElement, onFrame: PoseFrameCallback): Promise<void> {
    await this.stop();
    this.onFrame = onFrame;
    this.video = videoElement;
    this.smoother.reset();

    await this.loadPoseScript();
    if (!window.Pose) {
      throw new Error('No se pudo cargar MediaPipe Pose. Revisa tu conexión a internet.');
    }

    this.pose = new window.Pose({
      locateFile: (file) => `${POSE_CDN}${file}`,
    });

    this.pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    this.pose.onResults((results) => {
      if (!this.onFrame) {
        return;
      }
      if (!results.poseLandmarks) {
        this.onFrame(null);
        return;
      }
      const raw: PoseLandmark[] = results.poseLandmarks.map((l) => ({
        x: l.x,
        y: l.y,
        z: l.z,
        visibility: l.visibility ?? 1,
      }));
      this.onFrame(this.smoother.update(raw));
    });

    await this.pose.initialize();
    this.running = true;
    this.scheduleFrame();
  }

  async stop(): Promise<void> {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.onFrame = null;
    this.video = null;
    this.busy = false;

    if (this.pose) {
      try {
        await this.pose.close();
      } catch {
        /* ignore */
      }
      this.pose = null;
    }
    this.smoother.reset();
  }

  private scheduleFrame = (): void => {
    if (!this.running) {
      return;
    }
    this.rafId = requestAnimationFrame(this.scheduleFrame);
    void this.processFrame();
  };

  private async processFrame(): Promise<void> {
    if (this.busy || !this.pose || !this.video) {
      return;
    }
    if (this.video.readyState < 2) {
      return;
    }
    this.busy = true;
    try {
      await this.pose.send({ image: this.video });
    } catch {
      /* frame perdido: continuar */
    } finally {
      this.busy = false;
    }
  }

  private loadPoseScript(): Promise<void> {
    const src = `${POSE_CDN}pose.js`;
    return new Promise((resolve, reject) => {
      if (window.Pose) {
        resolve();
        return;
      }
      const existing = document.querySelector<HTMLScriptElement>(`script[data-mp-pose="1"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('Error cargando MediaPipe')), {
          once: true,
        });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.dataset['mpPose'] = '1';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Error cargando MediaPipe Pose (CDN).'));
      document.head.appendChild(script);
    });
  }
}
