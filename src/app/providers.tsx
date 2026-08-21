"use client";

import { type ReactNode } from "react";
import { AppDataProvider } from "@hooks/useAppData";
import { LayoutProvider } from "@hooks/useResizableLayout";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AppDataProvider>
      <LayoutProvider>{children}</LayoutProvider>
    </AppDataProvider>
  );
}
