"use client";

import { useCallback, useEffect, useState } from "react";
import type { UserQuestion } from "@lib/types";

const LS_KEY = "it:my-questions";

function loadFromStorage(): UserQuestion[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistToStorage(questions: UserQuestion[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(questions));
  } catch {}
}

export interface UserQuestionDraft {
  question: string;
  answer: string;
  category?: string;
}

/**
 * Локальные вопросы пользователя (localStorage, без синхронизации с сервером).
 * null внутри — «ещё не загружено», чтобы не затирать storage пустым массивом.
 */
export function useUserQuestions() {
  const [questions, setQuestions] = useState<UserQuestion[] | null>(null);

  useEffect(() => {
    setQuestions(loadFromStorage());
  }, []);

  useEffect(() => {
    if (questions !== null) persistToStorage(questions);
  }, [questions]);

  const addQuestion = useCallback((draft: UserQuestionDraft): UserQuestion => {
    const now = Date.now();
    const q: UserQuestion = {
      id: `my-${now}-${Math.random().toString(36).slice(2, 8)}`,
      question: draft.question.trim(),
      answer: draft.answer.trim(),
      category: draft.category || "",
      createdAt: now,
      updatedAt: now,
    };
    setQuestions((prev) => [...(prev ?? []), q]);
    return q;
  }, []);

  const updateQuestion = useCallback((id: string, draft: UserQuestionDraft) => {
    setQuestions((prev) =>
      (prev ?? []).map((q) =>
        q.id === id
          ? {
              ...q,
              question: draft.question.trim(),
              answer: draft.answer.trim(),
              category: draft.category || "",
              updatedAt: Date.now(),
            }
          : q
      )
    );
  }, []);

  const removeQuestion = useCallback((id: string) => {
    setQuestions((prev) => (prev ?? []).filter((q) => q.id !== id));
  }, []);

  return {
    questions: questions ?? [],
    loaded: questions !== null,
    addQuestion,
    updateQuestion,
    removeQuestion,
  };
}
