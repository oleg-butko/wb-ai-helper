"use client";

import { MantineProvider } from "@mantine/core";
import type { ReactNode } from "react";

import { theme } from "@/theme";
import type { StoredColorScheme } from "@/lib/theme/color-scheme";

type AppProviderProps = {
  children: ReactNode;
  initialColorScheme?: StoredColorScheme;
};

export function AppProvider({ children, initialColorScheme = "light" }: AppProviderProps) {
  return (
    <MantineProvider theme={theme} defaultColorScheme={initialColorScheme}>
      {children}
    </MantineProvider>
  );
}
