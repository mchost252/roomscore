/**
 * RoomTaskNodeService — Local persistence for Room Thread Nodes
 * 
 * Handles storing messages, proofs, and system alerts per Task ID.
 * Falls back to AsyncStorage for instant WhatsApp-like load times.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RoomTaskNode } from '../types/room';

const PREFIX = 'room_thread_nodes_';

class RoomTaskNodeService {
  private cache: Map<string, RoomTaskNode[]> = new Map();

  async getNodes(taskId: string): Promise<RoomTaskNode[]> {
    try {
      if (this.cache.has(taskId)) return this.cache.get(taskId)!;

      const stored = await AsyncStorage.getItem(`${PREFIX}${taskId}`);
      if (stored) {
        const nodes: RoomTaskNode[] = JSON.parse(stored);
        this.cache.set(taskId, nodes);
        return nodes;
      }
      return [];
    } catch (e) {
      console.error('Failed to load nodes:', e);
      return [];
    }
  }

  async addNode(taskId: string, node: RoomTaskNode): Promise<RoomTaskNode> {
    try {
      const nodes = await this.getNodes(taskId);
      const updated = [...nodes, node];
      
      this.cache.set(taskId, updated);
      await AsyncStorage.setItem(`${PREFIX}${taskId}`, JSON.stringify(updated));
      return node;
    } catch (e) {
      console.error('Failed to save node:', e);
      return node;
    }
  }

  async updateNode(taskId: string, nodeId: string, patch: Partial<RoomTaskNode>): Promise<void> {
    try {
      const nodes = await this.getNodes(taskId);
      const updated = nodes.map(n => n.id === nodeId ? { ...n, ...patch } : n);
      
      this.cache.set(taskId, updated);
      await AsyncStorage.setItem(`${PREFIX}${taskId}`, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to update node:', e);
    }
  }

  async purgeOldNodes(taskId: string, retentionDays: number = 5): Promise<void> {
    try {
      const nodes = await this.getNodes(taskId);
      const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
      
      const filtered = nodes.filter(n => new Date(n.createdAt).getTime() > cutoff);
      
      if (filtered.length !== nodes.length) {
        this.cache.set(taskId, filtered);
        await AsyncStorage.setItem(`${PREFIX}${taskId}`, JSON.stringify(filtered));
        console.log(`Purged ${nodes.length - filtered.length} old nodes from thread ${taskId}`);
      }
    } catch (e) {
      console.error('Failed to purge nodes:', e);
    }
  }
}

export const roomTaskNodeService = new RoomTaskNodeService();
