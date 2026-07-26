import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  StoryItem,
  StoryStatus,
  StoryPriority,
} from '@erbu-admin-web/shared/models';

export interface StoriesFilter {
  status?: StoryStatus[];
  priority?: StoryPriority[];
  assignee?: string;
  search?: string;
  epic?: string;
}

export interface BatchMoveRequest {
  storyIds: string[];
  targetStatus: StoryStatus;
}

export interface BatchAssignRequest {
  storyIds: string[];
  assignee: string;
}

export interface StoriesPage {
  items: StoryItem[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable({ providedIn: 'root' })
export class StoriesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/cockpit/stories';

  list(filter?: StoriesFilter, page = 1, pageSize = 100): Observable<StoriesPage> {
    let params = new HttpParams()
      .set('page', page)
      .set('pageSize', pageSize);

    if (filter?.status?.length) {
      for (const s of filter.status) {
        params = params.append('status', s);
      }
    }
    if (filter?.priority?.length) {
      for (const p of filter.priority) {
        params = params.append('priority', p);
      }
    }
    if (filter?.assignee) {
      params = params.set('assignee', filter.assignee);
    }
    if (filter?.search) {
      params = params.set('search', filter.search);
    }
    if (filter?.epic) {
      params = params.set('epic', filter.epic);
    }

    return this.http.get<StoriesPage>(this.baseUrl, { params });
  }

  getById(id: string): Observable<StoryItem> {
    return this.http.get<StoryItem>(`${this.baseUrl}/${encodeURIComponent(id)}`);
  }

  updateStatus(id: string, status: StoryStatus): Observable<StoryItem> {
    return this.http.patch<StoryItem>(
      `${this.baseUrl}/${encodeURIComponent(id)}/status`,
      { status },
    );
  }

  updateAssignee(id: string, assignee: string): Observable<StoryItem> {
    return this.http.patch<StoryItem>(
      `${this.baseUrl}/${encodeURIComponent(id)}/assignee`,
      { assignee },
    );
  }

  batchMove(request: BatchMoveRequest): Observable<StoryItem[]> {
    return this.http.post<StoryItem[]>(`${this.baseUrl}/batch/move`, request);
  }

  batchAssign(request: BatchAssignRequest): Observable<StoryItem[]> {
    return this.http.post<StoryItem[]>(`${this.baseUrl}/batch/assign`, request);
  }

  exportStories(filter?: StoriesFilter): Observable<Blob> {
    let params = new HttpParams();
    if (filter?.status?.length) {
      for (const s of filter.status) {
        params = params.append('status', s);
      }
    }
    if (filter?.priority?.length) {
      for (const p of filter.priority) {
        params = params.append('priority', p);
      }
    }

    return this.http.get(`${this.baseUrl}/export`, {
      params,
      responseType: 'blob',
    });
  }

  importStories(file: File): Observable<StoryItem[]> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<StoryItem[]>(`${this.baseUrl}/import`, formData);
  }
}
