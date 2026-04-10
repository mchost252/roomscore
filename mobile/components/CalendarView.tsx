import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Dimensions,
  StyleSheet, Alert, Modal, TextInput
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width: W } = Dimensions.get('window');

interface CalendarViewProps {
  roomId: string;
  onTaskSelect?: (task: any) => void;
  /** Optional controlled mode for room-detail screen */
  tasks?: any[];
  selectedDate?: Date;
  onDateSelect?: (d: Date) => void;
  onTaskComplete?: (task: any) => void;
  isOwner?: boolean;
  onTaskCreate?: () => void;
}

interface TaskAssignment {
  userId: string;
  username: string;
  avatar: string;
  status: 'pending' | 'accepted' | 'rejected';
  assignedAt: string;
}

interface CalendarTask {
  id: string;
  title: string;
  description?: string;
  points: number;
  status: string;
  completions: any[];
  assignments: TaskAssignment[];
  _id: string;
}

export default function CalendarView({
  roomId,
  onTaskSelect,
  tasks: _tasksProp,
  selectedDate: _selectedDateProp,
  onDateSelect: _onDateSelect,
  onTaskComplete: _onTaskComplete,
  isOwner: _isOwner,
  onTaskCreate: _onTaskCreate,
}: CalendarViewProps) {
  const { isDark } = useTheme();
  const { user } = useAuth();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasksByDate, setTasksByDate] = useState<Record<string, CalendarTask[]>>({});
  const [loading, setLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState<CalendarTask | null>(null);
  const [assignmentModalVisible, setAssignmentModalVisible] = useState(false);
  const [assignmentStatus, setAssignmentStatus] = useState<'pending' | 'accepted' | 'rejected'>('pending');

  // Colors
  const bg = isDark ? '#080810' : '#f8f9ff';
  const text = isDark ? '#ffffff' : '#0f172a';
  const textSub = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.55)';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const primary = '#6366f1';
  const accent = '#8b5cf6';
  const cyan = '#06b6d4';

  // Calendar logic
  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }
    return days;
  }, [currentDate]);

  const monthYearString = useMemo(() => {
    return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [currentDate]);

  const loadCalendarData = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = new Date(currentDate);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(currentDate);
      endDate.setMonth(endDate.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);

      const response = await api.get(`/rooms/${roomId}/tasks/calendar`, {
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      });
      
      setTasksByDate(response.data.tasksByDate);
    } catch (error) {
      console.error('Error loading calendar data:', error);
    } finally {
      setLoading(false);
    }
  }, [roomId, currentDate]);

  React.useEffect(() => {
    loadCalendarData();
  }, [loadCalendarData]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const formatDateKey = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#22c55e';
      case 'running': return '#f59e0b';
      case 'upcoming': return '#6366f1';
      case 'rejected': return '#ef4444';
      default: return '#6366f1';
    }
  };

  const handleTaskPress = (task: CalendarTask) => {
    setSelectedTask(task);
    setAssignmentModalVisible(true);
  };

  const handleAssignmentAction = async (status: 'accepted' | 'rejected') => {
    try {
      await api.put(`/rooms/${roomId}/tasks/${selectedTask!.id}/assign/${user!.id}`, {
        status
      });
      
      setAssignmentStatus(status);
      setAssignmentModalVisible(false);
      setSelectedTask(null);
      loadCalendarData();
    } catch (error) {
      console.error('Error updating assignment:', error);
      Alert.alert('Error', 'Failed to update task assignment');
    }
  };

  const TaskCard = ({ task }: { task: CalendarTask }) => {
    const isAssigned = task.assignments.some(a => a.userId === user?.id);
    const userAssignment = task.assignments.find(a => a.userId === user?.id);
    const isCompleted = task.completions.some(c => c.userId === user?.id);

    return (
      <TouchableOpacity
        style={[
          styles.taskCard,
          { borderColor: border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' }
        ]}
        onPress={() => handleTaskPress(task)}
      >
        <View style={styles.taskCardHeader}>
          <View style={styles.taskStatusIndicator}>
            <View style={[styles.statusDot, { backgroundColor: getTaskStatusColor(task.status) }]} />
            <Text style={[styles.taskStatusText, { color: textSub }]}>{task.status}</Text>
          </View>
          <View style={styles.taskPoints}>
            <Ionicons name="star" size={14} color="#f59e0b" />
            <Text style={[styles.taskPointsText, { color: textSub }]}>{task.points}</Text>
          </View>
        </View>
        
        <Text style={[styles.taskTitle, { color: text }]} numberOfLines={2}>
          {task.title}
        </Text>
        
        {task.description && (
          <Text style={[styles.taskDescription, { color: textSub }]} numberOfLines={1}>
            {task.description}
          </Text>
        )}
        
        <View style={styles.taskFooter}>
          <View style={styles.assignmentsContainer}>
            {task.assignments.slice(0, 3).map((assignment, index) => (
              <View key={assignment.userId} style={[styles.assignmentBadge, { marginLeft: index > 0 ? -8 : 0 }]}>
                <Text style={styles.assignmentInitial}>
                  {assignment.username.charAt(0).toUpperCase()}
                </Text>
              </View>
            ))}
            {task.assignments.length > 3 && (
              <View style={styles.assignmentBadge}>
                <Text style={styles.assignmentInitial}>
                  +{task.assignments.length - 3}
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
      </TouchableOpacity>
    );
  };

  const CalendarDay = ({ date }: { date: Date }) => {
    const dateKey = formatDateKey(date);
    const tasks = tasksByDate[dateKey] || [];
    const isCurrentMonth = date.getMonth() === currentDate.getMonth();
    const isToday = date.toDateString() === new Date().toDateString();
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    return (
      <View style={[
        styles.dayContainer,
        { opacity: isCurrentMonth ? 1 : 0.5 }
      ]}>
        <View style={[
          styles.dayHeader,
          isToday && { backgroundColor: `${primary}20`, borderRadius: 8 }
        ]}>
          <Text style={[
            styles.dayNumber,
            { color: isToday ? primary : text },
            !isCurrentMonth && { color: textSub }
          ]}>
            {date.getDate()}
          </Text>
          {isToday && <Text style={[styles.todayLabel, { color: primary }]}>Today</Text>}
        </View>
        
        <ScrollView style={styles.tasksContainer} showsVerticalScrollIndicator={false}>
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
          
          {tasks.length === 0 && isCurrentMonth && (
            <View style={styles.emptyDay}>
              <Ionicons name="calendar-outline" size={20} color={textSub} />
              <Text style={[styles.emptyDayText, { color: textSub }]}>No tasks</Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Calendar Header */}
      <View style={styles.calendarHeader}>
        <TouchableOpacity onPress={() => navigateMonth('prev')} style={styles.navButton}>
          <Ionicons name="chevron-back" size={24} color={text} />
        </TouchableOpacity>
        
        <Text style={[styles.monthYearText, { color: text }]}>{monthYearString}</Text>
        
        <TouchableOpacity onPress={() => navigateMonth('next')} style={styles.navButton}>
          <Ionicons name="chevron-forward" size={24} color={text} />
        </TouchableOpacity>
      </View>

      {/* Week Days Header */}
      <View style={styles.weekDaysHeader}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <Text key={day} style={[styles.weekDayText, { color: textSub }]}>{day}</Text>
        ))}
      </View>

      {/* Calendar Grid */}
      <ScrollView style={styles.calendarGrid} showsVerticalScrollIndicator={false}>
        <View style={styles.calendarBody}>
          {daysInMonth.map((date, index) => (
            <CalendarDay key={index} date={date} />
          ))}
        </View>
      </ScrollView>

      {/* Assignment Modal */}
      <Modal
        visible={assignmentModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAssignmentModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setAssignmentModalVisible(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: bg }]}>
            {selectedTask && (
              <>
                <Text style={[styles.modalTitle, { color: text }]}>{selectedTask.title}</Text>
                
                {selectedTask.description && (
                  <Text style={[styles.modalDescription, { color: textSub }]}>{selectedTask.description}</Text>
                )}
                
                <View style={styles.modalStats}>
                  <View style={styles.statItem}>
                    <Ionicons name="star" size={16} color="#f59e0b" />
                    <Text style={[styles.statText, { color: textSub }]}>{selectedTask.points} points</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Ionicons name="people-outline" size={16} color={textSub} />
                    <Text style={[styles.statText, { color: textSub }]}>{selectedTask.assignments.length} assigned</Text>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.acceptButton]}
                    onPress={() => handleAssignmentAction('accepted')}
                  >
                    <Text style={styles.acceptButtonText}>Accept Task</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => handleAssignmentAction('rejected')}
                  >
                    <Text style={styles.rejectButtonText}>Reject Task</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  navButton: {
    padding: 8,
    borderRadius: 8,
  },
  monthYearText: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
  },
  weekDaysHeader: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  calendarGrid: {
    flex: 1,
  },
  calendarBody: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  dayContainer: {
    width: `${100/7}%`,
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: '700',
  },
  todayLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  tasksContainer: {
    maxHeight: 120,
  },
  taskCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    minHeight: 80,
  },
  taskCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  taskStatusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  taskStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  taskPoints: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  taskPointsText: {
    fontSize: 12,
    fontWeight: '600',
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  taskDescription: {
    fontSize: 12,
    marginBottom: 8,
  },
  taskFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  assignmentsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assignmentBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#080810',
  },
  assignmentInitial: {
    fontSize: 12,
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
  emptyDay: {
    alignItems: 'center',
    paddingVertical: 16,
    opacity: 0.5,
  },
  emptyDayText: {
    fontSize: 12,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  modalStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  statText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#22c55e',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  rejectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});