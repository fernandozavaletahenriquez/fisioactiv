import { Component, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ViewDidEnter, ViewWillLeave } from '@ionic/angular';
import { AuthService } from '../../../core/auth/auth.service';
import { UiChromeService } from '../../../core/ui-chrome.service';
import { DodgeExergameComponent } from '../../components/dodge-exergame/dodge-exergame.component';
import { DodgeHudState } from '../../game/dodge-engine';
import { SESSION_DURATION_OPTIONS } from '../../game/types';
import {
  ScoreAttempt,
  ScoreHistoryService,
} from '../../services/score-history.service';

@Component({
  selector: 'app-dodge',
  templateUrl: './dodge.page.html',
  styleUrls: ['./dodge.page.scss'],
  standalone: false,
})
export class DodgePage implements ViewDidEnter, ViewWillLeave {
  @ViewChild('exergame') exergame?: DodgeExergameComponent;

  readonly durationOptions = SESSION_DURATION_OPTIONS;
  sessionSeconds = 60;

  hud: DodgeHudState = {
    score: 0,
    timeLeftSeconds: 60,
    isRunning: false,
    isFinished: false,
    inDangerZone: false,
    zoneCountdown: 3,
    combo: 0,
    level: 1,
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
    private readonly scoreHistory: ScoreHistoryService,
    private readonly uiChrome: UiChromeService,
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {
    this.topAttempts = this.scoreHistory.getTopAttempts('dodge');
  }

  ionViewDidEnter(): void {
    this.exergame?.onPageEnter();
    this.topAttempts = this.scoreHistory.getTopAttempts('dodge');
    this.uiChrome.setHideWhatsApp(this.hud.isRunning);
  }

  ionViewWillLeave(): void {
    this.exergame?.onPageLeave();
    this.cameraReady = false;
    this.poseDetected = false;
    this.statusMessage = '';
    this.uiChrome.setHideWhatsApp(false);
  }

  onHudChange(state: DodgeHudState): void {
    if (state.isRunning) {
      this.sessionWasRunning = true;
      this.finishRecorded = false;
    }

    if (state.isFinished && this.sessionWasRunning && !this.finishRecorded) {
      this.finishRecorded = true;
      this.sessionWasRunning = false;
      this.topAttempts = this.scoreHistory.recordAttempt(state.score, 0, 'dodge');
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
    this.exergame!.sessionSeconds = Number(this.sessionSeconds) || 60;
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
    this.exergame!.sessionSeconds = Number(this.sessionSeconds) || 60;
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

  formatTime(totalSeconds: number): string {
    const s = Math.max(0, Math.floor(totalSeconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
  }

  rankLabel(index: number): string {
    return `${index + 1}º`;
  }
}
