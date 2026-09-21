import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular/lazy';

import { ExergamePageRoutingModule } from './exergame-routing.module';
import { GamePage } from './pages/game/game.page';
import { ShadowExergameComponent } from './components/shadow-exergame/shadow-exergame.component';

@NgModule({
  imports: [CommonModule, FormsModule, RouterModule, IonicModule, ExergamePageRoutingModule],
  declarations: [GamePage, ShadowExergameComponent],
})
export class ExergamePageModule {}
