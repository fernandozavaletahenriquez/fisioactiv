import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/** Controla chrome global (WhatsApp FAB, etc.). */
@Injectable({ providedIn: 'root' })
export class UiChromeService {
  private readonly hideWhatsAppSubject = new BehaviorSubject<boolean>(false);
  readonly hideWhatsApp$ = this.hideWhatsAppSubject.asObservable();

  setHideWhatsApp(hide: boolean): void {
    this.hideWhatsAppSubject.next(hide);
  }
}
