"use client";

import { Box, Skeleton, Spacer, Spinner, Typography } from "@ui/index";

export default function Loading() {
  return (
    <div className="AppShell">
      <header className="AppHeader">
        <h1>Interview Trainer</h1>
        <Typography color="text-muted" size={12}>
          <Spinner mr={6} />
          Загрузка…
        </Typography>
        <Spacer />
      </header>
      <div className="AppBody">
        <aside className="Sidebar" style={{ width: 280, flexShrink: 0 }}>
          <Box p={16}>
            <Skeleton line width="60%" />
            <Skeleton line width="80%" />
            <Skeleton line width="50%" />
            <Skeleton line width="70%" />
          </Box>
        </aside>
        <Box
          flex={1}
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <Spinner size="big" />
        </Box>
      </div>
    </div>
  );
}
