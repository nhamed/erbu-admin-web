import { Injectable, signal, computed } from '@angular/core';

// ---------- Types ----------

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export interface GeoNotification {
  id: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  moduleId: string | null;
  timestamp: number;
  isRead: boolean;
  action: string | null;
  actionRoute: string | null;
}

@Injectable({ providedIn: 'root' })
export class GeoNotificationService {
  // ---------- State ----------
  readonly notifications = signal<GeoNotification[]>([]);
  readonly showDropdown = signal(false);

  readonly unreadCount = computed(
    () => this.notifications().filter((n) => !n.isRead).length,
  );

  readonly hasUnread = computed(() => this.unreadCount() > 0);

  readonly sortedNotifications = computed(() =>
    [...this.notifications()].sort((a, b) => b.timestamp - a.timestamp),
  );

  // ---------- Public API ----------

  push(
    title: string,
    message: string,
    severity: NotificationSeverity = 'info',
    moduleId: string | null = null,
    action: string | null = null,
    actionRoute: string | null = null,
  ): void {
    const notification: GeoNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title,
      message,
      severity,
      moduleId,
      timestamp: Date.now(),
      isRead: false,
      action,
      actionRoute,
    };

    this.notifications.update((list) => [notification, ...list].slice(0, 100));
  }

  markAsRead(id: string): void {
    this.notifications.update((list) =>
      list.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
  }

  markAllAsRead(): void {
    this.notifications.update((list) =>
      list.map((n) => ({ ...n, isRead: true })),
    );
  }

  dismiss(id: string): void {
    this.notifications.update((list) => list.filter((n) => n.id !== id));
  }

  clearAll(): void {
    this.notifications.set([]);
  }

  toggleDropdown(): void {
    this.showDropdown.update((v) => !v);
  }

  closeDropdown(): void {
    this.showDropdown.set(false);
  }
}
