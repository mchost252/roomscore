import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Button,
  IconButton,
  Chip,
  Avatar,
  AvatarGroup,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Card,
  CardContent,
  LinearProgress,
  Alert,
  Skeleton,
  Tabs,
  Tab,
  Tooltip,
  Divider
} from '@mui/material';
import {
  ArrowBack,
  Settings,
  ExitToApp,
  ContentCopy,
  CheckCircle,
  RadioButtonUnchecked,
  EmojiEvents,
  Chat,
  People,
  Assignment,
  CalendarToday,
  TrendingUp,
  Delete,
  Edit
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useNavigate, useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import api, { invalidateCache } from '../utils/api';
import ChatDrawer from '../components/ChatDrawer';
import TaskTypeSelector from '../components/TaskTypeSelector';

const RoomDetailPage = () => {
  const { roomId } = useParams();
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [manageTasksOpen, setManageTasksOpen] = useState(false);
  const [taskTypeOpen, setTaskTypeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [disbandDialogOpen, setDisbandDialogOpen] = useState(false);
  const [roomSettings, setRoomSettings] = useState({
    name: '',
    description: '',
    isPublic: false,
    maxMembers: 50
  });
  const [chatMessage, setChatMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [showRoomIntro, setShowRoomIntro] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    points: 10,
    frequency: 'daily',
    category: 'other'
  });
  const [addingTask, setAddingTask] = useState(false);
  const [kickDialogOpen, setKickDialogOpen] = useState(false);
  const [memberToKick, setMemberToKick] = useState(null);
  const chatContainerRef = React.useRef(null);

  useEffect(() => {
    loadRoomDetails();
  }, [roomId]);

  // Auto-scroll to bottom when new messages arrive or tab changes
  useEffect(() => {
    if (chatContainerRef.current && tabValue === 2) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages, tabValue]);

  useEffect(() => {
    if (socket && roomId) {
      // Join room for real-time updates
      socket.emit('room:join', roomId);

      // Listen for task completions
      socket.on('task:completed', (data) => {
        if (data.roomId === roomId) {
          // Add a system message for everyone
          setChatMessages(prev => ([
            ...prev,
            {
              _id: `sys-${Date.now()}`,
              message: `${data.username || 'A member'} completed a task (+${data.points || 0})`,
              messageType: 'system',
              createdAt: new Date().toISOString()
            }
          ]));
          console.log('Socket task:completed event received:', data);
          // Don't update if this user just completed it (already updated locally)
          if (data.userId === user?.id) {
            console.log('Ignoring own completion event');
            return;
          }
          
          // Update tasks for other users
          console.log('Updating tasks for other user:', data.userId);
          setRoom(prev => {
            if (!prev?.tasks) return prev;
            
            const updatedTasks = prev.tasks.map(task => {
              if (task._id === data.taskId) {
                // Check if user is already in completedBy to avoid duplicates
                const alreadyCompleted = task.completedBy?.some(m => m.userId === data.userId);
                
                if (alreadyCompleted) {
                  console.log('User already in completedBy, skipping socket update');
                  return task;
                }
                
                // Add the user to completedBy array
                const newCompletedBy = [
                  ...(task.completedBy || []),
                  {
                    userId: data.userId,
                    username: data.username || 'Unknown',
                    avatar: data.avatar,
                    completedAt: new Date()
                  }
                ];
                console.log('Socket: Adding user to completedBy:', newCompletedBy);
                // Don't set isCompleted to true - that's only for the current user
                // Just update the completedBy array to show who completed it
                return { ...task, completedBy: newCompletedBy };
              }
              return task;
            });
            // Also update members points if provided
            let updatedMembers = prev.members;
            if (data.userId && data.points) {
              updatedMembers = prev.members.map(member => {
                const memberId = member.userId._id || member.userId;
                if (memberId === data.userId) {
                  return { ...member, points: (member.points || 0) + data.points };
                }
                return member;
              });
            }
            return { ...prev, tasks: updatedTasks, members: updatedMembers };
          });
        }
      });

      // Listen for new chat messages
      socket.on('chat:message', (data) => {
        if (data.message.roomId === roomId) {
          // Don't add if it's from current user (already added optimistically)
          const isOwnMessage = data.message.userId?._id === user?.id || data.message.userId === user?.id;
          if (isOwnMessage) {
            console.log('Ignoring own message from socket');
            return;
          }
          setChatMessages(prev => [...prev, data.message]);
        }
      });

      // Listen for task created
      socket.on('task:created', (data) => {
        if (data.roomId === roomId) {
          // Add new task to the list without reload
          setRoom(prev => ({
            ...prev,
            tasks: [...(prev.tasks || []), data.task]
          }));
        }
      });

      // Listen for task deleted
      socket.on('task:deleted', (data) => {
        if (data.roomId === roomId) {
          // Remove task from the list without reload
          setRoom(prev => ({
            ...prev,
            tasks: (prev.tasks || []).filter(task => task._id !== data.taskId)
          }));
        }
      });

      // Listen for task uncompleted
      socket.on('task:uncompleted', (data) => {
        if (data.roomId === roomId) {
          // Don't update if this user just uncompleted it (already updated locally)
          if (data.userId === user?.id) return;
          
          // Remove user from completedBy (don't change isCompleted for other users)
          setRoom(prev => {
            if (!prev?.tasks) return prev;
            const updatedTasks = prev.tasks.map(task => {
              if (task._id === data.taskId) {
                // Remove the user from completedBy array
                const newCompletedBy = (task.completedBy || []).filter(
                  member => member.userId !== data.userId
                );
                // Don't change isCompleted - that's personal to each user
                return { ...task, completedBy: newCompletedBy };
              }
              return task;
            });
            return { ...prev, tasks: updatedTasks };
          });
        }
      });

      // Listen for member joined
      socket.on('member:joined', (data) => {
        if (data.roomId === roomId) {
          console.log('Member joined:', data.user);
          // Add new member to the list without reload
          setRoom(prev => {
            // Check if member already exists
            const memberExists = prev.members.some(m => {
              const memberId = m.userId._id || m.userId;
              return memberId === data.user.id;
            });
            
            if (memberExists) {
              console.log('Member already in list');
              return prev;
            }
            
            return {
              ...prev,
              members: [
                ...prev.members,
                {
                  userId: data.user,
                  role: 'member',
                  points: 0,
                  streak: 0
                }
              ]
            };
          });
          setSuccess(`${data.user.username || data.user.email} joined the room!`);
          setTimeout(() => setSuccess(null), 3000);
        }
      });

      socket.on('member:left', (data) => {
        if (data.roomId === roomId) {
          console.log('Member left:', data.userId);
          // Remove member from the list without reload
          setRoom(prev => ({
            ...prev,
            members: prev.members.filter(m => {
              const memberId = m.userId._id || m.userId;
              return memberId !== data.userId;
            })
          }));
        }
      });

      // Listen for being kicked
      socket.on('member:kicked', (data) => {
        if (data.roomId === roomId && data.userId === user?.id) {
          setError('You have been removed from this room by the owner.');
          setTimeout(() => {
            navigate('/rooms');
          }, 2000);
        } else if (data.roomId === roomId) {
          // Remove member from local state
          setRoom(prev => ({
            ...prev,
            members: prev.members.filter(m => {
              const memberId = m.userId._id || m.userId;
              return memberId !== data.userId;
            })
          }));
          setSuccess(`${data.username} was removed from the room.`);
          setTimeout(() => setSuccess(null), 3000);
        }
      });

      return () => {
        socket.emit('room:leave', roomId);
        socket.off('task:completed');
        socket.off('task:uncompleted');
        socket.off('chat:message');
        socket.off('task:created');
        socket.off('task:deleted');
        socket.off('member:joined');
        socket.off('member:left');
        socket.off('member:kicked');
      };
    }
  }, [socket, roomId]);

  const loadRoomDetails = async () => {
    try {
      setError(null);
      
      // Load all data in parallel for faster page load
      const [roomResponse, tasksResponse, chatResponse] = await Promise.allSettled([
        api.get(`/rooms/${roomId}`),
        api.get(`/rooms/${roomId}/tasks`),
        api.get(`/rooms/${roomId}/chat`)
      ]);
      
      // Handle room data
      if (roomResponse.status === 'fulfilled') {
        const roomData = roomResponse.value.data.room;
        
        // Handle tasks data
        if (tasksResponse.status === 'fulfilled') {
          // Merge room data with tasks that have completion status
          setRoom({
            ...roomData,
            tasks: tasksResponse.value.data.tasks
          });
        } else {
          // Fallback to room tasks without completion status
          console.error('Error loading tasks:', tasksResponse.reason);
          setRoom(roomData);
        }
        
        // Handle chat data
        if (chatResponse.status === 'fulfilled') {
          setChatMessages(chatResponse.value.data.messages || []);
        } else {
          console.error('Error loading chat:', chatResponse.reason);
        }
      } else {
        throw roomResponse.reason;
      }
    } catch (err) {
      console.error('Error loading room:', err);
      setError(err.response?.data?.message || 'Failed to load room details');
    }
  };

  const handleCompleteTask = async (taskId) => {
    try {
      setError(null);
      
      // Find the task to get points value
      const task = room?.tasks?.find(t => t._id === taskId);
      if (!task) return;
      
      // OPTIMISTIC UPDATE - Update UI immediately before API call
      setRoom(prev => ({
        ...prev,
        tasks: prev.tasks.map(t => 
          t._id === taskId 
            ? { ...t, isCompleted: true, completedAt: new Date().toISOString() }
            : t
        )
      }));
      
      // Show success immediately with points and note
      const pts = task.points || 0;
      setSuccess(`+${pts} points added • Room notified`);
      setTimeout(() => setSuccess(null), 3000);
      
      console.log('Completing task:', taskId);
      
      // API call in background (no await - non-blocking)
      api.post(`/rooms/${roomId}/tasks/${taskId}/complete`)
        .then(() => {
          // Invalidate cache for fresh data next time
          invalidateCache(`/rooms/${roomId}`);
          // Refresh room data to get updated leaderboard
          loadRoomDetails();
        })
        .catch(err => {
          // Rollback on error
          console.error('Error completing task:', err);
          setRoom(prev => ({
            ...prev,
            tasks: prev.tasks.map(t => 
              t._id === taskId 
                ? { ...t, isCompleted: false, completedAt: null }
                : t
            )
          }));
          setError('Failed to complete task. Please try again.');
          setTimeout(() => setError(null), 5000);
        });
      
      console.log('Task completed, updating local state');
      // Update local state immediately without reload
      setRoom(prev => {
        if (!prev?.tasks) return prev;
        
        // Check if user is already in completedBy to avoid duplicates
        const task = prev.tasks.find(t => t._id === taskId);
        const alreadyCompleted = task?.completedBy?.some(m => m.userId === user?.id);
        
        if (alreadyCompleted) {
          console.log('User already in completedBy, skipping update');
          return prev;
        }
        
        // Mark task as completed and add to completedBy
        const updatedTasks = prev.tasks.map(t => {
          if (t._id === taskId) {
            const newCompletedBy = [
              ...(t.completedBy || []),
              {
                userId: user?.id,
                username: user?.username || user?.email,
                avatar: user?.avatar,
                completedAt: new Date()
              }
            ];
            console.log('Updating task with completedBy:', newCompletedBy);
            return { ...t, isCompleted: true, completedBy: newCompletedBy };
          }
          return t;
        });
        
        // Add points to current user in members list
        const updatedMembers = prev.members.map(member => {
          const memberId = member.userId._id || member.userId;
          if (memberId === user?.id) {
            return { ...member, points: (member.points || 0) + task.points };
          }
          return member;
        });
        
        return { ...prev, tasks: updatedTasks, members: updatedMembers };
      });
      
      // Socket will notify other users automatically
    } catch (err) {
      console.error('Error completing task:', err);
      setError(err.response?.data?.message || 'Failed to complete task');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleUncompleteTask = async (taskId) => {
    try {
      setError(null);
      
      // Find the task to get points value
      const task = room?.tasks?.find(t => t._id === taskId);
      if (!task) return;
      
      await api.delete(`/rooms/${roomId}/tasks/${taskId}/complete`);
      setSuccess('Task unmarked. Points deducted.');
      setTimeout(() => setSuccess(null), 3000);
      
      // Update local state immediately without reload
      setRoom(prev => {
        if (!prev?.tasks) return prev;
        
        // Unmark the task and remove from completedBy
        const updatedTasks = prev.tasks.map(t => {
          if (t._id === taskId) {
            const newCompletedBy = (t.completedBy || []).filter(
              member => member.userId !== user?.id
            );
            return { ...t, isCompleted: false, completedBy: newCompletedBy };
          }
          return t;
        });
        
        // Deduct points from current user in members list
        const updatedMembers = prev.members.map(member => {
          const memberId = member.userId._id || member.userId;
          if (memberId === user?.id) {
            return { ...member, points: Math.max(0, (member.points || 0) - task.points) };
          }
          return member;
        });
        
        return { ...prev, tasks: updatedTasks, members: updatedMembers };
      });
      
      // Socket will notify other users automatically
    } catch (err) {
      console.error('Error uncompleting task:', err);
      setError(err.response?.data?.message || 'Failed to uncomplete task');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleSendMessageFromDrawer = async (messageText) => {
    if (!messageText.trim()) return;
    
    // OPTIMISTIC UPDATE - Add message to UI immediately with correct user data
    const optimisticMessage = {
      _id: `temp-${Date.now()}`,
      message: messageText,
      userId: {
        _id: user?._id || user?.id,
        username: user?.username || 'You',
        avatar: user?.avatar || user?.profilePicture || null
      },
      createdAt: new Date().toISOString(),
      sending: true // Flag to show sending state
    };
    
    setChatMessages(prev => [...prev, optimisticMessage]);

    // API call in background
    try {
      const response = await api.post(`/rooms/${roomId}/chat`, {
        message: messageText
      });
      
      // Replace optimistic message with real one
      setChatMessages(prev => 
        prev.map(msg => 
          msg._id === optimisticMessage._id 
            ? { ...response.data.message, sending: false }
            : msg
        )
      );
      
      // Invalidate chat cache
      invalidateCache(`/rooms/${roomId}/chat`);
    } catch (err) {
      console.error('Error sending message:', err);
      
      // Remove optimistic message and show error
      setChatMessages(prev => prev.filter(msg => msg._id !== optimisticMessage._id));
      setError('Failed to send message');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim()) return;

    const messageText = chatMessage.trim();
    
    // OPTIMISTIC UPDATE - Add message to UI immediately with correct user data
    const optimisticMessage = {
      _id: `temp-${Date.now()}`,
      message: messageText,
      userId: {
        _id: user?._id || user?.id,
        username: user?.username || 'You',
        avatar: user?.avatar || user?.profilePicture || null
      },
      createdAt: new Date().toISOString(),
      sending: true // Flag to show sending state
    };
    
    setChatMessages(prev => [...prev, optimisticMessage]);
    setChatMessage('');
    
    // Scroll to bottom immediately
    setTimeout(() => {
      chatContainerRef.current?.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }, 0);

    // API call in background
    try {
      const response = await api.post(`/rooms/${roomId}/chat`, {
        message: messageText
      });
      
      // Replace optimistic message with real one
      setChatMessages(prev => 
        prev.map(msg => 
          msg._id === optimisticMessage._id 
            ? { ...response.data.message, sending: false }
            : msg
        )
      );
      
      // Invalidate chat cache
      invalidateCache(`/rooms/${roomId}/chat`);
    } catch (err) {
      console.error('Error sending message:', err);
      
      // Remove optimistic message and show error
      setChatMessages(prev => prev.filter(msg => msg._id !== optimisticMessage._id));
      setError('Failed to send message');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleCopyJoinCode = () => {
    navigator.clipboard.writeText(room.joinCode);
    setSuccess('Join code copied to clipboard!');
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleLeaveRoom = async () => {
    // OPTIMISTIC UPDATE - Close dialog and navigate immediately
    setLeaveDialogOpen(false);
    setSuccess('Leaving room...');
    
    // Navigate immediately for instant feel
    setTimeout(() => {
      navigate('/rooms');
    }, 300);
    
    // API call in background
    try {
      await api.delete(`/rooms/${roomId}/leave`);
      // Invalidate cache
      invalidateCache(`/rooms`);
    } catch (err) {
      console.error('Error leaving room:', err);
      // User already navigated away, so just log the error
    }
  };

  const isOwner = room?.owner._id === user?.id || room?.owner === user?.id;
  const myMember = room?.members?.find(m => 
    m.userId._id === user?.id || m.userId === user?.id
  );

  const isTaskCompletedToday = (task) => {
    // Backend provides isCompleted status from /tasks endpoint
    // This is based on today's TaskCompletion records
    return task.isCompleted === true;
  };

  // Removed auto-refresh that was causing tasks to uncheck
  // Tasks are now kept in sync via socket events only

  // Show loading indicator inline instead of full-page skeleton
  const isLoading = !room;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Room Intro Card (first-time) */}
      {showRoomIntro && (
        <Paper sx={{ p: 2, mb: 2, borderLeft: 4, borderColor: 'info.main' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="subtitle1" fontWeight="bold">
                Welcome to this room 👋
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Complete tasks here to earn points. Your progress is visible to everyone.
              </Typography>
            </Box>
            <Button
              variant="outlined"
              onClick={() => {
                const seenKey = `room_intro_seen_${roomId}`;
                localStorage.setItem(seenKey, 'true');
                setShowRoomIntro(false);
              }}
            >
              Got it
            </Button>
          </Box>
        </Paper>
      )}

      {/* Show loading state inline */}
      {isLoading && (
        <Box sx={{ mt: 4 }}>
          <LinearProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
            Loading room details...
          </Typography>
        </Box>
      )}

      {/* Show error inline */}
      {error && !room && (
        <Alert severity="error" action={
          <Button color="inherit" size="small" onClick={() => navigate('/rooms')}>
            Back to Rooms
          </Button>
        }>
          {error}
        </Alert>
      )}

      {/* Show content as soon as room data is available */}
      {room && (<>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => navigate('/rooms')}>
              <ArrowBack />
            </IconButton>
            <Box>
              <Typography variant="h4" fontWeight="bold">
                {room.name}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                {isOwner && <Chip label="Owner" size="small" color="primary" />}
                <Chip 
                  label={room.isPublic ? 'Public' : 'Private'} 
                  size="small" 
                  color={room.isPublic ? 'success' : 'default'}
                />
                <Chip 
                  icon={<People />}
                  label={`${room.members?.length || 0} members`} 
                  size="small" 
                />
              </Box>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {isOwner && (
              <Tooltip title="Room Settings">
                <IconButton onClick={() => {
                  setRoomSettings({
                    name: room.name,
                    description: room.description || '',
                    isPublic: room.isPublic,
                    maxMembers: room.maxMembers
                  });
                  setSettingsOpen(true);
                }}>
                  <Settings />
                </IconButton>
              </Tooltip>
            )}
            {!isOwner && (
              <Tooltip title="Leave Room">
                <IconButton onClick={() => setLeaveDialogOpen(true)} color="error">
                  <ExitToApp />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        {room.description && (
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            {room.description}
          </Typography>
        )}

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Join Code:
            </Typography>
            <Chip 
              label={room.joinCode} 
              size="small"
              onClick={handleCopyJoinCode}
              onDelete={handleCopyJoinCode}
              deleteIcon={<ContentCopy />}
            />
          </Box>
          {myMember && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <EmojiEvents color="warning" />
              <Typography variant="body2">
                Your Points: <strong>{myMember.points}</strong>
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Main Content */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ mb: 3 }}>
            <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
              <Tab icon={<Assignment />} label="Tasks" iconPosition="start" />
              <Tab icon={<EmojiEvents />} label="Leaderboard" iconPosition="start" />
              <Tab icon={<Chat />} label="Chat" iconPosition="start" />
            </Tabs>
          </Paper>

          {/* Tasks Tab */}
          {tabValue === 0 && (
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" fontWeight="bold">
                  Daily Tasks
                </Typography>
                {isOwner && (
                  <Button 
                    variant="outlined" 
                    size="small" 
                    startIcon={<Edit />}
                    onClick={() => setTaskTypeOpen(true)}
                  >
                    Manage Tasks
                  </Button>
                )}
              </Box>

              {!room.tasks || room.tasks.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <Assignment sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No tasks yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {isOwner ? 'Add tasks to get started' : 'The owner hasn\'t added tasks yet'}
                  </Typography>
                </Box>
              ) : (
                <List>
                  {room.tasks.filter(t => t.isActive).map((task, index) => {
                    const completed = isTaskCompletedToday(task);
                    return (
                      <React.Fragment key={task._id}>
                        {index > 0 && <Divider />}
                        <ListItem
                          sx={{
                            bgcolor: completed ? 'action.selected' : 'transparent',
                            borderRadius: 1,
                            mb: 1
                          }}
                          secondaryAction={
                            <IconButton 
                              edge="end" 
                              onClick={() => completed ? handleUncompleteTask(task._id) : handleCompleteTask(task._id)}
                              sx={{
                                color: completed ? 'success.main' : 'action.active',
                                '&:hover': {
                                  bgcolor: 'action.hover'
                                }
                              }}
                            >
                              {completed ? <CheckCircle sx={{ color: 'success.main' }} /> : <RadioButtonUnchecked />}
                            </IconButton>
                          }
                        >
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                                <Typography 
                                  variant="body1" 
                                  sx={{ 
                                    textDecoration: completed ? 'line-through' : 'none',
                                    fontWeight: completed ? 'normal' : 'bold',
                                    color: 'text.primary'
                                  }}
                                >
                                  {task.title}
                                </Typography>
                                {task.completedBy && task.completedBy.length > 0 && (
                                  <Tooltip 
                                    title={
                                      <Box>
                                        <Typography variant="caption" display="block" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                                          Completed by:
                                        </Typography>
                                        {task.completedBy.map((member, idx) => (
                                          <Typography key={idx} variant="caption" display="block">
                                            • {member.username}
                                          </Typography>
                                        ))}
                                      </Box>
                                    }
                                    arrow
                                  >
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                      <AvatarGroup 
                                        max={3} 
                                        sx={{ 
                                          '& .MuiAvatar-root': { 
                                            width: 20, 
                                            height: 20, 
                                            fontSize: '0.625rem',
                                            border: '1px solid',
                                            borderColor: 'success.main',
                                            bgcolor: 'success.light'
                                          } 
                                        }}
                                      >
                                        {task.completedBy.map((member) => (
                                          <Avatar 
                                            key={member.userId}
                                            src={member.avatar || undefined}
                                          >
                                            {!member.avatar && member.username[0]?.toUpperCase()}
                                          </Avatar>
                                        ))}
                                      </AvatarGroup>
                                      <Typography variant="caption" color="success.main" sx={{ ml: 0.5, fontWeight: 'bold' }}>
                                        {task.completedBy.length}
                                      </Typography>
                                    </Box>
                                  </Tooltip>
                                )}
                              </Box>
                            }
                            secondary={
                              <>
                                {task.description && (
                                  <Typography component="span" variant="body2" color="text.secondary" display="block">
                                    {task.description}
                                  </Typography>
                                )}
                                <Box component="span" sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                                  <Chip 
                                    label={`${task.points} points`} 
                                    size="small" 
                                    color="primary"
                                    variant="outlined"
                                  />
                                  <Chip 
                                    label="Room Task" 
                                    size="small" 
                                    color="secondary"
                                    variant="outlined"
                                  />
                                  {task.frequency && (
                                    <Chip 
                                      label={task.frequency} 
                                      size="small" 
                                      variant="outlined"
                                    />
                                  )}
                                </Box>
                              </>
                            }
                          />
                        </ListItem>
                      </React.Fragment>
                    );
                  })}
                </List>
              )}
            </Paper>
          )}

          {/* Leaderboard Tab */}
          {tabValue === 1 && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Leaderboard
              </Typography>
              <List>
                {room.members
                  ?.sort((a, b) => (b.points || 0) - (a.points || 0))
                  .map((member, index) => (
                    <ListItem key={member.userId._id || member.userId}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: index < 3 ? 'primary.main' : 'default' }}>
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body1" fontWeight="bold">
                              {member.userId.username || member.userId.email}
                            </Typography>
                            {(member.userId._id === user?.id || member.userId === user?.id) && (
                              <Chip label="You" size="small" color="primary" />
                            )}
                          </Box>
                        }
                        secondary={
                          <>
                            <Typography component="span" variant="body2" color="text.secondary">
                              {member.points || 0} points
                            </Typography>
                            {member.streak > 0 && (
                              <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                                🔥 {member.streak} day streak
                              </Typography>
                            )}
                          </>
                        }
                      />
                    </ListItem>
                  ))}
              </List>
            </Paper>
          )}

          {/* Chat Tab */}
          {tabValue === 2 && (
            <Paper sx={{ p: 3, height: 500, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Room Chat
              </Typography>
              <Box 
                ref={chatContainerRef}
                sx={{ 
                  flex: 1, 
                  overflowY: 'auto', 
                  mb: 2, 
                  p: 2, 
                  bgcolor: 'background.default', 
                  borderRadius: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1
                }}
                id="chat-container"
              >
                {chatMessages.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Chat sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="body2" color="text.secondary">
                      No messages yet. Start the conversation!
                    </Typography>
                  </Box>
                ) : (
                  chatMessages.map((msg, index) => {
                    // System messages
                    if (msg.messageType === 'system' || msg.type === 'system') {
                      return (
                        <Box key={index} sx={{ textAlign: 'center', my: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            {msg.message}
                          </Typography>
                        </Box>
                      );
                    }

                    const isOwnMessage = msg.userId?._id === user?.id || msg.userId === user?.id;
                    return (
                      <Box 
                        key={index} 
                        sx={{ 
                          display: 'flex',
                          justifyContent: isOwnMessage ? 'flex-end' : 'flex-start',
                          animation: 'slideIn 0.3s ease-out',
                          '@keyframes slideIn': {
                            from: {
                              opacity: 0,
                              transform: 'translateY(10px)'
                            },
                            to: {
                              opacity: 1,
                              transform: 'translateY(0)'
                            }
                          }
                        }}
                      >
                        <Box sx={{ maxWidth: '70%', display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                          {!isOwnMessage && (
                            <Avatar 
                              src={msg.userId?.avatar || undefined}
                              sx={{ 
                                width: 32, 
                                height: 32, 
                                bgcolor: 'primary.main',
                                fontSize: '0.875rem'
                              }}
                            >
                              {!msg.userId?.avatar && (msg.userId?.username || msg.userId?.email || 'U')[0].toUpperCase()}
                            </Avatar>
                          )}
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                              <Typography variant="caption" fontWeight="bold" color={isOwnMessage ? 'primary' : 'text.primary'}>
                                {isOwnMessage ? 'You' : (msg.userId?.username || msg.userId?.email || 'Unknown')}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {msg.createdAt ? format(parseISO(msg.createdAt), 'h:mm a') : ''}
                              </Typography>
                            </Box>
                            <Paper 
                              sx={{ 
                                p: 1.5, 
                                bgcolor: isOwnMessage ? 'primary.main' : 'background.paper',
                                color: isOwnMessage ? 'white' : 'text.primary',
                                borderRadius: 2,
                                borderTopRightRadius: isOwnMessage ? 0 : 2,
                                borderTopLeftRadius: isOwnMessage ? 2 : 0,
                                wordBreak: 'break-word'
                              }}
                              elevation={1}
                            >
                              <Typography variant="body2">
                                {msg.message}
                              </Typography>
                            </Paper>
                          </Box>
                          {isOwnMessage && (
                            <Avatar 
                              src={user?.avatar || undefined}
                              sx={{ 
                                width: 32, 
                                height: 32, 
                                bgcolor: 'primary.main',
                                fontSize: '0.875rem'
                              }}
                            >
                              {!user?.avatar && (user?.username || user?.email || 'U')[0].toUpperCase()}
                            </Avatar>
                          )}
                        </Box>
                      </Box>
                    );
                  })
                )}
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Type a message..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <Button 
                  variant="contained" 
                  onClick={handleSendMessage}
                  disabled={!chatMessage.trim()}
                >
                  Send
                </Button>
              </Box>
              {/* Chat input hint */}
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                Encourage your teammates or discuss tasks
              </Typography>
            </Paper>
          )}
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          {/* Stats Card */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Your Stats
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Total Points
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {myMember?.points || 0}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Current Streak
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    🔥 {myMember?.streak || 0} days
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Members List */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Members ({room.members?.length || 0})
            </Typography>
            <List dense>
              {room.members?.slice(0, 10).map((member) => {
                const memberId = member.userId._id || member.userId;
                const isRoomOwner = room.owner._id === memberId || room.owner === memberId;
                const isCurrentUser = user?.id === memberId;
                
                return (
                  <ListItem 
                    key={memberId}
                    secondaryAction={
                      isOwner && !isRoomOwner && !isCurrentUser ? (
                        <Tooltip title="Remove member">
                          <IconButton 
                            edge="end" 
                            size="small" 
                            color="error"
                            onClick={() => {
                              setMemberToKick(member);
                              setKickDialogOpen(true);
                            }}
                          >
                            <ExitToApp fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : null
                    }
                  >
                    <ListItemAvatar>
                      <Avatar 
                        src={member.userId.avatar || undefined}
                        sx={{ bgcolor: isRoomOwner ? 'primary.main' : 'default' }}
                      >
                        {!member.userId.avatar && (member.userId.username?.[0]?.toUpperCase() || '?')}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2">
                            {member.userId.username || member.userId.email}
                          </Typography>
                          {isRoomOwner && (
                            <Chip label="Owner" size="small" color="primary" />
                          )}
                          {isCurrentUser && (
                            <Chip label="You" size="small" variant="outlined" />
                          )}
                        </Box>
                      }
                      secondary={`${member.points || 0} points`}
                    />
                  </ListItem>
                );
              })}
            </List>
          </Paper>
        </Grid>
      </Grid>
      </>
      )}

      {/* Leave Room Dialog */}
      <Dialog open={leaveDialogOpen} onClose={() => setLeaveDialogOpen(false)}>
        <DialogTitle>Leave Room?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to leave this room? Your progress will be saved, but you'll need a new invite code to rejoin.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLeaveDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleLeaveRoom} color="error" variant="contained">
            Leave Room
          </Button>
        </DialogActions>
      </Dialog>

      {/* Room Settings Dialog */}
      <Dialog 
        open={settingsOpen} 
        onClose={() => setSettingsOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Room Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Room Name"
              value={roomSettings.name}
              onChange={(e) => setRoomSettings({ ...roomSettings, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Description"
              value={roomSettings.description}
              onChange={(e) => setRoomSettings({ ...roomSettings, description: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />
            <TextField
              label="Max Members"
              type="number"
              value={roomSettings.maxMembers}
              onChange={(e) => setRoomSettings({ ...roomSettings, maxMembers: parseInt(e.target.value) || 50 })}
              fullWidth
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2">Public Room</Typography>
              <Box 
                component="label" 
                sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={roomSettings.isPublic}
                  onChange={(e) => setRoomSettings({ ...roomSettings, isPublic: e.target.checked })}
                  style={{ marginLeft: 8 }}
                />
              </Box>
            </Box>
            
            <Divider sx={{ my: 2 }} />
            
            {/* Danger Zone */}
            <Box>
              <Typography variant="body2" color="error" fontWeight="bold" gutterBottom>
                Danger Zone
              </Typography>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block" sx={{ mb: 1 }}>
                Once you disband this room, all data including tasks, chat history, and member progress will be permanently deleted.
              </Typography>
              <Button 
                variant="outlined" 
                color="error" 
                size="small"
                fullWidth
                onClick={() => {
                  setSettingsOpen(false);
                  setDisbandDialogOpen(true);
                }}
              >
                Disband Room
              </Button>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={async () => {
              try {
                await api.put(`/rooms/${roomId}`, roomSettings);
                setSuccess('Room settings updated!');
                setTimeout(() => setSuccess(null), 3000);
                setSettingsOpen(false);
                loadRoomDetails();
              } catch (err) {
                setError(err.response?.data?.message || 'Failed to update settings');
                setTimeout(() => setError(null), 5000);
              }
            }}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Disband Room Confirmation Dialog */}
      <Dialog 
        open={disbandDialogOpen} 
        onClose={() => setDisbandDialogOpen(false)}
      >
        <DialogTitle>Disband Room?</DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight="bold" gutterBottom>
              This action cannot be undone!
            </Typography>
            <Typography variant="caption">
              All room data, including tasks, chat messages, and member progress will be permanently deleted.
            </Typography>
          </Alert>
          <Typography variant="body2">
            Are you sure you want to disband "<strong>{room?.name}</strong>"?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDisbandDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            color="error"
            onClick={async () => {
              try {
                await api.delete(`/rooms/${roomId}`);
                setSuccess('Room disbanded successfully');
                setTimeout(() => {
                  navigate('/rooms');
                }, 1500);
                setDisbandDialogOpen(false);
              } catch (err) {
                setError(err.response?.data?.message || 'Failed to disband room');
                setTimeout(() => setError(null), 5000);
                setDisbandDialogOpen(false);
              }
            }}
          >
            Yes, Disband Room
          </Button>
        </DialogActions>
      </Dialog>

      {/* Kick Member Dialog */}
      <Dialog open={kickDialogOpen} onClose={() => setKickDialogOpen(false)}>
        <DialogTitle>Remove Member?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove <strong>{memberToKick?.userId.username || memberToKick?.userId.email}</strong> from the room?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            They will be immediately removed and won't be able to rejoin without a new invite code.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setKickDialogOpen(false);
            setMemberToKick(null);
          }}>Cancel</Button>
          <Button 
            onClick={async () => {
              if (!memberToKick) return;
              
              const memberId = memberToKick.userId._id || memberToKick.userId;
              try {
                await api.delete(`/rooms/${roomId}/members/${memberId}`);
                setSuccess('Member removed successfully');
                setTimeout(() => setSuccess(null), 3000);
                setKickDialogOpen(false);
                setMemberToKick(null);
              } catch (err) {
                setError('Failed to remove member');
                setTimeout(() => setError(null), 5000);
              }
            }}
            color="error" 
            variant="contained"
          >
            Remove Member
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manage Tasks Dialog */}
      <Dialog 
        open={manageTasksOpen} 
        onClose={() => {
          setManageTasksOpen(false);
          setNewTask({ title: '', description: '', points: 10, frequency: 'daily', category: 'other' });
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Manage Tasks</DialogTitle>
        <DialogContent>
          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            Add New Task
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
            <TextField
              label="Task Title"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              required
              fullWidth
              error={newTask.title.length > 0 && newTask.title.length < 3}
              helperText={newTask.title.length > 0 && newTask.title.length < 3 ? "Title must be at least 3 characters" : ""}
            />
            <TextField
              label="Description"
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              multiline
              rows={2}
              fullWidth
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Points"
                type="number"
                value={newTask.points}
                onChange={(e) => setNewTask({ ...newTask, points: parseInt(e.target.value) || 0 })}
                required
                sx={{ flex: 1 }}
              />
              <TextField
                select
                label="Frequency"
                value={newTask.frequency}
                onChange={(e) => setNewTask({ ...newTask, frequency: e.target.value })}
                sx={{ flex: 1 }}
                SelectProps={{ native: true }}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="one-time">One Time</option>
              </TextField>
            </Box>
            <Button
              variant="contained"
              onClick={async () => {
                if (!newTask.title.trim()) {
                  setError('Task title is required');
                  setTimeout(() => setError(null), 5000);
                  return;
                }
                if (newTask.title.trim().length < 3) {
                  setError('Task title must be at least 3 characters');
                  setTimeout(() => setError(null), 5000);
                  return;
                }
                try {
                  setAddingTask(true);
                  const response = await api.post(`/rooms/${roomId}/tasks`, newTask);
                  setSuccess('Task added successfully!');
                  setTimeout(() => setSuccess(null), 3000);
                  setNewTask({ title: '', description: '', points: 10, frequency: 'daily', category: 'other' });
                  
                  // Don't add to local state here - socket event will handle it
                  // This prevents duplicate tasks
                  
                  // Close dialog after 1 second
                  setTimeout(() => setManageTasksOpen(false), 1000);
                } catch (err) {
                  setError(err.response?.data?.message || err.response?.data?.errors?.[0]?.message || 'Failed to add task');
                  setTimeout(() => setError(null), 5000);
                } finally {
                  setAddingTask(false);
                }
              }}
              disabled={addingTask || !newTask.title.trim() || newTask.title.trim().length < 3}
            >
              {addingTask ? 'Adding...' : 'Add Task'}
            </Button>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Typography variant="h6" gutterBottom>
            Current Tasks ({room?.tasks?.filter(t => t.isActive).length || 0})
          </Typography>
          {room?.tasks && room.tasks.filter(t => t.isActive).length > 0 ? (
            <List>
              {room.tasks.filter(t => t.isActive).map((task) => (
                <ListItem 
                  key={task._id}
                  secondaryAction={
                    <IconButton edge="end" color="error" onClick={async () => {
                      try {
                        await api.delete(`/rooms/${roomId}/tasks/${task._id}`);
                        setSuccess('Task deleted');
                        setTimeout(() => setSuccess(null), 3000);
                        
                        // Remove task from local state without reload
                        setRoom(prev => ({
                          ...prev,
                          tasks: (prev.tasks || []).filter(t => t._id !== task._id)
                        }));
                        
                        // Socket will notify other users automatically
                      } catch (err) {
                        setError('Failed to delete task');
                        setTimeout(() => setError(null), 5000);
                      }
                    }}>
                      <Delete />
                    </IconButton>
                  }
                >
                  <ListItemText
                    primary={task.title}
                    secondary={`${task.points} points • ${task.frequency}`}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              No tasks yet. Add your first task above!
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setManageTasksOpen(false);
            setNewTask({ title: '', description: '', points: 10, frequency: 'daily', category: 'other' });
          }}>Close</Button>
        </DialogActions>
      </Dialog>
      {/* Floating Chat Button */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1000
        }}
      >
        <Tooltip title="Open Chat" placement="left">
          <Box
            component="button"
            onClick={() => setChatDrawerOpen(true)}
            sx={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              border: 'none',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(102, 126, 234, 0.5)',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'scale(1.1)',
                boxShadow: '0 6px 30px rgba(102, 126, 234, 0.7)',
              },
              '&:active': {
                transform: 'scale(0.95)',
              }
            }}
          >
            <Chat sx={{ fontSize: 32 }} />
          </Box>
        </Tooltip>
      </Box>

      {/* Task Type Selector */}
      <TaskTypeSelector
        open={taskTypeOpen}
        onClose={() => setTaskTypeOpen(false)}
        isOwner={isOwner}
        onSelect={(type) => {
          if (type === 'room') {
            setTaskTypeOpen(false);
            setManageTasksOpen(true);
          } else {
            setTaskTypeOpen(false);
            setSuccess('Personal tasks coming soon');
            setTimeout(() => setSuccess(null), 2500);
          }
        }}
      />

      {/* Chat Drawer */}
      <ChatDrawer
        open={chatDrawerOpen}
        onClose={() => setChatDrawerOpen(false)}
        messages={chatMessages}
        onSendMessage={handleSendMessageFromDrawer}
        currentUser={user}
        roomName={room?.name || 'Room Chat'}
      />
    </Container>
  );
};

export default RoomDetailPage;
