import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'erbu-json-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './json-viewer.component.html',
  styleUrl: './json-viewer.component.scss',
})
export class JsonViewerComponent {
  readonly data = input<unknown>(null);

  readonly formattedJson = computed(() => {
    const value = this.data();
    if (value === null || value === undefined) {
      return 'null';
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  });

  readonly highlightedHtml = computed(() => {
    return this.syntaxHighlight(this.formattedJson());
  });

  private syntaxHighlight(json: string): string {
    return json
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(
        /("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
        (match) => {
          let cls = 'json-number';
          if (/^"/.test(match)) {
            cls = /:$/.test(match) ? 'json-key' : 'json-string';
          } else if (/true|false/.test(match)) {
            cls = 'json-boolean';
          } else if (/null/.test(match)) {
            cls = 'json-null';
          }
          return `<span class="${cls}">${match}</span>`;
        }
      );
  }
}
