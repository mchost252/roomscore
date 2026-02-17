import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="name-input" />
      <Stack.Screen name="landing" />
      <Stack.Screen name="ai-intro" />
      <Stack.Screen name="auth-choice" />
    </Stack>
  );
}
