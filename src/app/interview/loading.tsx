"use client";

import { Box, Spacer, Spinner } from "@ui/index";

export default function Loading() {
  return (
    <div className="AppShell">
      <header className="AppHeader">
        <h1>Interview Trainer</h1>
        <Spacer />
      </header>
      <Box className="Main" alignItems="center" justifyContent="center">
        <Spinner size="big" />
      </Box>
    </div>
  );
}
