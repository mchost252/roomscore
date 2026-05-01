/**
 * RoomTaskNodeService — Local persistence for Room Thread Nodes (SQLite backed)
 * 
 * Handles storing messages, proofs, and system alerts per Task ID.
 * Uses SQLite for robust relational storage and MMKV/Map for speed.
 */
import { RoomTaskNode } from '../types/room';
import { getRoomDb } from '../db/roomDb';

class RoomTaskNodeService {
  // Lru-ish cache to prevent memory leaks while keeping recent nodes fast
  private cache: Map<string, RoomTaskNode[]> = new Map();
  private maxCacheSize = 10; // Only keep 10 threads in memory

  getCachedNodes(taskId: string): RoomTaskNode[] | null {
    return this.cache.get(taskId) || null;
  }

  async getNodes(taskId: string, limit: number = 50, before?: string): Promise<RoomTaskNode[]> {
    try {
      // Return from memory if we have it and no pagination is requested
      if (!before && this.cache.has(taskId)) {
        return this.cache.get(taskId)!;
      }

      const db = await getRoomDb();
      let query = 'SELECT * FROM room_task_nodes WHERE taskId = ?';
      const params: any[] = [taskId];

      if (before) {
        query += ' AND createdAt < ?';
        params.push(before);
      }

      query += ' ORDER BY createdAt DESC LIMIT ?';
      params.push(limit);

      const rows = await db.getAllAsync(query, params);
      
      const nodes: RoomTaskNode[] = rows.map((row: any) => ({
        ...row,
        isPinned: !!row.isPinned,
        user: row.userJson ? JSON.parse(row.userJson) : null,
      })).reverse(); // Reverse to get chronological order for UI

      // Cache the latest set if not paginating
      if (!before) {
        if (this.cache.size >= this.maxCacheSize) {
          const firstKey = this.cache.keys().next().value;
          if (firstKey) this.cache.delete(firstKey);
        }
        this.cache.set(taskId, nodes);
      }

      return nodes;
    } catch (e) {
      console.error('[RoomTaskNodeService] Failed to load nodes:', e);
      return [];
    }
  }

  async addNode(taskId: string, node: RoomTaskNode): Promise<RoomTaskNode> {
    try {
      const db = await getRoomDb();
      
      const userJson = node.user ? JSON.stringify(node.user) : null;
      const nodeId = node.id || node._id;

      await db.runAsync(
        `INSERT OR REPLACE INTO room_task_nodes 
        (id, roomId, taskId, userId, type, content, caption, status, vouchCount, isPinned, mediaUrl, blurHash, heatLevel, createdAt, updatedAt, userJson, clientReferenceId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          nodeId, node.roomId, taskId, node.userId || node.user?.id, 
          node.type, node.content, node.caption || null, node.status, node.vouchCount || 0, node.isPinned ? 1 : 0,
          node.mediaUrl, node.blurHash, node.heatLevel || 0,
          node.createdAt, node.updatedAt, userJson, node.clientReferenceId
        ]
      );

      // Invalidate cache to force reload on next access
      this.cache.delete(taskId);
      
      return node;
    } catch (e) {
      console.error('[RoomTaskNodeService] Failed to save node:', e);
      return node;
    }
  }

  async updateNode(taskId: string, nodeId: string, patch: Partial<RoomTaskNode>): Promise<void> {
    try {
      const db = await getRoomDb();
      
      // Construct dynamic update query
      const keys = Object.keys(patch).filter(k => k !== 'user' && k !== 'id' && k !== '_id');
      if (keys.length === 0 && !patch.user) return;

      let query = 'UPDATE room_task_nodes SET ';
      const params: any[] = [];

      keys.forEach((key, i) => {
        query += `${key} = ?${i === keys.length - 1 && !patch.user ? '' : ', '}`;
        params.push((patch as any)[key]);
      });

      if (patch.user) {
        query += `userJson = ?`;
        params.push(JSON.stringify(patch.user));
      }

      query += ' WHERE id = ? OR clientReferenceId = ?';
      params.push(nodeId, nodeId);

      await db.runAsync(query, params);
      this.cache.delete(taskId);
    } catch (e) {
      console.error('[RoomTaskNodeService] Failed to update node:', e);
    }
  }

  async purgeOldNodes(taskId: string, retentionDays: number = 5): Promise<void> {
    try {
      const db = await getRoomDb();
      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
      
      const result = await db.runAsync(
        'DELETE FROM room_task_nodes WHERE taskId = ? AND createdAt < ?',
        [taskId, cutoff]
      );
      
      if (result.changes > 0) {
        this.cache.delete(taskId);
        console.log(`[RoomTaskNodeService] Purged ${result.changes} old nodes from thread ${taskId}`);
      }
    } catch (e) {
      console.error('[RoomTaskNodeService] Failed to purge nodes:', e);
    }
  }
}

export const roomTaskNodeService = new RoomTaskNodeService();
