import { Component, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController, ViewDidEnter, ViewWillLeave } from '@ionic/angular';
import { AuthService } from '../../../core/auth/auth.service';
import { UiChromeService } from '../../../core/ui-chrome.service';
import { ShadowExergameComponent } from '../../components/shadow-exergame/shadow-exergame.component';
import {
  DEFAULT_EXERGAME_SETTINGS,
  ExergameSettings,
  GameHudState,
  SESSION_DURATION_OPTIONS,
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

  readonly durationOptions = SESSION_DURATION_OPTIONS;

  settings: ExergameSettings = { ...DEFAULT_EXERGAME_SETTINGS };
  hud: GameHudState = {
    score: 0,
    poppedCount: 0,
    timeLeftSeconds: DEFAULT_EXERGAME_SETTINGS.sessionSeconds,
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
    private readonly uiChrome: UiChromeService,
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {
    this.topAttempts = this.scoreHistory.getTopAttempts();
  }

  ionViewDidEnter(): void {
    this.exergame?.onPageEnter();
    this.topAttempts = this.scoreHistory.getTopAttempts();
    this.uiChrome.setHideWhatsApp(this.hud.isRunning);
  }

  ionViewWillLeave(): void {
    this.exergame?.onPageLeave();
    this.cameraReady = false;
    this.poseDetected = false;
    this.statusMessage = '';
    this.uiChrome.setHideWhatsApp(false);
  }

  onHudChange(state: GameHudState): void {
    if (state.isRunning) {
      this.sessionWasRunning = true;
      this.finishRecorded = false;
    }

    if (state.isFinished && this.sessionWasRunning && !this.finishRecorded) {
      this.finishRecorded = true;
      this.sessionWasRunning = false;
      this.topAttempts = this.scoreHistory.recordAttempt(state.score, state.poppedCount);
    }

    this.hud = state;
    this.uiChrome.setHideWhatsApp(state.isRunning);
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

  logout(): void {
    this.settingsOpen = false;
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }

  rankLabel(index: number): string {
    return `${index + 1}º`;
  }
}
