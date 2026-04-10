import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Task } from '../types/room';

interface TaskCardProps {
  task: Task;
  onTaskComplete: (task: Task) => void;
  isOwner: boolean;
  onTaskEdit?: (task: Task) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onTaskComplete,
  isOwner,
  onTaskEdit
}) => {
  const { colors } = useTheme();
  const scaleAnim = new Animated.Value(1);
  const rotateAnim = new Animated.Value(0);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handleComplete = () => {
    onTaskComplete(task);
  };

  const handleEdit = () => {
    if (onTaskEdit) {
      onTaskEdit(task);
    }
  };

  // Calculate completion percentage
  const completionPercentage = task.completions ? 
    Math.min((task.completions.length / task.points) * 100, 100) : 0;

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          transform: [{ scale: scaleAnim }],
          borderColor: task.isCompleted ? colors.success : colors.borderColor,
          borderWidth: task.isCompleted ? 2 : 1,
        }
      ]}
    >
      {/* Curved top decoration */}
      <View style={[
        styles.curvedTop,
        {
          backgroundColor: task.isCompleted ? colors.success : colors.primary,
        }
      ]} />
      
      {/* Task Content */}
      <View style={styles.content}>
        <View style={styles.taskHeader}>
          <View style={styles.taskInfo}>
            <Text style={[
              styles.taskTitle,
              { color: task.isCompleted ? colors.success : colors.text }
            ]}>
              {task.title}
            </Text>
            {task.description && (
              <Text style={styles.taskDescription} numberOfLines={2}>
                {task.description}
              </Text>
            )}
          </View>
          
          <View style={styles.taskMeta}>
            <View style={styles.pointsBadge}>
              <MaterialIcons name="star" size={16} color={colors.accent} />
              <Text style={styles.pointsText}>{task.points} pts</Text>
            </View>
            
            <Text style={styles.taskType}>
              {task.taskType || 'daily'}
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBar}>
          <View style={styles.progressBackground}>
            <View 
              style={[
                styles.progressFill,
                {
                  width: `${completionPercentage}%`,
                  backgroundColor: task.isCompleted ? colors.success : colors.primary,
                }
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {task.completions?.length || 0}/{task.points} completed
          </Text>
        </View>

        {/* Completion Status */}
        {task.completions && task.completions.length > 0 && (
          <View style={styles.completionInfo}>
            <Text style={styles.completionLabel}>Completed by:</Text>
            <View style={styles.completionUsers}>
              {task.completions.slice(0, 3).map((completion: any, index: number) => (
                <View key={index} style={styles.userBadge}>
                  <Text style={styles.userInitial}>
                    {completion.user.username.charAt(0).toUpperCase()}
                  </Text>
                </View>
              ))}
              {task.completions.length > 3 && (
                <View style={styles.userBadge}>
                  <Text style={styles.userInitial}>
                    +{task.completions.length - 3}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {!task.isCompleted ? (
            <TouchableOpacity
              style={[
                styles.completeButton,
                { backgroundColor: colors.primary }
              ]}
              onPress={handleComplete}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
            >
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.completeText}>Complete</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.completedBadge}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.completedText}>Completed</Text>
            </View>
          )}
          
          {isOwner && onTaskEdit && (
            <TouchableOpacity
              style={[
                styles.editButton,
                { backgroundColor: colors.secondary }
              ]}
              onPress={handleEdit}
            >
              <Ionicons name="pencil" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  curvedTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 8,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    zIndex: 1,
  },
  content: {
    padding: 16,
    paddingTop: 24, // Extra padding for curved top
    zIndex: 2,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  taskInfo: {
    flex: 1,
    marginRight: 12,
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  taskDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  taskMeta: {
    alignItems: 'flex-end',
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  pointsText: {
    fontSize: 12,
    color: '#f39c12',
    fontWeight: '600',
    marginLeft: 4,
  },
  taskType: {
    fontSize: 12,
    color: '#999',
    textTransform: 'capitalize',
  },
  progressBar: {
    marginBottom: 12,
  },
  progressBackground: {
    height: 6,
    backgroundColor: '#f0f0f0',
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
    color: '#666',
    textAlign: 'right',
  },
  completionInfo: {
    marginBottom: 12,
  },
  completionLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  completionUsers: {
    flexDirection: 'row',
    gap: 6,
  },
  userBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInitial: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#495057',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    flex: 1,
    marginRight: 8,
  },
  completeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(40, 167, 69, 0.1)',
    borderRadius: 25,
    flex: 1,
    marginRight: 8,
  },
  completedText: {
    color: '#28a745',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default TaskCard;