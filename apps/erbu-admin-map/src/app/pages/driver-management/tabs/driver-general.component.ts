import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { DriverDetail } from '../driver-management.service';

@Component({
  selector: 'app-driver-general',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatDividerModule],
  templateUrl: './driver-general.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DriverGeneralComponent {
  readonly driver = input.required<DriverDetail>();
}
