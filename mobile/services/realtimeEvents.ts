type RealtimeHandler = (data?: any) => void;

class RealtimeEvents {
  private listeners = new Map<string, Set<RealtimeHandler>>();

  on(event: string, handler: RealtimeHandler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  off(event: string, handler: RealtimeHandler): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    handlers.delete(handler);
    if (handlers.size === 0) {
      this.listeners.delete(event);
    }
  }

  emit(event: string, data?: any): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    handlers.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        console.warn(`[RealtimeEvents] handler failed for ${event}:`, error);
      }
    });
  }
}

export default new RealtimeEvents();
