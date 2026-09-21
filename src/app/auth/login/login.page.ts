import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage {
  username = '';
  password = '';
  errorMessage = '';
  loading = false;

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {
    if (this.auth.isLoggedIn) {
      void this.router.navigateByUrl('/home');
    }
  }

  async submit(): Promise<void> {
    this.errorMessage = '';
    this.loading = true;
    try {
      const result = await this.auth.login(this.username, this.password);
      if (!result.ok) {
        this.errorMessage = result.message ?? 'No se pudo iniciar sesión.';
        return;
      }
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/home';
      await this.router.navigateByUrl(returnUrl);
    } catch {
      this.errorMessage = 'No se pudo conectar. Intenta de nuevo.';
    } finally {
      this.loading = false;
    }
  }
}
