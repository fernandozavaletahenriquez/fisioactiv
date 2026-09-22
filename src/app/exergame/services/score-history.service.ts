import { Injectable } from '@angular/core';

export interface ScoreAttempt {
  score: number;
  poppedCount: number;
  /** Epoch ms */
  at: number;
}

const STORAGE_PREFIX = 'fisioactiv.scoreHistory.v1';
const MAX_ATTEMPTS = 3;

/**
 * Conserva los últimos intentos y expone siempre el Top 3 por puntuación.
 */
@Injectable({ providedIn: 'root' })
export class ScoreHistoryService {
  private lastRecordedKey: string | null = null;

  getTopAttempts(gameId = 'balloons'): ScoreAttempt[] {
    return this.read(gameId)
      .slice()
      .sort((a, b) => b.score - a.score || b.at - a.at)
      .slice(0, MAX_ATTEMPTS);
  }

  recordAttempt(score: number, poppedCount: number, gameId = 'balloons'): ScoreAttempt[] {
    const attempt: ScoreAttempt = {
      score,
      poppedCount,
      at: Date.now(),
    };

    const key = `${gameId}:${attempt.at}:${attempt.score}`;
    if (this.lastRecordedKey === key) {
      return this.getTopAttempts(gameId);
    }
    this.lastRecordedKey = key;

    const next = [...this.read(gameId), attempt]
      .sort((a, b) => b.score - a.score || b.at - a.at)
      .slice(0, MAX_ATTEMPTS);

    this.write(gameId, next);
    return next;
  }

  clear(gameId = 'balloons'): void {
    try {
      localStorage.removeItem(this.storageKey(gameId));
    } catch {
      /* ignore */
    }
    this.lastRecordedKey = null;
  }

  private storageKey(gameId: string): string {
    return gameId === 'balloons' ? STORAGE_PREFIX : `${STORAGE_PREFIX}.${gameId}`;
  }

  private read(gameId: string): ScoreAttempt[] {
    try {
      const raw = localStorage.getItem(this.storageKey(gameId));
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as ScoreAttempt[];
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter(
        (a) =>
          a &&
          typeof a.score === 'number' &&
          typeof a.poppedCount === 'number' &&
          typeof a.at === 'number',
      );
    } catch {
      return [];
    }
  }

  private write(gameId: string, attempts: ScoreAttempt[]): void {
    try {
      localStorage.setItem(this.storageKey(gameId), JSON.stringify(attempts));
    } catch {
      /* ignore quota / private mode */
    }
  }
}
