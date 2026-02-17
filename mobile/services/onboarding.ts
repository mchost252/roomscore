import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_COMPLETE_KEY = 'onboarding_complete';
const USER_NAME_KEY = 'user_name';

export const onboardingService = {
  // Check if user has completed onboarding
  hasCompletedOnboarding: async (): Promise<boolean> => {
    try {
      const value = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
      return value === 'true';
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      return false;
    }
  },

  // Mark onboarding as complete
  setOnboardingComplete: async (): Promise<void> => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    } catch (error) {
      console.error('Error setting onboarding complete:', error);
    }
  },

  // Save user's name
  saveUserName: async (name: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(USER_NAME_KEY, name);
    } catch (error) {
      console.error('Error saving user name:', error);
    }
  },

  // Get user's name
  getUserName: async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(USER_NAME_KEY);
    } catch (error) {
      console.error('Error getting user name:', error);
      return null;
    }
  },

  // Clear onboarding data (for testing)
  clearOnboarding: async (): Promise<void> => {
    try {
      await AsyncStorage.multiRemove([ONBOARDING_COMPLETE_KEY, USER_NAME_KEY]);
    } catch (error) {
      console.error('Error clearing onboarding:', error);
    }
  },
};
