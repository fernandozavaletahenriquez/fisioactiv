import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { CameraPermissionState } from '@capacitor/camera';

@Injectable({ providedIn: 'root' })
export class CameraPermissionService {
  /**
   * En nativo pide permiso Capacitor; en web abre getUserMedia
   * (dispara el aviso del navegador) y lo adjunta al video.
   */
  async ensureCamera(videoElement: HTMLVideoElement): Promise<MediaStream> {
    await this.ensureNativePermissions();

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        'Este navegador no permite cámara. Usa Chrome/Edge y abre la app por http://localhost.',
      );
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      videoElement.srcObject = stream;
      videoElement.muted = true;
      videoElement.setAttribute('playsinline', 'true');
      await videoElement.play();
      return stream;
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        throw new Error(
          'Cámara bloqueada. En la barra de dirección (🔒) → Permisos del sitio → Cámara → Permitir, y recarga.',
        );
      }
      if (name === 'NotFoundError') {
        throw new Error('No se encontró ninguna cámara conectada.');
      }
      throw new Error(
        err instanceof Error ? err.message : 'No se pudo abrir la cámara.',
      );
    }
  }

  stopStream(stream: MediaStream | null): void {
    stream?.getTracks().forEach((t) => t.stop());
  }

  private async ensureNativePermissions(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const status = await Camera.checkPermissions();
    if (status.camera === 'granted') {
      return;
    }

    const requested = await Camera.requestPermissions({ permissions: ['camera'] });
    if (requested.camera !== 'granted' && requested.camera !== 'limited') {
      throw new Error('Permiso de cámara denegado. Actívalo en ajustes del dispositivo.');
    }
  }

  mapPermissionState(state: CameraPermissionState | undefined): string {
    switch (state) {
      case 'granted':
      case 'limited':
        return 'Concedido';
      case 'denied':
        return 'Denegado';
      default:
        return 'Pendiente';
    }
  }
}
