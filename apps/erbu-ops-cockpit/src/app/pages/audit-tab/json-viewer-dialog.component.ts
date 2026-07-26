import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface JsonViewerDialogData {
  title: string;
  json: unknown;
}

interface JsonToken {
  text: string;
  cssClass: string;
}

@Component({
  selector: 'app-json-viewer-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './json-viewer-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .json-viewer-container {
      min-width: 560px;
      max-width: 80vw;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
    }

    .json-content {
      flex: 1;
      overflow: auto;
      background: #1e1e1e;
      border-radius: 4px;
      padding: 16px;
      font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
      font-size: 13px;
      line-height: 1.5;
      white-space: pre;
      color: #d4d4d4;
      max-height: 60vh;
    }

    .json-key { color: #9cdcfe; }
    .json-string { color: #ce9178; }
    .json-number { color: #b5cea8; }
    .json-boolean { color: #569cd6; }
    .json-null { color: #569cd6; font-style: italic; }
    .json-brace { color: #ffd700; }
    .json-bracket { color: #da70d6; }
    .json-comma { color: #d4d4d4; }
    .json-colon { color: #d4d4d4; }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding-top: 8px;
    }

    .copy-success {
      color: #4caf50;
      font-size: 12px;
      margin-right: auto;
      align-self: center;
    }
  `],
})
export class JsonViewerDialogComponent implements OnInit {
  readonly data = inject<JsonViewerDialogData>(MAT_DIALOG_DATA);

  readonly tokens = signal<JsonToken[]>([]);
  readonly rawJson = signal<string>('');
  readonly copied = signal<boolean>(false);

  ngOnInit(): void {
    const formatted = JSON.stringify(this.data.json, null, 2);
    this.rawJson.set(formatted);
    this.tokens.set(this.tokenize(formatted));
  }

  copyToClipboard(): void {
    navigator.clipboard.writeText(this.rawJson()).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  private tokenize(json: string): JsonToken[] {
    const result: JsonToken[] = [];
    const regex =
      /("(?:[^"\\]|\\.)*")\s*:/g    // keys
      ;

    // Use a character-by-character approach for reliable tokenization
    const lines = json.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) {
        result.push({ text: '\n', cssClass: '' });
      }
      this.tokenizeLine(lines[i], result);
    }

    return result;
  }

  private tokenizeLine(line: string, tokens: JsonToken[]): void {
    // Match JSON tokens in the line
    const tokenRegex =
      /("(?:[^"\\]|\\.)*")\s*(?=:)|("(?:[^"\\]|\\.)*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(\btrue\b|\bfalse\b)|(\bnull\b)|([{}])|([[\]])|(:)|(,)|(\s+)/g;

    let match: RegExpExecArray | null;
    let lastIndex = 0;

    while ((match = tokenRegex.exec(line)) !== null) {
      // Any unmatched text before this match
      if (match.index > lastIndex) {
        tokens.push({ text: line.slice(lastIndex, match.index), cssClass: '' });
      }

      if (match[1] !== undefined) {
        // JSON key
        tokens.push({ text: match[1], cssClass: 'json-key' });
      } else if (match[2] !== undefined) {
        // JSON string value
        tokens.push({ text: match[2], cssClass: 'json-string' });
      } else if (match[3] !== undefined) {
        // Number
        tokens.push({ text: match[3], cssClass: 'json-number' });
      } else if (match[4] !== undefined) {
        // Boolean
        tokens.push({ text: match[4], cssClass: 'json-boolean' });
      } else if (match[5] !== undefined) {
        // Null
        tokens.push({ text: match[5], cssClass: 'json-null' });
      } else if (match[6] !== undefined) {
        // Braces
        tokens.push({ text: match[6], cssClass: 'json-brace' });
      } else if (match[7] !== undefined) {
        // Brackets
        tokens.push({ text: match[7], cssClass: 'json-bracket' });
      } else if (match[8] !== undefined) {
        // Colon
        tokens.push({ text: match[8], cssClass: 'json-colon' });
      } else if (match[9] !== undefined) {
        // Comma
        tokens.push({ text: match[9], cssClass: 'json-comma' });
      } else if (match[10] !== undefined) {
        // Whitespace
        tokens.push({ text: match[10], cssClass: '' });
      }

      lastIndex = match.index + match[0].length;
    }

    // Remaining text
    if (lastIndex < line.length) {
      tokens.push({ text: line.slice(lastIndex), cssClass: '' });
    }
  }
}
