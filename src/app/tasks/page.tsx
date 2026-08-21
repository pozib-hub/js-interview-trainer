"use client";

import { EmptyState, Typography } from "@ui/index";

export default function TasksEmptyPage() {
  return (
    <EmptyState>
      <Typography align="center">
        <Typography size={32} mb={12}>👈</Typography>
        Выберите задачу слева, чтобы начать
      </Typography>
    </EmptyState>
  );
}
