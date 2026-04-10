import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface FolderTaskCardProps {
  task: any;
  onTaskPress?: (task: any) => void;
  onAcceptTask?: (taskId: string) => void;
  onRejectTask?: (taskId: string) => void;
  onTaskComplete?: (taskId: string) => void;
}

interface TaskAssignment {
  userId: string;
  username: string;
  avatar: string;
  status: 'pending' | 'accepted' | 'rejected';
  assignedAt: string;
}

export default function FolderTaskCard({ 
  task, 
  onTaskPress, 
  onAcceptTask, 
  onRejectTask, 
  onTaskComplete 
}: FolderTaskCardProps) {
  const { isDark } = useTheme();
  const { user } = useAuth();
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  // Colors
  const bg = isDark ? '#080810' : '#f8f9ff';
  const text = isDark ? '#ffffff' : '#0f172a';
  const textSub = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.55)';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const primary = '#6366f1';
  const accent = '#8b5cf6';
  const cyan = '#06b6d4';

  // Task status colors
  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#22c55e';
      case 'running': return '#f59e0b';
      case 'upcoming': return '#6366f1';
      case 'rejected': return '#ef4444';
      default: return '#6366f1';
    }
  };

  const taskStatusColor = getTaskStatusColor(task.status || 'upcoming');
  const isAssigned = task.assignments?.some((a: TaskAssignment) => a.userId === user?.id);
  const userAssignment = task.assignments?.find((a: TaskAssignment) => a.userId === user?.id);
  const isCompleted = task.completions?.some((c: any) => c.userId === user?.id);

  const handleTaskPress = () => {
    if (onTaskPress) {
      onTaskPress(task);
    } else {
      setIsExpanded(!isExpanded);
    }
  };

  const handleAcceptTask = async () => {
    if (!isAssigned) return;
    
    setLoading(true);
    try {
      await api.put(`/rooms/${task.roomId}/tasks/${task.id}/assign/${user!.id}`, {
        status: 'accepted'
      });
      
      if (onAcceptTask) {
        onAcceptTask(task.id);
      }
    } catch (error) {
      console.error('Error accepting task:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectTask = async () => {
    if (!isAssigned) return;
    
    setLoading(true);
    try {
      await api.put(`/rooms/${task.roomId}/tasks/${task.id}/assign/${user!.id}`, {
        status: 'rejected'
      });
      
      if (onRejectTask) {
        onRejectTask(task.id);
      }
    } catch (error) {
      console.error('Error rejecting task:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskComplete = async () => {
    setLoading(true);
    try {
      await api.post(`/rooms/${task.roomId}/tasks/${task.id}/complete`);
      
      if (onTaskComplete) {
        onTaskComplete(task.id);
      }
    } catch (error) {
      console.error('Error completing task:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProgressPercentage = () => {
    if (!task.assignments || task.assignments.length === 0) return 0;
    const completedCount = task.completions?.length || 0;
    return (completedCount / task.assignments.length) * 100;
  };

  const progress = getProgressPercentage();

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { borderColor: border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' }
      ]}
      onPress={handleTaskPress}
      disabled={loading}
    >
      {/* Folder Tab */}
      <View style={[styles.folderTab, { backgroundColor: taskStatusColor }]}>
        <View style={styles.tabContent}>
          <Text style={styles.tabText}>
            {task.status === 'completed' ? '✓' : 
             task.status === 'running' ? '▶' : 
             task.status === 'rejected' ? '✗' : '•'}
          </Text>
        </View>
      </View>

      {/* Folder Body */}
      <View style={styles.folderBody}>
        {/* Task Header */}
        <View style={styles.taskHeader}>
          <View style={styles.taskInfo}>
            <Text style={[styles.taskTitle, { color: text }]} numberOfLines={2}>
              {task.title}
            </Text>
            {task.description && (
              <Text style={[styles.taskDescription, { color: textSub }]} numberOfLines={1}>
                {task.description}
              </Text>
            )}
          </View>
          
          <View style={styles.taskMeta}>
            <View style={styles.pointsBadge}>
              <Ionicons name="star" size={14} color="#f59e0b" />
              <Text style={[styles.pointsText, { color: textSub }]}>{task.points}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: `${taskStatusColor}20` }]}>
              <Text style={[styles.statusText, { color: taskStatusColor }]}>
                {task.status || 'upcoming'}
              </Text>
            </View>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBar}>
            <LinearGradient
              colors={[primary, accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${progress}%` }]}
            />
          </View>
          <Text style={[styles.progressText, { color: textSub }]}>
            {Math.round(progress)}% completed
          </Text>
        </View>

        {/* Assignments */}
        <View style={styles.assignmentsRow}>
          <View style={styles.assignmentsContainer}>
            {task.assignments?.slice(0, 4).map((assignment: TaskAssignment, index: number) => (
              <View key={assignment.userId} style={[styles.assignmentBadge, { marginLeft: index > 0 ? -8 : 0 }]}>
                <Text style={styles.assignmentInitial}>
                  {assignment.username.charAt(0).toUpperCase()}
                </Text>
              </View>
            ))}
            {task.assignments && task.assignments.length > 4 && (
              <View style={styles.assignmentBadge}>
                <Text style={styles.assignmentInitial}>
                  +{task.assignments.length - 4}
                </Text>
              </View>
            )}
          </View>
          
          {isAssigned && (
            <View style={[styles.userStatusBadge, { backgroundColor: userAssignment?.status === 'accepted' ? '#22c55e20' : '#f59e0b20' }]}>
              <Text style={[styles.userStatusText, { color: userAssignment?.status === 'accepted' ? '#22c55e' : '#f59e0b' }]}>
                {userAssignment?.status === 'accepted' ? 'Accepted' : 'Pending'}
              </Text>
            </View>
          )}
        </View>

        {/* Expanded Content */}
        {isExpanded && (
          <Animated.View style={styles.expandedContent}>
            {/* Task Details */}
            <View style={styles.taskDetails}>
              <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={16} color={textSub} />
                <Text style={[styles.detailText, { color: textSub }]}>
                  Type: {task.taskType || 'daily'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="people-outline" size={16} color={textSub} />
                <Text style={[styles.detailText, { color: textSub }]}>
                  Assigned: {task.assignments?.length || 0}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="checkmark-circle-outline" size={16} color={textSub} />
                <Text style={[styles.detailText, { color: textSub }]}>
                  Completed: {task.completions?.length || 0}
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              {!isCompleted && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.completeButton]}
                  onPress={handleTaskComplete}
                  disabled={loading || !isAssigned || userAssignment?.status !== 'accepted'}
                >
                  <Text style={styles.completeButtonText}>
                    {loading ? 'Completing...' : 'Complete Task'}
                  </Text>
                </TouchableOpacity>
              )}
              
              {isAssigned && userAssignment?.status === 'pending' && (
                <View style={styles.assignmentActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.acceptButton]}
                    onPress={handleAcceptTask}
                    disabled={loading}
                  >
                    <Text style={styles.acceptButtonText}>
                      {loading ? 'Accepting...' : 'Accept'}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={handleRejectTask}
                    disabled={loading}
                  >
                    <Text style={styles.rejectButtonText}>
                      {loading ? 'Rejecting...' : 'Reject'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </Animated.View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
    position: 'relative',
  },
  folderTab: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 60,
    height: 20,
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  tabContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  folderBody: {
    marginLeft: 60,
    padding: 16,
    minHeight: 100,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  taskInfo: {
    flex: 1,
    marginRight: 12,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  taskDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  taskMeta: {
    alignItems: 'flex-end',
    gap: 8,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  pointsText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressBarContainer: {
    marginBottom: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
  },
  assignmentsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  assignmentsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assignmentBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#080810',
  },
  assignmentInitial: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  userStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  userStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  expandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  taskDetails: {
    gap: 8,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    fontWeight: '500',
  },
  actionButtons: {
    gap: 12,
  },
  actionButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButton: {
    backgroundColor: '#22c55e',
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  assignmentActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#22c55e',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#ef4444',
  },
  rejectButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});