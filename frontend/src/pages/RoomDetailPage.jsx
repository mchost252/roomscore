import React, { useState, useEffect, useCallback } from 'react';
import {
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
  Divider,
  useTheme,
  Switch,
  FormControlLabel
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
  Edit,
  NotificationsActive,
  Star,
  Whatshot,
  Shield,
  HelpOutline
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useNavigate, useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import api, { invalidateCache } from '../utils/api';
import ChatDrawer from '../components/ChatDrawer';
import TaskTypeSelector from '../components/TaskTypeSelector';
import DailyOrbitSummaryModal from '../components/DailyOrbitSummaryModal';
import RoomOnboardingModal from '../components/RoomOnboardingModal';
import { MVPCrownIcon } from '../components/icons/ConstellationIcons';
import { getErrorMessage } from '../utils/errorMessages';

const RoomDetailPage = () => {
  const { roomId } = useParams();
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const theme = useTheme();

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
  const [roomOnboardingOpen, setRoomOnboardingOpen] = useState(false);
  const [canNudge, setCanNudge] = useState(false);
  const [nudging, setNudging] = useState(false);
  const [nudgeStatus, setNudgeStatus] = useState({ hasCompletedTask: false, alreadySentToday: false });
  const [appreciationRemaining, setAppreciationRemaining] = useState(3);
  // Track which appreciations have been sent in the last 24h so UI can disable duplicates
  // Map key: `${toUserId}:${type}` => true
  const [sentAppreciations, setSentAppreciations] = useState(() => new Set());
  // Track last-24h received appreciation counts per user for displaying emojis in chat
  // { [userId]: { star: number, fire: number, shield: number } }
  const [appreciationStatsByUser, setAppreciationStatsByUser] = useState({});
  const [appreciating, setAppreciating] = useState(false);
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
  const [pendingMembers, setPendingMembers] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const chatContainerRef = React.useRef(null);
  
  // Daily Orbit Summary state
  const [orbitSummaryOpen, setOrbitSummaryOpen] = useState(false);
  const [orbitSummary, setOrbitSummary] = useState(null);
  
  // Room MVP state (today's MVP from yesterday's activity)
  const [roomMVP, setRoomMVP] = useState(null);

  // Determine if current user is the room owner
  const isOwner = room?.owner?._id === user?.id || room?.owner === user?.id;

  const { joinRoom, leaveRoom, isUserOnline } = useSocket();

  useEffect(() => {
    loadRoomDetails();
    // Join socket room for real-time updates
    try { joinRoom(roomId); } catch {}
    return () => {
      try { leaveRoom(roomId); } catch {}
    };
  }, [roomId]);

  // Function to refresh nudge status
  const refreshNudgeStatus = useCallback(async () => {
    if (!roomId) return;
    try {
      const response = await api.get(`/nudges/${roomId}/can-send`);
      setCanNudge(response.data.canSend);
      setNudgeStatus({
        hasCompletedTask: response.data.hasCompletedTask,
        alreadySentToday: response.data.alreadySentToday
      });
    } catch (err) {
      console.error('Error checking nudge status:', err);
    }
  }, [roomId]);

  // Load Daily Orbit Summary (shows once per day per room)
  const checkAndShowOrbitSummary = useCallback(async () => {
    if (!roomId || !user?.id) return;
    
    // Check localStorage for last seen date for this room
    const storageKey = `orbit_summary_seen_${roomId}_${user.id}`;
    const today = new Date().toISOString().split('T')[0];
    const lastSeen = localStorage.getItem(storageKey);
    
    // Only show if not seen today
    if (lastSeen === today) {
      return;
    }
    
    try {
      const response = await api.get(`/orbit-summary/${roomId}`);
      if (response.data.success && response.data.summary) {
        // Only show if there were members yesterday (not a brand new room)
        if (response.data.summary.totalMembers > 0) {
          setOrbitSummary(response.data.summary);
          setOrbitSummaryOpen(true);
          // Mark as seen for today
          localStorage.setItem(storageKey, today);
        }
      }
    } catch (err) {
      // Silently fail - this is not critical
      console.log('Could not load orbit summary:', err.message);
    }
  }, [roomId, user?.id]);

  // Show orbit summary when room loads
  useEffect(() => {
    if (room && user?.id) {
      // Small delay to let the room UI render first
      const timer = setTimeout(() => {
        checkAndShowOrbitSummary();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [room, user?.id, checkAndShowOrbitSummary]);

  // Show room onboarding on first ever room visit
  useEffect(() => {
    if (room && user?.id) {
      const onboardingSeen = localStorage.getItem('roomOnboardingSeen');
      if (!onboardingSeen) {
        // Small delay to let the room load first
        const timer = setTimeout(() => {
          setRoomOnboardingOpen(true);
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [room, user?.id]);

  // Fetch today's MVP when room loads
  const fetchRoomMVP = useCallback(async () => {
    if (!roomId) return;
    try {
      const response = await api.get(`/orbit-summary/${roomId}/today-mvp`);
      if (response.data.success && response.data.mvp) {
        setRoomMVP(response.data.mvp);
      }
    } catch (err) {
      // Silently fail - MVP is not critical
      console.log('Could not load room MVP:', err.message);
    }
  }, [roomId]);

  useEffect(() => {
    if (room) {
      fetchRoomMVP();
    }
  }, [room, fetchRoomMVP]);

  // Check if user can send nudge on load
  useEffect(() => {
    if (room) refreshNudgeStatus();
  }, [roomId, room, refreshNudgeStatus]);

  // Handle nudge
  const handleNudge = async () => {
    try {
      setNudging(true);
      await api.post(`/nudges/${roomId}`);
      setSuccess('✨ Nudge sent! Your orbit has been reminded.');
      setCanNudge(false);
      setNudgeStatus(prev => ({ ...prev, alreadySentToday: true }));
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const { icon, message } = getErrorMessage(err, 'nudge');
      setError(`${icon} ${message}`);
      setTimeout(() => setError(null), 5000);
    } finally {
      setNudging(false);
    }
  };

  // Load appreciation state (remaining + sent-in-window + member stats)
  useEffect(() => {
    const loadAppreciations = async () => {
      if (!roomId || !room) return;
      try {
        const [remainingRes, sentRes] = await Promise.all([
          api.get(`/appreciations/${roomId}/remaining`),
          api.get(`/appreciations/${roomId}/sent`)
        ]);

        setAppreciationRemaining(remainingRes.data.remaining);

        // Build sent lookup set for quick disable checks
        const sentSet = new Set();
        (sentRes.data.sent || []).forEach(a => {
          if (a?.toUserId && a?.type) sentSet.add(`${a.toUserId}:${a.type}`);
        });
        setSentAppreciations(sentSet);

        // Load per-member stats (last 24h) so chat badges can render
        // Do in parallel but avoid spamming too much
        const members = room.members || [];
        const userIds = members
          .map(m => m.userId?._id || m.userId)
          .filter(Boolean);

        const statsResults = await Promise.allSettled(
          userIds.map(uid => api.get(`/appreciations/${roomId}/user/${uid}`))
        );

        const statsByUser = {};
        statsResults.forEach((r, idx) => {
          if (r.status === 'fulfilled') {
            statsByUser[userIds[idx]] = r.value.data.stats;
          }
        });
        setAppreciationStatsByUser(statsByUser);
      } catch (err) {
        console.error('Error loading appreciations:', err);
      }
    };

    loadAppreciations();
  }, [roomId, room]);

  // Handle appreciation
  const handleAppreciation = async (toUserId, type) => {
    if (appreciating) return;

    // Prevent duplicate sends client-side
    if (sentAppreciations.has(`${toUserId}:${type}`)) {
      setError('⚠️ You already sent this appreciation to this member in the last 24 hours');
      setTimeout(() => setError(null), 2500);
      return;
    }

    try {
      setAppreciating(true);
      const res = await api.post(`/appreciations/${roomId}`, { toUserId, type });

      // Update remaining
      setAppreciationRemaining(prev => Math.max(0, prev - 1));

      // Disable this type for this user immediately
      setSentAppreciations(prev => {
        const next = new Set(prev);
        next.add(`${toUserId}:${type}`);
        return next;
      });

      // Update stats for recipient
      if (res.data?.stats) {
        setAppreciationStatsByUser(prev => ({
          ...prev,
          [toUserId]: res.data.stats
        }));
      }

      const emoji = type === 'star' ? '⭐' : type === 'fire' ? '🔥' : '🛡️';
      setSuccess(`${emoji} Appreciation sent!`);
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      const { icon, message } = getErrorMessage(err, 'appreciation');
      setError(`${icon} ${message}`);
      setTimeout(() => setError(null), 3000);
    } finally {
      setAppreciating(false);
    }
  };

  // Listen for app foreground event to refresh data (mobile sync)
  useEffect(() => {
    const handleForeground = () => {
      console.log('App came to foreground, refreshing room data...');
      loadRoomDetails(true); // silent refresh
    };
    
    window.addEventListener('app:foreground', handleForeground);
    return () => window.removeEventListener('app:foreground', handleForeground);
  }, [roomId]);

  // Load pending members when room data is available and user is owner
  useEffect(() => {
    if (room && isOwner && room.settings?.requireApproval) {
      loadPendingMembers();
    }
  }, [room?._id, isOwner, room?.settings?.requireApproval]);

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

      // Listen for appreciation events and update badges in realtime
      socket.on('appreciation:given', (data) => {
        if (!data?.toUserId || !data?.stats) return;
        setAppreciationStatsByUser(prev => ({
          ...prev,
          [data.toUserId]: data.stats
        }));
        // If we are the sender, mark as sent for disable logic
        if (data.fromUserId === user?.id) {
          setSentAppreciations(prev => {
            const next = new Set(prev);
            if (data.toUserId && data.type) next.add(`${data.toUserId}:${data.type}`);
            return next;
          });
          setAppreciationRemaining(prev => Math.max(0, prev - 1));
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

      // Listen for join requests (for room owners)
      socket.on('room:joinRequest', (data) => {
        if (data.roomId?.toString() === roomId) {
          setPendingMembers(prev => [...prev, { userId: data.user, requestedAt: new Date() }]);
        }
      });

      return () => {
        socket.emit('room:leave', roomId);
        socket.off('task:completed');
        socket.off('task:uncompleted');
        socket.off('chat:message');
        socket.off('task:created');
        socket.off('task:deleted');
        socket.off('appreciation:given');
        socket.off('member:joined');
        socket.off('member:left');
        socket.off('member:kicked');
        socket.off('room:joinRequest');
      };
    }
  }, [socket, roomId]);

  const loadRoomDetails = useCallback(async (silentRefresh = false) => {
    try {
      if (!silentRefresh) {
        setError(null);
      }
      
      // Load all data in parallel for faster page load
      const [roomResponse, tasksResponse, chatResponse] = await Promise.allSettled([
        api.get(`/rooms/${roomId}`, { headers: { 'x-bypass-cache': true } }),
        api.get(`/rooms/${roomId}/tasks`, { headers: { 'x-bypass-cache': true } }),
        api.get(`/rooms/${roomId}/chat`, { headers: { 'x-bypass-cache': true } })
      ]);
      
      // Handle room data
      if (roomResponse.status === 'fulfilled') {
        const roomData = roomResponse.value.data.room;
        
        // Debug: Check if backend is returning avatar data
        console.log('🔍 Room members data sample:', roomData.members?.[0]);
        
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
      if (!silentRefresh) {
        const { icon, message } = getErrorMessage(err, 'room');
        setError(`${icon} ${message}`);
      }
    }
  }, [roomId]);

  const handleCompleteTask = async (taskId) => {
    try {
      setError(null);
      
      // Find the task to get points value
      const task = room?.tasks?.find(t => t._id === taskId);
      if (!task) return;
      
      // Check if already completed to prevent double-clicks
      if (task.isCompleted) {
        console.log('Task already completed, skipping');
        return;
      }
      
      const pts = task.points || 0;
      
      // OPTIMISTIC UPDATE - Update UI immediately before API call
      // Single consolidated state update to prevent visual glitches
      setRoom(prev => {
        if (!prev?.tasks) return prev;
        
        const updatedTasks = prev.tasks.map(t => {
          if (t._id === taskId) {
            // Add user to completedBy array
            const newCompletedBy = [
              ...(t.completedBy || []),
              {
                userId: user?.id,
                username: user?.username || user?.email,
                avatar: user?.avatar,
                completedAt: new Date()
              }
            ];
            return { 
              ...t, 
              isCompleted: true, 
              completedAt: new Date().toISOString(),
              completedBy: newCompletedBy
            };
          }
          return t;
        });
        
        // Add points to current user in members list
        const updatedMembers = prev.members.map(member => {
          const memberId = member.userId._id || member.userId;
          if (memberId === user?.id) {
            return { ...member, points: (member.points || 0) + pts };
          }
          return member;
        });
        
        return { ...prev, tasks: updatedTasks, members: updatedMembers };
      });
      
      // Show success immediately
      setSuccess(`+${pts} points added • Room notified`);
      setTimeout(() => setSuccess(null), 3000);
      
      // API call in background (no await - non-blocking)
      api.post(`/rooms/${roomId}/tasks/${taskId}/complete`)
        .then(() => {
          // Invalidate cache for fresh data next time
          invalidateCache(`/rooms/${roomId}`);
          invalidateCache('/rooms');
          // Refresh nudge status - user can now nudge after completing a task
          refreshNudgeStatus();
        })
        .catch(err => {
          // Rollback on error
          console.error('Error completing task:', err);
          setRoom(prev => ({
            ...prev,
            tasks: prev.tasks.map(t => 
              t._id === taskId 
                ? { 
                    ...t, 
                    isCompleted: false, 
                    completedAt: null,
                    completedBy: (t.completedBy || []).filter(m => m.userId !== user?.id)
                  }
                : t
            ),
            members: prev.members.map(member => {
              const memberId = member.userId._id || member.userId;
              if (memberId === user?.id) {
                return { ...member, points: Math.max(0, (member.points || 0) - pts) };
              }
              return member;
            })
          }));
          const { icon, message } = getErrorMessage(err, 'task');
          setError(`${icon} ${message}`);
          setTimeout(() => setError(null), 5000);
        });
      
    } catch (err) {
      console.error('Error completing task:', err);
      const { icon, message } = getErrorMessage(err, 'task');
      setError(`${icon} ${message}`);
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleUncompleteTask = async (taskId) => {
    try {
      setError(null);
      
      // Find the task to get points value
      const task = room?.tasks?.find(t => t._id === taskId);
      if (!task) return;
      
      // Check if already uncompleted to prevent double-clicks
      if (!task.isCompleted) {
        console.log('Task already uncompleted, skipping');
        return;
      }
      
      const pts = task.points || 0;
      
      // OPTIMISTIC UPDATE - Single consolidated state update
      setRoom(prev => {
        if (!prev?.tasks) return prev;
        
        const updatedTasks = prev.tasks.map(t => {
          if (t._id === taskId) {
            const newCompletedBy = (t.completedBy || []).filter(
              member => member.userId !== user?.id
            );
            return { ...t, isCompleted: false, completedAt: null, completedBy: newCompletedBy };
          }
          return t;
        });
        
        // Deduct points from current user in members list
        const updatedMembers = prev.members.map(member => {
          const memberId = member.userId._id || member.userId;
          if (memberId === user?.id) {
            return { ...member, points: Math.max(0, (member.points || 0) - pts) };
          }
          return member;
        });
        
        return { ...prev, tasks: updatedTasks, members: updatedMembers };
      });
      
      setSuccess('Task unmarked. Points deducted.');
      setTimeout(() => setSuccess(null), 3000);
      
      // API call in background (non-blocking for faster UI)
      api.delete(`/rooms/${roomId}/tasks/${taskId}/complete`)
        .then(() => {
          // Invalidate cache
          invalidateCache(`/rooms/${roomId}`);
          invalidateCache('/rooms');
        })
        .catch(err => {
          // Rollback on error
          console.error('Error uncompleting task:', err);
          setRoom(prev => ({
            ...prev,
            tasks: prev.tasks.map(t => 
              t._id === taskId 
                ? { 
                    ...t, 
                    isCompleted: true, 
                    completedAt: new Date().toISOString(),
                    completedBy: [
                      ...(t.completedBy || []),
                      { userId: user?.id, username: user?.username || user?.email, avatar: user?.avatar, completedAt: new Date() }
                    ]
                  }
                : t
            ),
            members: prev.members.map(member => {
              const memberId = member.userId._id || member.userId;
              if (memberId === user?.id) {
                return { ...member, points: (member.points || 0) + pts };
              }
              return member;
            })
          }));
          const { icon, message } = getErrorMessage(err, 'task');
          setError(`${icon} ${message}`);
          setTimeout(() => setError(null), 5000);
        });
      
    } catch (err) {
      console.error('Error uncompleting task:', err);
      const { icon, message } = getErrorMessage(err, 'task');
      setError(`${icon} ${message}`);
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleSendMessageFromDrawer = async (messageText, replyTo = null) => {
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
      sending: true,
      // Include reply info in optimistic message
      replyTo: replyTo ? {
        _id: replyTo._id || replyTo.messageId,
        message: replyTo.message,
        userId: replyTo.sender || replyTo.userId
      } : null
    };
    
    setChatMessages(prev => [...prev, optimisticMessage]);

    // API call in background
    try {
      const response = await api.post(`/rooms/${roomId}/chat`, {
        message: messageText,
        replyToId: replyTo?._id || replyTo?.messageId || null,
        replyToText: replyTo?.message || null
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
      const { icon, message } = getErrorMessage(err);
      setError(`${icon} ${message}`);
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
      const { icon, message } = getErrorMessage(err);
      setError(`${icon} ${message}`);
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

  // Load pending members (for room owner)
  const loadPendingMembers = async () => {
    if (!room?.settings?.requireApproval) return;
    
    try {
      setLoadingPending(true);
      const response = await api.get(`/rooms/${roomId}/pending-members`);
      setPendingMembers(response.data.pendingMembers || []);
    } catch (err) {
      console.error('Error loading pending members:', err);
    } finally {
      setLoadingPending(false);
    }
  };

  // Approve pending member
  const handleApproveMember = async (userId) => {
    try {
      setError(null);
      await api.put(`/rooms/${roomId}/approve-member/${userId}`);
      setSuccess('Member approved!');
      setTimeout(() => setSuccess(null), 3000);
      
      // Remove from pending list (handle both _id and id formats)
      setPendingMembers(prev => prev.filter(m => {
        const memberId = typeof m.userId === 'object' 
          ? (m.userId._id || m.userId.id) 
          : m.userId;
        return memberId !== userId;
      }));
      
      // Reload room to get updated members
      loadRoomDetails();
    } catch (err) {
      console.error('Error approving member:', err);
      const { icon, message } = getErrorMessage(err);
      setError(`${icon} ${message}`);
      setTimeout(() => setError(null), 5000);
    }
  };

  // Reject pending member
  const handleRejectMember = async (userId) => {
    try {
      setError(null);
      await api.put(`/rooms/${roomId}/reject-member/${userId}`);
      setSuccess('Request declined');
      setTimeout(() => setSuccess(null), 3000);
      
      // Remove from pending list (handle both _id and id formats)
      setPendingMembers(prev => prev.filter(m => {
        const memberId = typeof m.userId === 'object' 
          ? (m.userId._id || m.userId.id) 
          : m.userId;
        return memberId !== userId;
      }));
    } catch (err) {
      console.error('Error rejecting member:', err);
      const { icon, message } = getErrorMessage(err);
      setError(`${icon} ${message}`);
      setTimeout(() => setError(null), 5000);
    }
  };

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
    <Box sx={{ 
      width: '100%', 
      maxWidth: '100%', 
      overflowX: 'hidden',
      px: { xs: 1.5, sm: 2, md: 3 },
      py: { xs: 2, md: 4 },
      boxSizing: 'border-box',
    }}>
      {/* Room Intro Card (first-time) */}
      {showRoomIntro && (
        <Paper sx={{ p: { xs: 1.5, md: 2 }, mb: 2, borderLeft: 4, borderColor: 'info.main' }}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 1 }}>
            <Box>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ fontSize: { xs: '0.9rem', md: '1rem' } }}>
                Welcome to this room 👋
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                Complete tasks here to earn points. Your progress is visible to everyone.
              </Typography>
            </Box>
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                const seenKey = `room_intro_seen_${roomId}`;
                localStorage.setItem(seenKey, 'true');
                setShowRoomIntro(false);
              }}
              sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}
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
      <Paper 
        sx={{ 
          p: { xs: 2, md: 3 }, 
          mb: { xs: 2, md: 3 },
          background: (theme) => theme.palette.mode === 'dark'
            ? 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(99,102,241,0.08) 50%, rgba(139,92,246,0.08) 100%)'
            : 'linear-gradient(135deg, rgba(59,130,246,0.05) 0%, rgba(99,102,241,0.05) 50%, rgba(139,92,246,0.05) 100%)',
          borderTop: (theme) => theme.palette.mode === 'dark'
            ? '2px solid rgba(96,165,250,0.3)'
            : '2px solid rgba(59,130,246,0.2)'
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 2 }, flex: 1, minWidth: 0 }}>
            <IconButton onClick={() => navigate('/rooms')} size="small">
              <ArrowBack sx={{ fontSize: { xs: 20, md: 24 } }} />
            </IconButton>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography 
                variant="h4" 
                fontWeight="bold" 
                sx={{ 
                  fontSize: { xs: '1.2rem', md: '2.125rem' }, 
                  wordBreak: 'break-word',
                  background: (theme) => theme.palette.mode === 'dark'
                    ? 'linear-gradient(135deg, #60A5FA 0%, #818CF8 50%, #A78BFA 100%)'
                    : 'linear-gradient(135deg, #3B82F6 0%, #6366F1 50%, #8B5CF6 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}
              >
                {room.name}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                {isOwner && <Chip label="Owner" size="small" color="primary" sx={{ height: { xs: 20, md: 24 }, fontSize: { xs: '0.65rem', md: '0.75rem' } }} />}
                <Chip 
                  label={room.isPublic ? 'Public' : 'Private'} 
                  size="small" 
                  color={room.isPublic ? 'success' : 'default'}
                  sx={{ height: { xs: 20, md: 24 }, fontSize: { xs: '0.65rem', md: '0.75rem' } }}
                />
                <Chip 
                  icon={<People sx={{ fontSize: { xs: 12, md: 16 } }} />}
                  label={`${room.members?.length || 0}`} 
                  size="small"
                  sx={{ height: { xs: 20, md: 24 }, fontSize: { xs: '0.65rem', md: '0.75rem' } }}
                />
                {room.roomStreak > 0 && (
                  <Tooltip title={`Orbit stable for ${room.roomStreak} day${room.roomStreak > 1 ? 's' : ''}${room.longestRoomStreak > room.roomStreak ? ` (Best: ${room.longestRoomStreak})` : ''}`}>
                    <Chip 
                      label={`🌟 ${room.roomStreak} day${room.roomStreak > 1 ? 's' : ''}`}
                      size="small"
                      color="warning"
                      sx={{ height: { xs: 20, md: 24 }, fontSize: { xs: '0.65rem', md: '0.75rem' } }}
                    />
                  </Tooltip>
                )}
                {/* Help icon to re-open room guide */}
                <Tooltip title="Room Guide">
                  <IconButton 
                    size="small" 
                    onClick={() => setRoomOnboardingOpen(true)}
                    sx={{ 
                      width: { xs: 20, md: 24 }, 
                      height: { xs: 20, md: 24 },
                      opacity: 0.6,
                      '&:hover': { opacity: 1 }
                    }}
                  >
                    <HelpOutline sx={{ fontSize: { xs: 14, md: 16 } }} />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {isOwner && (
              <Tooltip title="Room Settings">
                <IconButton size="small" onClick={() => {
                  setRoomSettings({
                    name: room.name,
                    description: room.description || '',
                    isPublic: room.isPublic ?? !room.isPrivate,
                    maxMembers: room.maxMembers,
                    chatRetentionDays: room.chatRetentionDays ?? 5
                  });
                  setSettingsOpen(true);
                }}>
                  <Settings sx={{ fontSize: { xs: 20, md: 24 } }} />
                </IconButton>
              </Tooltip>
            )}
            {!isOwner && (
              <Tooltip title="Leave Room">
                <IconButton size="small" onClick={() => setLeaveDialogOpen(true)} color="error">
                  <ExitToApp sx={{ fontSize: { xs: 20, md: 24 } }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        {room.description && (
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2, fontSize: { xs: '0.8rem', md: '1rem' } }}>
            {room.description}
          </Typography>
        )}

        {/* Room Expiry Info */}
        {(room.endDate || room.expiresAt) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, p: 1, bgcolor: 'warning.main', borderRadius: 1, opacity: 0.9 }}>
            <CalendarToday sx={{ fontSize: { xs: 16, md: 20 }, color: 'warning.contrastText' }} />
            <Typography variant="body2" sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' }, color: 'warning.contrastText' }}>
              Room expires: {format(parseISO(room.endDate || room.expiresAt), 'MMM d, yyyy')} ({Math.max(0, Math.ceil((new Date(room.endDate || room.expiresAt) - new Date()) / (1000 * 60 * 60 * 24)))} days left)
            </Typography>
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: { xs: 1, md: 2 }, alignItems: 'center', flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' } }}>
              Join Code:
            </Typography>
            <Chip 
              label={room.joinCode} 
              size="small"
              onClick={handleCopyJoinCode}
              onDelete={handleCopyJoinCode}
              deleteIcon={<ContentCopy sx={{ fontSize: { xs: 14, md: 18 } }} />}
              sx={{ height: { xs: 22, md: 28 }, fontSize: { xs: '0.7rem', md: '0.875rem' } }}
            />
          </Box>
          {myMember && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <EmojiEvents color="warning" sx={{ fontSize: { xs: 18, md: 24 } }} />
              <Typography variant="body2" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                Your Points: <strong>{myMember.points}</strong>
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: { xs: 2, md: 3 }, fontSize: { xs: '0.75rem', md: '0.875rem' } }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: { xs: 2, md: 3 }, fontSize: { xs: '0.75rem', md: '0.875rem' } }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Grid container spacing={{ xs: 2, md: 3 }}>
        {/* Main Content */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ mb: { xs: 2, md: 3 } }}>
            <Tabs 
              value={tabValue} 
              onChange={(e, newValue) => setTabValue(newValue)}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={{
                '& .MuiTab-root': {
                  minHeight: { xs: 48, md: 64 },
                  fontSize: { xs: '0.7rem', md: '0.875rem' },
                  px: { xs: 1, md: 2 },
                },
              }}
            >
              <Tab icon={<Assignment sx={{ fontSize: { xs: 18, md: 24 } }} />} label="Tasks" iconPosition="start" />
              <Tab icon={<EmojiEvents sx={{ fontSize: { xs: 18, md: 24 } }} />} label="Leaderboard" iconPosition="start" />
              <Tab
                icon={<Chat sx={{ fontSize: { xs: 18, md: 24 } }} />}
                label="Chat"
                iconPosition="start"
                onClick={(e) => {
                  if (tabValue === 2) {
                    e.stopPropagation();
                    setChatDrawerOpen(true);
                  }
                }}
                sx={{
                  cursor: tabValue === 2 ? 'pointer' : 'default',
                  '&:hover': tabValue === 2 ? { bgcolor: 'action.hover' } : {}
                }}
              />
            </Tabs>
          </Paper>

          {/* Tasks Tab */}
          {tabValue === 0 && (
            <Paper sx={{ p: { xs: 2, md: 3 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: { xs: 2, md: 3 } }}>
                <Typography variant="h6" fontWeight="bold" sx={{ fontSize: { xs: '1rem', md: '1.25rem' } }}>
                  Daily Tasks
                </Typography>
                {isOwner && (
                  <Button 
                    variant="outlined" 
                    size="small" 
                    startIcon={<Edit sx={{ fontSize: { xs: 14, md: 18 } }} />}
                    onClick={() => setTaskTypeOpen(true)}
                    sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' } }}
                  >
                    Manage
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
            <Paper sx={{ p: { xs: 2, md: 3 } }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ fontSize: { xs: '1rem', md: '1.25rem' } }}>
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
                            {/* MVP Crown */}
                            {roomMVP?.userId === (member.userId._id || member.userId) && (
                              <Tooltip title="Room MVP — consistency & contribution">
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <MVPCrownIcon size={20} glowing animated />
                                </Box>
                              </Tooltip>
                            )}
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
            <Paper sx={{ p: { xs: 2, md: 3 }, height: { xs: 400, md: 500 }, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ fontSize: { xs: '1rem', md: '1.25rem' } }}>
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
                  gap: 1,
                  cursor: 'pointer'
                }}
                id="chat-container"
                onDoubleClick={() => setChatDrawerOpen(true)}
                title="Double-click to open full chat"
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
                    const msgUserId = msg.userId?._id || msg.userId;
                    const prevUserId = chatMessages[index - 1]?.userId?._id || chatMessages[index - 1]?.userId;
                    const showAvatar = !isOwnMessage && (index === 0 || prevUserId !== msgUserId);
                    
                    return (
                      <Box 
                        key={index} 
                        sx={{ 
                          display: 'flex',
                          flexDirection: isOwnMessage ? 'row-reverse' : 'row',
                          gap: 1,
                          alignItems: 'flex-end',
                          animation: msg.sending ? 'pulse 1.5s infinite' : 'slideIn 0.3s ease-out',
                          '@keyframes slideIn': {
                            from: { opacity: 0, transform: 'translateY(10px)' },
                            to: { opacity: 1, transform: 'translateY(0)' }
                          },
                          '@keyframes pulse': {
                            '0%, 100%': { opacity: 1 },
                            '50%': { opacity: 0.7 }
                          }
                        }}
                      >
                        {/* Avatar */}
                        {showAvatar && !isOwnMessage && (
                          <Avatar 
                            src={msg.userId?.avatar || undefined}
                            sx={{ width: 28, height: 28, fontSize: '0.75rem' }}
                          >
                            {!msg.userId?.avatar && (msg.userId?.username || msg.userId?.email || 'U')[0].toUpperCase()}
                          </Avatar>
                        )}
                        {!showAvatar && !isOwnMessage && <Box sx={{ width: 28 }} />}

                        {/* Message Bubble */}
                        <Box sx={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', alignItems: isOwnMessage ? 'flex-end' : 'flex-start' }}>
                          {/* Sender Name with badges */}
                          {(showAvatar || isOwnMessage) && (
                            <Typography variant="caption" color="text.secondary" sx={{ ml: isOwnMessage ? 0 : 1, mb: 0.5 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                                <span>{isOwnMessage ? 'You' : (msg.userId?.username || msg.userId?.email || 'Unknown')}</span>
                                {(() => {
                                  const uid = msg.userId?._id || msg.userId;
                                  const s = appreciationStatsByUser?.[uid];
                                  if (!s) return null;
                                  const mapping = [
                                    { emoji: '⭐', count: s.star || 0 },
                                    { emoji: '🔥', count: s.fire || 0 },
                                    { emoji: '🛡️', count: s.shield || 0 }
                                  ].filter(x => x.count > 0);
                                  return mapping.map((x, idx) => (
                                    <Chip
                                      key={`${uid}-${x.emoji}-${idx}`}
                                      label={x.count === 1 ? x.emoji : `${x.emoji}${x.count}`}
                                      size="small"
                                      variant="outlined"
                                      sx={{ height: 18, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.75 } }}
                                    />
                                  ));
                                })()}
                              </Box>
                            </Typography>
                          )}

                          {/* Reply preview */}
                          {msg.replyTo && (
                            <Box sx={{
                              mb: 0.5,
                              px: 1,
                              py: 0.5,
                              borderLeft: 3,
                              borderColor: 'primary.light',
                              bgcolor: isOwnMessage ? 'rgba(255,255,255,0.1)' : 'action.hover',
                              borderRadius: 1,
                              maxWidth: '100%'
                            }}>
                              <Typography variant="caption" color="text.secondary" noWrap>
                                {msg.replyTo?.message}
                              </Typography>
                            </Box>
                          )}

                          {/* WhatsApp-style bubble */}
                          <Box
                            sx={{
                              position: 'relative',
                              p: '10px 12px',
                              pb: '8px',
                              bgcolor: isOwnMessage 
                                ? theme.palette.mode === 'dark' ? '#005c4b' : '#dcf8c6'
                                : theme.palette.mode === 'dark' ? '#1f2c34' : '#ffffff',
                              color: isOwnMessage 
                                ? theme.palette.mode === 'dark' ? '#e9edef' : '#111b21'
                                : theme.palette.mode === 'dark' ? '#e9edef' : '#111b21',
                              borderRadius: isOwnMessage ? '8px 8px 0 8px' : '8px 8px 8px 0',
                              wordBreak: 'break-word',
                              boxShadow: '0 1px 0.5px rgba(0,0,0,0.13)',
                              minWidth: '60px',
                              maxWidth: '100%',
                              '&::after': {
                                content: '""',
                                position: 'absolute',
                                bottom: 0,
                                width: 0,
                                height: 0,
                                border: '8px solid transparent',
                                ...(isOwnMessage ? {
                                  right: '-8px',
                                  borderLeftColor: theme.palette.mode === 'dark' ? '#005c4b' : '#dcf8c6',
                                  borderBottom: 'none',
                                  borderRight: 'none',
                                } : {
                                  left: '-8px',
                                  borderRightColor: theme.palette.mode === 'dark' ? '#1f2c34' : '#ffffff',
                                  borderBottom: 'none',
                                  borderLeft: 'none',
                                }),
                              },
                            }}
                          >
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontSize: '14.2px', lineHeight: 1.4 }}>
                              {msg.message}
                            </Typography>
                            {/* Inline timestamp like WhatsApp */}
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                              <Typography
                                variant="caption"
                                sx={{ 
                                  fontSize: '11px',
                                  color: isOwnMessage 
                                    ? theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.45)'
                                    : 'rgba(0,0,0,0.45)',
                                  lineHeight: 1,
                                }}
                              >
                                {msg.createdAt ? format(parseISO(msg.createdAt), 'h:mm a') : ''}
                              </Typography>
                              {isOwnMessage && (
                                <Box sx={{ fontSize: '14px', color: msg.sending ? 'inherit' : (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.35)'), lineHeight: 1 }}>
                                  {msg.sending ? '🕐' : '✓✓'}
                                </Box>
                              )}
                            </Box>
                          </Box>
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
          {/* Pending Members (Owner Only) */}
          {isOwner && room?.settings?.requireApproval && pendingMembers.length > 0 && (
            <Paper sx={{ p: 2, mb: 2, borderLeft: 4, borderColor: 'warning.main' }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <People color="warning" />
                Pending Requests
                <Chip label={pendingMembers.length} size="small" color="warning" />
              </Typography>
              <List dense>
                {pendingMembers.map((pending) => (
                  <ListItem 
                    key={pending.userId?._id || pending.userId}
                    sx={{ px: 0 }}
                    secondaryAction={
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Approve">
                          <IconButton 
                            size="small" 
                            color="success"
                            onClick={() => {
                              // userId can be object with _id (from API) or id (from socket) or a string
                              const uid = typeof pending.userId === 'object' 
                                ? (pending.userId._id || pending.userId.id) 
                                : pending.userId;
                              handleApproveMember(uid);
                            }}
                          >
                            <CheckCircle fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Reject">
                          <IconButton 
                            size="small" 
                            color="error"
                            onClick={() => {
                              // userId can be object with _id (from API) or id (from socket) or a string
                              const uid = typeof pending.userId === 'object' 
                                ? (pending.userId._id || pending.userId.id) 
                                : pending.userId;
                              handleRejectMember(uid);
                            }}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    }
                  >
                    <ListItemAvatar>
                      <Avatar 
                        src={pending.userId?.avatar || undefined}
                        sx={{ width: 32, height: 32 }}
                      >
                        {!pending.userId?.avatar && (pending.userId?.username || 'U')[0]?.toUpperCase()}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText 
                      primary={pending.userId?.username || pending.userId?.email || 'Unknown'}
                      secondary={pending.requestedAt ? `Requested ${format(new Date(pending.requestedAt), 'MMM d')}` : 'Pending'}
                      primaryTypographyProps={{ variant: 'body2', fontWeight: 'medium' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                ))}
              </List>
              {loadingPending && <LinearProgress sx={{ mt: 1 }} />}
            </Paper>
          )}

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
                
                // Debug avatar
                if (!member.userId.avatar) {
                  console.log('⚠️ No avatar for:', member.userId.username);
                } else {
                  console.log('✅ Avatar found for:', member.userId.username, member.userId.avatar);
                }
                
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
                      <Box sx={{ position: 'relative' }}>
                        <Avatar 
                          src={member.userId.avatar || undefined}
                          sx={{ bgcolor: isRoomOwner ? 'primary.main' : 'default' }}
                        >
                          {!member.userId.avatar && (member.userId.username?.[0]?.toUpperCase() || '?')}
                        </Avatar>
                        <Box sx={{
                          position: 'absolute',
                          bottom: -1,
                          right: -1,
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          bgcolor: isUserOnline(memberId) ? '#44b700' : 'grey.400',
                          border: '2px solid',
                          borderColor: 'background.paper'
                        }} />
                      </Box>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2">
                            {member.userId.username || member.userId.email}
                          </Typography>
                          {/* MVP Crown */}
                          {roomMVP?.userId === (member.userId._id || member.userId) && (
                            <Tooltip title="Room MVP — consistency & contribution">
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <MVPCrownIcon size={18} glowing />
                              </Box>
                            </Tooltip>
                          )}
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

           <TextField
             label="Chat retention (days)"
             type="number"
             inputProps={{ min: 1, max: 5 }}
             helperText="Room chat history will be kept for this many days (1–5). Older messages are deleted."
             value={roomSettings.chatRetentionDays === '' ? '' : (roomSettings.chatRetentionDays ?? room?.chatRetentionDays ?? 5)}
             onChange={(e) => {
               const val = e.target.value;
               if (val === '') {
                 setRoomSettings({ ...roomSettings, chatRetentionDays: '' });
               } else {
                 setRoomSettings({ ...roomSettings, chatRetentionDays: parseInt(val) || '' });
               }
             }}
             onBlur={(e) => {
               const val = parseInt(e.target.value);
               if (!val || val < 1) {
                 setRoomSettings({ ...roomSettings, chatRetentionDays: 1 });
               } else if (val > 5) {
                 setRoomSettings({ ...roomSettings, chatRetentionDays: 5 });
               }
             }}
             error={roomSettings.chatRetentionDays !== '' && (roomSettings.chatRetentionDays < 1 || roomSettings.chatRetentionDays > 5)}
             fullWidth
           />
            <FormControlLabel
              control={
                <Switch
                  checked={roomSettings.isPublic}
                  onChange={(e) => setRoomSettings({ ...roomSettings, isPublic: e.target.checked })}
                />
              }
              label={
                <Box>
                  <Typography variant="body1">Public Room</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {roomSettings.isPublic 
                      ? 'Anyone can discover and join this room' 
                      : 'Users need a join code to access this room'}
                  </Typography>
                </Box>
              }
            />
            
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
                // Update basic room info
                await api.put(`/rooms/${roomId}`, {
                  name: roomSettings.name,
                  description: roomSettings.description,
                  isPublic: roomSettings.isPublic,
                  maxMembers: roomSettings.maxMembers
                });

                // Update room settings (includes chat retention)
                await api.put(`/rooms/${roomId}/settings`, {
                  isPublic: roomSettings.isPublic,
                  chatRetentionDays: roomSettings.chatRetentionDays
                });

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
        roomMembers={room?.members || []}
        onSendAppreciation={handleAppreciation}
        appreciationRemaining={appreciationRemaining}
        sentAppreciations={sentAppreciations}
        appreciationStatsByUser={appreciationStatsByUser}
        onSendNudge={handleNudge}
        canNudge={canNudge}
        nudgeStatus={nudgeStatus}
        nudging={nudging}
      />
      
      {/* Daily Orbit Summary Modal */}
      <DailyOrbitSummaryModal
        open={orbitSummaryOpen}
        onClose={() => setOrbitSummaryOpen(false)}
        summary={orbitSummary}
        roomName={room?.name}
      />

      {/* Room Onboarding Modal */}
      <RoomOnboardingModal
        open={roomOnboardingOpen}
        onClose={() => setRoomOnboardingOpen(false)}
        isAdmin={isOwner}
      />
    </Box>
  );
};

export default RoomDetailPage;
