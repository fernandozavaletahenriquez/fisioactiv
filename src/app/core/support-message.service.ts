import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export interface SupportSubmitResult {
  ok: boolean;
  message?: string;
}

/** Columnas reales en Supabase: telephone (text), messaje (text), ip_public (text). */
@Injectable({ providedIn: 'root' })
export class SupportMessageService {
  async submit(telephoneRaw: string, message: string): Promise<SupportSubmitResult> {
    const telephone = telephoneRaw.replace(/\D/g, '');
    const messaje = message.trim();

    if (!telephone || !messaje) {
      return { ok: false, message: 'Completa teléfono y mensaje.' };
    }

    const base = environment.supabaseUrl?.replace(/\/$/, '');
    const key = environment.supabaseAnonKey;
    if (!base || !key || key.startsWith('PEGA_AQUI')) {
      return {
        ok: false,
        message: 'Falta la publishable key de Supabase.',
      };
    }

    let ipPublic: string;
    try {
      ipPublic = await this.fetchPublicIp();
    } catch {
      return {
        ok: false,
        message: 'No se pudo obtener tu IP pública. Intenta de nuevo.',
      };
    }

    try {
      const existing = await this.restGetMessagesByIp(base, key, ipPublic);
      if (existing.length > 0) {
        return {
          ok: false,
          message: 'Ya enviaste un mensaje desde esta red. Solo se permite uno.',
        };
      }

      const { status, errorMessage } = await this.restInsertMessage(base, key, {
        telephone,
        messaje,
        ip_public: ipPublic,
      });

      if (status === 201 || status === 200) {
        return { ok: true };
      }

      if (status === 409) {
        return {
          ok: false,
          message: 'Ya enviaste un mensaje desde esta red. Solo se permite uno.',
        };
      }

      return {
        ok: false,
        message: errorMessage
          ? `No se pudo guardar el mensaje (${errorMessage}).`
          : `No se pudo guardar el mensaje (HTTP ${status}).`,
      };
    } catch (err) {
      const aborted =
        err instanceof DOMException &&
        (err.name === 'AbortError' || err.name === 'TimeoutError');
      return {
        ok: false,
        message: aborted
          ? 'La conexión tardó demasiado. Intenta de nuevo.'
          : 'No se pudo conectar con el servidor. Intenta de nuevo.',
      };
    }
  }

  private async restGetMessagesByIp(
    base: string,
    key: string,
    ipPublic: string,
  ): Promise<Array<{ id: number }>> {
    const url =
      `${base}/rest/v1/messages` +
      `?select=id&ip_public=eq.${encodeURIComponent(ipPublic)}&limit=1`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      throw new Error(`GET messages ${res.status}`);
    }

    const data = (await res.json()) as Array<{ id: number }>;
    return Array.isArray(data) ? data : [];
  }

  private async restInsertMessage(
    base: string,
    key: string,
    body: { telephone: string; messaje: string; ip_public: string },
  ): Promise<{ status: number; errorMessage?: string }> {
    const res = await fetch(`${base}/rest/v1/messages`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    });

    let errorMessage: string | undefined;
    try {
      const text = await res.text();
      if (text && !res.ok) {
        const parsed = JSON.parse(text) as { message?: string; code?: string };
        errorMessage = parsed.message ?? text;
      }
    } catch {
      /* ignore */
    }

    return { status: res.status, errorMessage };
  }

  private async fetchPublicIp(): Promise<string> {
    const res = await fetch('https://api.ipify.org?format=json', {
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      throw new Error(`ipify ${res.status}`);
    }
    const data = (await res.json()) as { ip?: string };
    if (!data.ip) {
      throw new Error('ip vacía');
    }
    return data.ip;
  }
}
