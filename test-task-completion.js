// Simple test script to verify task completion functionality
const fetch = require('node-fetch');

async function testTaskCompletion() {
  try {
    console.log('Testing task completion functionality...');
    
    // Test 1: Create a test room and task
    console.log('1. Creating test room...');
    const roomResponse = await fetch('http://localhost:3000/api/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      body: JSON.stringify({
        name: 'Test Room',
        description: 'Test room for task completion',
        isPrivate: false
      })
    });
    
    if (!roomResponse.ok) {
      throw new Error(`Failed to create room: ${roomResponse.status}`);
    }
    
    const roomData = await roomResponse.json();
    console.log('Room created:', roomData.room.name);
    
    // Test 2: Create a test task
    console.log('2. Creating test task...');
    const taskResponse = await fetch(`http://localhost:3000/api/rooms/${roomData.room.id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      body: JSON.stringify({
        title: 'Test Task',
        description: 'Test task for completion',
        points: 10,
        taskType: 'daily'
      })
    });
    
    if (!taskResponse.ok) {
      throw new Error(`Failed to create task: ${taskResponse.status}`);
    }
    
    const taskData = await taskResponse.json();
    console.log('Task created:', taskData.task.title);
    
    // Test 3: Complete the task
    console.log('3. Completing task...');
    const completionResponse = await fetch(`http://localhost:3000/api/rooms/${roomData.room.id}/tasks/${taskData.task.id}/complete`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });
    
    if (!completionResponse.ok) {
      throw new Error(`Failed to complete task: ${completionResponse.status}`);
    }
    
    const completionData = await completionResponse.json();
    console.log('Task completed successfully!');
    console.log('Completion data:', completionData);
    
    // Test 4: Verify task is marked as completed
    console.log('4. Verifying task completion...');
    const tasksResponse = await fetch(`http://localhost:3000/api/rooms/${roomData.room.id}/tasks`, {
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });
    
    if (!tasksResponse.ok) {
      throw new Error(`Failed to fetch tasks: ${tasksResponse.status}`);
    }
    
    const tasksData = await tasksResponse.json();
    const completedTask = tasksData.tasks.find(t => t.id === taskData.task.id);
    
    if (completedTask && completedTask.isCompleted) {
      console.log('✅ Task completion test PASSED!');
      console.log('Task is correctly marked as completed');
    } else {
      console.log('❌ Task completion test FAILED!');
      console.log('Task is not marked as completed');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the test
testTaskCompletion();