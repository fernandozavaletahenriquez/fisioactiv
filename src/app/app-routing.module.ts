import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/auth/auth.guard';

const routes: Routes = [
  {
    path: 'login',
    loadChildren: () => import('./auth/login/login.module').then((m) => m.LoginPageModule),
  },
  {
    path: 'home',
    canActivate: [AuthGuard],
    loadChildren: () => import('./home/home.module').then((m) => m.HomePageModule),
  },
  {
    path: 'game',
    canActivate: [AuthGuard],
    loadChildren: () => import('./exergame/exergame.module').then((m) => m.ExergamePageModule),
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
