import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppProvider } from './src/context/AppContext';
import { AppNavigation } from './src/app/navigation';

export default function App() {
  return (
    <AppProvider>
      <StatusBar style="dark" />
      <AppNavigation />
    </AppProvider>
  );
}
