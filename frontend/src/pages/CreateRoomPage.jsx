import React, { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Alert,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  Divider
} from '@mui/material';
import {
  ArrowBack,
  Add,
  Delete,
  EmojiEvents,
  Group,
  Assignment
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const CreateRoomPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Room details
  const [roomData, setRoomData] = useState({
    name: '',
    description: '',
    isPublic: false,
    maxMembers: 20
  });

  // Tasks
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    points: 10,
    frequency: 'daily'
  });

  const steps = ['Room Details', 'Add Tasks', 'Review'];

  const handleRoomDataChange = (field, value) => {
    setRoomData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddTask = () => {
    if (!newTask.title.trim()) {
      setError('Task title is required');
      return;
    }

    setTasks(prev => [...prev, { ...newTask, id: Date.now() }]);
    setNewTask({
      title: '',
      description: '',
      points: 10,
      frequency: 'daily'
    });
    setError(null);
  };

  const handleRemoveTask = (taskId) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const handleNext = () => {
    if (activeStep === 0) {
      // Validate room details
      if (!roomData.name.trim()) {
        setError('Room name is required');
        return;
      }
      if (roomData.maxMembers < 2 || roomData.maxMembers > 100) {
        setError('Max members must be between 2 and 100');
        return;
      }
    }

    if (activeStep === 1) {
      // Validate tasks
      if (tasks.length === 0) {
        setError('Please add at least one task');
        return;
      }
    }

    setError(null);
    setActiveStep(prev => prev + 1);
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
    setError(null);
  };

  const handleCreateRoom = async () => {
    try {
      setLoading(true);
      setError(null);

      // Step 1: Create the room
      const roomPayload = {
        name: roomData.name.trim(),
        description: roomData.description.trim(),
        isPublic: roomData.isPublic,
        maxMembers: roomData.maxMembers
      };

      const roomResponse = await api.post('/rooms', roomPayload);
      const roomId = roomResponse.data.room._id;

      // Step 2: Add tasks to the room
      if (tasks.length > 0) {
        for (const task of tasks) {
          const taskPayload = {
            title: task.title,
            description: task.description || '',
            points: task.points,
            frequency: task.frequency,
            category: 'other'
          };
          
          try {
            await api.post(`/rooms/${roomId}/tasks`, taskPayload);
          } catch (taskErr) {
            console.error('Error adding task:', taskErr);
            // Continue adding other tasks even if one fails
          }
        }
      }
      
      // Navigate to the newly created room
      navigate(`/rooms/${roomId}`);
    } catch (err) {
      console.error('Error creating room:', err);
      const errorMessage = err.response?.data?.errors 
        ? err.response.data.errors.map(e => e.message).join(', ')
        : err.response?.data?.message || 'Failed to create room';
      setError(errorMessage);
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              Room Information
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Create a space for tracking habits together
            </Typography>

            <TextField
              fullWidth
              label="Room Name"
              value={roomData.name}
              onChange={(e) => handleRoomDataChange('name', e.target.value)}
              placeholder="e.g., Morning Routine Champions"
              sx={{ mb: 3 }}
              required
            />

            <TextField
              fullWidth
              label="Description"
              value={roomData.description}
              onChange={(e) => handleRoomDataChange('description', e.target.value)}
              placeholder="What is this room about?"
              multiline
              rows={3}
              sx={{ mb: 3 }}
            />

            <TextField
              fullWidth
              type="number"
              label="Max Members"
              value={roomData.maxMembers}
              onChange={(e) => handleRoomDataChange('maxMembers', parseInt(e.target.value) || 20)}
              inputProps={{ min: 2, max: 100 }}
              sx={{ mb: 3 }}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={roomData.isPublic}
                  onChange={(e) => handleRoomDataChange('isPublic', e.target.checked)}
                />
              }
              label={
                <Box>
                  <Typography variant="body1">Public Room</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {roomData.isPublic 
                      ? 'Anyone can discover and join this room' 
                      : 'Users need a join code to access this room'}
                  </Typography>
                </Box>
              }
            />
          </Box>
        );

      case 1:
        return (
          <Box>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              Daily Tasks
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Add tasks that members will complete daily
            </Typography>

            {/* Add Task Form */}
            <Card variant="outlined" sx={{ mb: 3, p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Add New Task
              </Typography>
              
              <TextField
                fullWidth
                size="small"
                label="Task Title"
                value={newTask.title}
                onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., 30 minutes of exercise"
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                size="small"
                label="Description (optional)"
                value={newTask.description}
                onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Additional details..."
                multiline
                rows={2}
                sx={{ mb: 2 }}
              />

              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <TextField
                  size="small"
                  type="number"
                  label="Points"
                  value={newTask.points}
                  onChange={(e) => setNewTask(prev => ({ ...prev, points: parseInt(e.target.value) || 10 }))}
                  inputProps={{ min: 1, max: 100 }}
                  sx={{ flex: 1 }}
                />
                <TextField
                  size="small"
                  select
                  label="Frequency"
                  value={newTask.frequency}
                  onChange={(e) => setNewTask(prev => ({ ...prev, frequency: e.target.value }))}
                  SelectProps={{ native: true }}
                  sx={{ flex: 1 }}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="custom">Custom</option>
                </TextField>
              </Box>

              <Button
                fullWidth
                variant="contained"
                startIcon={<Add />}
                onClick={handleAddTask}
                disabled={!newTask.title.trim()}
              >
                Add Task
              </Button>
            </Card>

            {/* Tasks List */}
            {tasks.length > 0 ? (
              <Paper variant="outlined">
                <List>
                  {tasks.map((task, index) => (
                    <React.Fragment key={task.id}>
                      {index > 0 && <Divider />}
                      <ListItem
                        secondaryAction={
                          <IconButton edge="end" onClick={() => handleRemoveTask(task.id)} color="error">
                            <Delete />
                          </IconButton>
                        }
                      >
                        <ListItemText
                          primary={
                            <Typography variant="body1" fontWeight="bold">
                              {task.title}
                            </Typography>
                          }
                          secondary={
                            <>
                              {task.description && (
                                <Typography component="span" variant="body2" color="text.secondary" display="block">
                                  {task.description}
                                </Typography>
                              )}
                              <Box component="span" sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                                <Typography component="span" variant="caption" sx={{ bgcolor: 'primary.main', color: 'white', px: 1, py: 0.5, borderRadius: 1 }}>
                                  {task.points} points
                                </Typography>
                                <Typography component="span" variant="caption" sx={{ bgcolor: 'action.selected', px: 1, py: 0.5, borderRadius: 1 }}>
                                  {task.frequency}
                                </Typography>
                              </Box>
                            </>
                          }
                        />
                      </ListItem>
                    </React.Fragment>
                  ))}
                </List>
              </Paper>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Assignment sx={{ fontSize: 60, color: 'text.secondary', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  No tasks added yet. Add your first task above.
                </Typography>
              </Box>
            )}
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              Review & Create
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Review your room details before creating
            </Typography>

            {/* Room Details Review */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Group color="primary" />
                  <Typography variant="h6" fontWeight="bold">
                    {roomData.name}
                  </Typography>
                </Box>
                
                {roomData.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {roomData.description}
                  </Typography>
                )}

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Typography variant="body2">
                    <strong>Max Members:</strong> {roomData.maxMembers}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Visibility:</strong> {roomData.isPublic ? 'Public' : 'Private'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Tasks:</strong> {tasks.length}
                  </Typography>
                </Box>
              </CardContent>
            </Card>

            {/* Tasks Review */}
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Tasks ({tasks.length})
            </Typography>
            <Paper variant="outlined">
              <List>
                {tasks.map((task, index) => (
                  <React.Fragment key={task.id}>
                    {index > 0 && <Divider />}
                    <ListItem>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Assignment fontSize="small" color="action" />
                            <Typography variant="body1" fontWeight="bold">
                              {task.title}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <>
                            {task.description && (
                              <Typography component="span" variant="body2" color="text.secondary" display="block" sx={{ ml: 3 }}>
                                {task.description}
                              </Typography>
                            )}
                            <Box component="span" sx={{ display: 'flex', gap: 1, mt: 0.5, ml: 3 }}>
                              <Typography component="span" variant="caption" sx={{ bgcolor: 'primary.main', color: 'white', px: 1, py: 0.5, borderRadius: 1 }}>
                                {task.points} points
                              </Typography>
                              <Typography component="span" variant="caption" sx={{ bgcolor: 'action.selected', px: 1, py: 0.5, borderRadius: 1 }}>
                                {task.frequency}
                              </Typography>
                            </Box>
                          </>
                        }
                      />
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            </Paper>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        <IconButton onClick={() => navigate('/rooms')}>
          <ArrowBack />
        </IconButton>
        <Box>
          <Typography variant="h4" fontWeight="bold">
            Create New Room
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Set up a habit tracking room for your community
          </Typography>
        </Box>
      </Box>

      {/* Stepper */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stepper activeStep={activeStep}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Step Content */}
      <Paper sx={{ p: 3, mb: 3 }}>
        {renderStepContent()}
      </Paper>

      {/* Navigation Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button
          disabled={activeStep === 0}
          onClick={handleBack}
          size="large"
        >
          Back
        </Button>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={() => navigate('/rooms')}
            size="large"
          >
            Cancel
          </Button>
          {activeStep === steps.length - 1 ? (
            <Button
              variant="contained"
              onClick={handleCreateRoom}
              disabled={loading}
              size="large"
              startIcon={<EmojiEvents />}
            >
              {loading ? 'Creating...' : 'Create Room'}
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleNext}
              size="large"
            >
              Next
            </Button>
          )}
        </Box>
      </Box>
    </Container>
  );
};

export default CreateRoomPage;
