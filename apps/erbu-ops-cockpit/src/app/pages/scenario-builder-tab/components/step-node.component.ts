import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScenarioNodeType } from '@erbu-admin-web/shared/models';

export interface StepNodeData {
  id: string;
  label: string;
  type: ScenarioNodeType;
  x: number;
  y: number;
  isEntryPoint: boolean;
  isTerminal: boolean;
  status: 'idle' | 'running' | 'passed' | 'failed' | 'error' | null;
  hasError: boolean;
}

@Component({
  selector: 'app-step-node',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './step-node.component.html',
  styleUrl: './step-node.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepNodeComponent {
  readonly node = input.required<StepNodeData>();
  readonly selected = input(false);

  readonly nodeSelect = output<string>();
  readonly nodeDelete = output<string>();
  readonly dragStart = output<{ id: string; startX: number; startY: number }>();

  readonly typeIcon = computed(() => {
    switch (this.node().type) {
      case ScenarioNodeType.Action:
        return 'play_arrow';
      case ScenarioNodeType.Condition:
        return 'call_split';
      case ScenarioNodeType.Wait:
        return 'hourglass_empty';
      case ScenarioNodeType.Assert:
        return 'check_circle';
      case ScenarioNodeType.Loop:
        return 'loop';
      case ScenarioNodeType.Parallel:
        return 'view_column';
      case ScenarioNodeType.SubScenario:
        return 'account_tree';
      default:
        return 'radio_button_unchecked';
    }
  });

  readonly typeLabel = computed(() => {
    return this.node().type;
  });

  readonly statusClass = computed(() => {
    const status = this.node().status;
    if (!status || status === 'idle') return '';
    return `status-${status}`;
  });

  onMouseDown(event: MouseEvent): void {
    event.stopPropagation();
    this.nodeSelect.emit(this.node().id);
    this.dragStart.emit({
      id: this.node().id,
      startX: event.clientX,
      startY: event.clientY,
    });
  }

  onSelect(event: MouseEvent): void {
    event.stopPropagation();
    this.nodeSelect.emit(this.node().id);
  }

  onDelete(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    this.nodeDelete.emit(this.node().id);
  }
}
