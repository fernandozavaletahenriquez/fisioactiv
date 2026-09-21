import { Component, ViewChild } from '@angular/core';
import { ToastController, ViewDidEnter, ViewWillLeave } from '@ionic/angular';
import { ShadowExergameComponent } from '../../components/shadow-exergame/shadow-exergame.component';
import {
  DEFAULT_EXERGAME_SETTINGS,
  ExergameSettings,
  GameHudState,
} from '../../game/types';
import {
  ScoreAttempt,
  ScoreHistoryService,
} from '../../services/score-history.service';

@Component({
  selector: 'app-game',
  templateUrl: './game.page.html',
  styleUrls: ['./game.page.scss'],
  standalone: false,
})
export class GamePage implements ViewDidEnter, ViewWillLeave {
  @ViewChild('exergame') exergame?: ShadowExergameComponent;

  settings: ExergameSettings = { ...DEFAULT_EXERGAME_SETTINGS };
  hud: GameHudState = {
    score: 0,
    poppedCount: 0,
    timeLeftSeconds: 60,
    isRunning: false,
    isFinished: false,
  };

  topAttempts: ScoreAttempt[] = [];
  settingsOpen = false;
  cameraErrorMessage = '';
  statusMessage = '';
  cameraReady = false;
  cameraLoading = false;
  poseDetected = false;

  private sessionWasRunning = false;
  private finishRecorded = false;

  constructor(
    private readonly toastCtrl: ToastController,
    private readonly scoreHistory: ScoreHistoryService,
  ) {
    this.topAttempts = this.scoreHistory.getTopAttempts();
  }

  ionViewDidEnter(): void {
    this.exergame?.onPageEnter();
    this.topAttempts = this.scoreHistory.getTopAttempts();
  }

  ionViewWillLeave(): void {
    this.exergame?.onPageLeave();
    this.cameraReady = false;
    this.poseDetected = false;
    this.statusMessage = '';
  }

  onHudChange(state: GameHudState): void {
    if (state.isRunning) {
      this.sessionWasRunning = true;
      this.finishRecorded = false;
    }

    // Al terminar la sesión, guardar intento una sola vez.
    if (state.isFinished && this.sessionWasRunning && !this.finishRecorded) {
      this.finishRecorded = true;
      this.sessionWasRunning = false;
      this.topAttempts = this.scoreHistory.recordAttempt(state.score, state.poppedCount);
    }

    this.hud = state;
  }

  onCameraError(message: string): void {
    this.cameraErrorMessage = message;
    this.cameraReady = false;
    this.cameraLoading = false;
  }

  onExergameReady(): void {
    this.cameraErrorMessage = '';
    this.cameraReady = true;
    this.cameraLoading = false;
  }

  onStatusChange(message: string): void {
    this.statusMessage = message;
  }

  onPoseDetected(detected: boolean): void {
    this.poseDetected = detected;
  }

  async enableCamera(): Promise<void> {
    this.cameraErrorMessage = '';
    this.cameraLoading = true;
    const ok = await this.exergame?.enableCamera();
    this.cameraReady = !!ok;
    this.cameraLoading = false;
  }

  async play(): Promise<void> {
    if (!this.cameraReady) {
      await this.enableCamera();
      if (!this.cameraReady) {
        return;
      }
    }
    this.finishRecorded = false;
    this.sessionWasRunning = false;
    this.exergame?.startSession();
  }

  async restartSession(): Promise<void> {
    if (!this.cameraReady) {
      await this.enableCamera();
      if (!this.cameraReady) {
        return;
      }
    }
    this.finishRecorded = false;
    this.sessionWasRunning = false;
    this.exergame?.resetSession();
    this.exergame?.startSession();
  }

  toggleSettings(): void {
    this.settingsOpen = !this.settingsOpen;
  }

  rankLabel(index: number): string {
    return `${index + 1}º`;
  }
}
