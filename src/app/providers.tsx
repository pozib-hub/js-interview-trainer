"use client";

import { type ReactNode } from "react";
import { AppDataProvider } from "@/lib/useAppData";
import { LayoutProvider } from "@/lib/useResizableLayout";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AppDataProvider>
      <LayoutProvider>{children}</LayoutProvider>
    </AppDataProvider>
  );
}
