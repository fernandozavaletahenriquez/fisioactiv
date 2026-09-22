import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { IonicModule } from '@ionic/angular/lazy';
import { DodgeExergameComponent } from '../exergame/components/dodge-exergame/dodge-exergame.component';
import { DodgePage } from '../exergame/pages/dodge/dodge.page';

const routes: Routes = [
  {
    path: '',
    component: DodgePage,
  },
];

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [DodgePage, DodgeExergameComponent],
})
export class DodgePageModule {}
