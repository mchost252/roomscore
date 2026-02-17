// User types
export interface User {
  id: string;
  email: string;
  username: string;
  avatar: string | null;
  bio: string | null;
  timezone: string;
  onboardingCompleted: boolean;
  streak: number;
  longestStreak: number;
  totalTasksCompleted: number;
  createdAt: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  refreshToken: string;
  user: User;
}

export interface ErrorResponse {
  success: false;
  message: string;
  errors?: Array<{ field: string; message: string }>;
}

// Room types (add more as needed)
export interface Room {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  // Add other room fields as needed
}

// Task types (add more as needed)
export interface Task {
  id: string;
  title: string;
  completed: boolean;
  // Add other task fields as needed
}
