import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WhatsappWidgetComponent } from './whatsapp-widget.component';

@NgModule({
  imports: [CommonModule, FormsModule],
  declarations: [WhatsappWidgetComponent],
  exports: [WhatsappWidgetComponent],
})
export class WhatsappWidgetModule {}
