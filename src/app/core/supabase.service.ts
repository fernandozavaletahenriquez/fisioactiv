import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const timeout = AbortSignal.timeout(10_000);
  const signal =
    init?.signal && typeof AbortSignal.any === 'function'
      ? AbortSignal.any([init.signal, timeout])
      : timeout;
  return fetch(input, { ...init, signal });
}

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient | null;

  constructor() {
    const key = environment.supabaseAnonKey;
    const configured =
      !!environment.supabaseUrl &&
      !!key &&
      !key.startsWith('PEGA_AQUI');

    this.client = configured
      ? createClient(environment.supabaseUrl, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { fetch: fetchWithTimeout },
        })
      : null;
  }

  get isConfigured(): boolean {
    return !!this.client;
  }
}

/** Evita que una petición de Supabase deje la UI colgada. */
export async function withTimeout<T>(
  promise: PromiseLike<T>,
  ms = 10_000,
  label = 'La conexión tardó demasiado. Intenta de nuevo.',
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(label)), ms);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
