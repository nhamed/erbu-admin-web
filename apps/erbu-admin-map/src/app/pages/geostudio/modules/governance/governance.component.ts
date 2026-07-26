import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'geo-governance',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="module-placeholder">
      <h2>Governance</h2>
      <p>Release workflows, schema governance, and architecture decision records.</p>
    </section>
  `,
  styles: [`:host { display: block; padding: 24px; color: #e0e0e0; } .module-placeholder { opacity: 0.7; }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GovernanceComponent {}
