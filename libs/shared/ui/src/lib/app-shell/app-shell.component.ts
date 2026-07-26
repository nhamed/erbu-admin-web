import { Component, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { ThemeService } from '@erbu-admin-web/shared/data-access';

@Component({
  selector: 'erbu-app-shell',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatSidenavModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
  ],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent {
  private readonly themeService = inject(ThemeService);

  readonly appTitle = input<string>('Erbu Admin');
  readonly showSidenav = input<boolean>(true);
  readonly currentTheme = this.themeService.currentTheme;

  cycleTheme(): void {
    this.themeService.cycleTheme();
  }

  get themeIcon(): string {
    switch (this.currentTheme()) {
      case 'dark':
        return 'dark_mode';
      case 'light':
        return 'light_mode';
      case 'high-contrast':
        return 'contrast';
    }
  }
}
