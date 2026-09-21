import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SupabaseService, withTimeout } from '../supabase.service';

const SESSION_KEY = 'fisioactiv.auth.user';

export interface AuthUser {
  username: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly userSubject: BehaviorSubject<AuthUser | null>;
  readonly user$;

  constructor(private readonly supabase: SupabaseService) {
    const saved = this.readSession();
    this.userSubject = new BehaviorSubject<AuthUser | null>(saved);
    this.user$ = this.userSubject.asObservable();
  }

  get currentUser(): AuthUser | null {
    return this.userSubject.value;
  }

  get isLoggedIn(): boolean {
    return !!this.userSubject.value;
  }

  get isConfigured(): boolean {
    return this.supabase.isConfigured;
  }

  async login(username: string, password: string): Promise<{ ok: boolean; message?: string }> {
    const user = username.trim();
    const pass = password;

    if (!user || !pass) {
      return { ok: false, message: 'Ingresa usuario y contraseña.' };
    }

    if (!this.supabase.client) {
      return {
        ok: false,
        message:
          'Falta la publishable key de Supabase. Pégala en src/environments/secrets.ts.',
      };
    }

    try {
      const { data, error } = await withTimeout(
        this.supabase.client
          .from('users')
          .select('username')
          .eq('username', user)
          .eq('password', pass)
          .maybeSingle(),
      );

      if (error) {
        return {
          ok: false,
          message: `No se pudo validar el acceso (${error.message}). Revisa la tabla users y RLS.`,
        };
      }

      if (!data?.username) {
        return { ok: false, message: 'Usuario o contraseña incorrectos.' };
      }

      const session: AuthUser = { username: data.username };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      this.userSubject.next(session);
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      return {
        ok: false,
        message: msg.includes('tardó')
          ? msg
          : 'No se pudo conectar con el servidor. Revisa tu red e inténtalo otra vez.',
      };
    }
  }

  logout(): void {
    localStorage.removeItem(SESSION_KEY);
    this.userSubject.next(null);
  }

  private readSession(): AuthUser | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as AuthUser;
      if (!parsed?.username) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }
}
