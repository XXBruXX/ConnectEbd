
"use client";

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FirebaseProvider } from './FirebaseProvider';
import { ThemeProvider } from './ThemeProvider'; // Import ThemeProvider

const queryClient = new QueryClient();

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider> {/* Wrap with ThemeProvider */}
      <FirebaseProvider>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </FirebaseProvider>
    </ThemeProvider>
  );
}

    