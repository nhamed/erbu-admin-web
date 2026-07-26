import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfigService, ConfigSchema, SchemaStatus } from '../config.service';

@Component({
  selector: 'app-config-schemas-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './schemas-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchemasTabComponent {
  readonly svc = inject(ConfigService);

  readonly statusFilter = signal<SchemaStatus | ''>('');
  readonly expandedSchemaId = signal<string | null>(null);
  readonly activatingId = signal<string | null>(null);

  readonly statusOptions: SchemaStatus[] = ['draft', 'active', 'deprecated', 'archived'];

  readonly filteredSchemas = computed(() => {
    const schemas = this.svc.schemas();
    const status = this.statusFilter();
    if (status) {
      return schemas.filter((s) => s.status === status);
    }
    return schemas;
  });

  onStatusFilterChange(value: string): void {
    this.statusFilter.set(value as SchemaStatus | '');
  }

  toggleExpand(schemaId: string): void {
    this.expandedSchemaId.update((current) =>
      current === schemaId ? null : schemaId,
    );
  }

  activateSchema(schema: ConfigSchema): void {
    this.activatingId.set(schema.id);
    this.svc.activateSchema(schema.id).subscribe({
      next: () => this.activatingId.set(null),
      error: () => this.activatingId.set(null),
    });
  }

  statusClass(status: SchemaStatus): string {
    switch (status) {
      case 'active':
        return 'badge-success';
      case 'draft':
        return 'badge-info';
      case 'deprecated':
        return 'badge-warning';
      case 'archived':
        return 'badge-muted';
      default:
        return '';
    }
  }

  statusIcon(status: SchemaStatus): string {
    switch (status) {
      case 'active':
        return 'check_circle';
      case 'draft':
        return 'edit_note';
      case 'deprecated':
        return 'warning';
      case 'archived':
        return 'archive';
      default:
        return 'schema';
    }
  }

  fieldTypeIcon(type: string): string {
    switch (type.toLowerCase()) {
      case 'string':
        return 'text_fields';
      case 'number':
      case 'integer':
      case 'float':
        return 'tag';
      case 'boolean':
        return 'toggle_on';
      case 'array':
        return 'data_array';
      case 'object':
      case 'json':
        return 'data_object';
      default:
        return 'help_outline';
    }
  }

  trackBySchemaId(_: number, schema: ConfigSchema): string {
    return schema.id;
  }

  trackByFieldName(_: number, field: { name: string }): string {
    return field.name;
  }
}
