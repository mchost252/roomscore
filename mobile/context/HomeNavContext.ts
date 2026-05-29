import React from 'react';

export const HomeNavContext = React.createContext<{
  openAIChat: () => void;
  openAddTask: () => void;
  navigateHomeTab: (route: string) => void;
  setOpenAIChat: (fn: () => void) => void;
  setOpenAddTask: (fn: () => void) => void;
}>({
  openAIChat: () => {},
  openAddTask: () => {},
  navigateHomeTab: () => {},
  setOpenAIChat: () => {},
  setOpenAddTask: () => {},
});
