import { Injectable } from '@angular/core';

export interface ScoreAttempt {
  score: number;
  poppedCount: number;
  /** Epoch ms */
  at: number;
}

const STORAGE_KEY = 'fisioactiv.scoreHistory.v1';
const MAX_ATTEMPTS = 3;

/**
 * Conserva los últimos intentos y expone siempre el Top 3 por puntuación.
 */
@Injectable({ providedIn: 'root' })
export class ScoreHistoryService {
  /** Intento más reciente (aunque no esté en el top) para detectar fin de partida. */
  private lastRecordedKey: string | null = null;

  getTopAttempts(): ScoreAttempt[] {
    return this.read()
      .slice()
      .sort((a, b) => b.score - a.score || b.at - a.at)
      .slice(0, MAX_ATTEMPTS);
  }

  /**
   * Registra un intento terminado. Mantiene como máximo 3, priorizando mayor puntaje.
   */
  recordAttempt(score: number, poppedCount: number): ScoreAttempt[] {
    const attempt: ScoreAttempt = {
      score,
      poppedCount,
      at: Date.now(),
    };

    const key = `${attempt.at}:${attempt.score}`;
    if (this.lastRecordedKey === key) {
      return this.getTopAttempts();
    }
    this.lastRecordedKey = key;

    const next = [...this.read(), attempt]
      .sort((a, b) => b.score - a.score || b.at - a.at)
      .slice(0, MAX_ATTEMPTS);

    this.write(next);
    return next;
  }

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    this.lastRecordedKey = null;
  }

  private read(): ScoreAttempt[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
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

  private write(attempts: ScoreAttempt[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(attempts));
    } catch {
      /* ignore quota / private mode */
    }
  }
}
