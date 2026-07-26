import {
  Component,
  ChangeDetectionStrategy,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'geo-studio-icon',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <span
      class="studio-icon"
      [class]="'size-' + size()"
      [class.muted]="muted()"
    >
      <mat-icon [style.font-size.px]="iconPx()" [style.width.px]="iconPx()" [style.height.px]="iconPx()">
        {{ name() }}
      </mat-icon>
    </span>
  `,
  styles: [`
    .studio-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #e0e0e0;

      &.muted {
        color: #8e8ea0;
      }

      &.size-sm mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &.size-md mat-icon { font-size: 20px; width: 20px; height: 20px; }
      &.size-lg mat-icon { font-size: 28px; width: 28px; height: 28px; }
      &.size-xl mat-icon { font-size: 36px; width: 36px; height: 36px; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudioIconComponent {
  readonly name = input.required<string>();
  readonly size = input<'sm' | 'md' | 'lg' | 'xl'>('md');
  readonly muted = input<boolean>(false);

  readonly iconPx = input<number | undefined>(undefined);
}
