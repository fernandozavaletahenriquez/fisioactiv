import { ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { SupportMessageService } from '../../core/support-message.service';
import { UiChromeService } from '../../core/ui-chrome.service';

@Component({
  selector: 'app-whatsapp-widget',
  templateUrl: './whatsapp-widget.component.html',
  styleUrls: ['./whatsapp-widget.component.scss'],
  standalone: false,
})
export class WhatsappWidgetComponent implements OnDestroy {
  open = false;
  successOpen = false;
  phone = '';
  message = '';
  errorMessage = '';
  loading = false;
  hidden = false;

  private readonly sub: Subscription;

  constructor(
    private readonly uiChrome: UiChromeService,
    private readonly supportMessages: SupportMessageService,
    private readonly cdr: ChangeDetectorRef,
  ) {
    this.sub = this.uiChrome.hideWhatsApp$.subscribe((hide) => {
      this.hidden = hide;
      if (hide) {
        this.open = false;
        this.successOpen = false;
        this.errorMessage = '';
      }
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  toggle(): void {
    if (this.hidden) {
      return;
    }
    this.open = !this.open;
    this.successOpen = false;
    this.errorMessage = '';
  }

  closePanel(): void {
    this.open = false;
    this.errorMessage = '';
  }

  async submit(): Promise<void> {
    const phone = this.phone.trim();
    const message = this.message.trim();
    if (!phone || !message || this.loading) {
      return;
    }

    this.errorMessage = '';
    this.loading = true;
    this.cdr.detectChanges();

    try {
      const result = await this.supportMessages.submit(phone, message);
      if (!result.ok) {
        this.errorMessage = result.message ?? 'No se pudo enviar el mensaje.';
        return;
      }

      this.open = false;
      this.successOpen = true;
      this.phone = '';
      this.message = '';

      window.setTimeout(() => {
        this.successOpen = false;
        this.cdr.detectChanges();
      }, 3200);
    } catch {
      this.errorMessage = 'No se pudo enviar el mensaje. Intenta de nuevo.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  dismissSuccess(): void {
    this.successOpen = false;
  }
}
