import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { GameCatalogItem, GAMES_CATALOG } from '../core/games-catalog';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage {
  readonly games = GAMES_CATALOG;
  readonly username = this.auth.currentUser?.username ?? 'jugador';

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  openGame(game: GameCatalogItem): void {
    void this.router.navigateByUrl(game.route);
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }

  trackGame(_index: number, game: GameCatalogItem): string {
    return game.id;
  }
}
