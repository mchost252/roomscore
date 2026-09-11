import React from 'react';

export interface AiToastState {
  message: string;
  action: string;
}

export const HomeNavContext = React.createContext<{
  openAIChat: () => void;
  openAddTask: () => void;
  navigateHomeTab: (route: string) => void;
  setOpenAIChat: (fn: () => void) => void;
  setOpenAddTask: (fn: () => void) => void;
  aiToast: AiToastState | null;
  showAiToast: (toast: AiToastState) => void;
  hideAiToast: () => void;
}>({
  openAIChat: () => {},
  openAddTask: () => {},
  navigateHomeTab: () => {},
  setOpenAIChat: () => {},
  setOpenAddTask: () => {},
  aiToast: null,
  showAiToast: () => {},
  hideAiToast: () => {},
});
