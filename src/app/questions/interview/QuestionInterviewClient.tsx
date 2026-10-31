"use client";

import { useEffect, useRef, useState } from "react";
import type { AnalyzeVerdict, PlanQuestion, QuestionsIndex, StoredInterviewSession } from "@lib/types";
import { fetchQuestionsIndex } from "@lib/questionsApi";
import SetupPhase from "./components/SetupPhase";
import SessionPhase from "./components/SessionPhase";
import ResultsPhase from "./components/ResultsPhase";

type Phase = "setup" | "planning" | "session" | "analyzing" | "results";

const LS_SESSION_KEY = "it:question-interview";

export interface ResultItem {
  question: PlanQuestion;
  userAnswer: string;
  ok: boolean;
  feedback: string;
}

export default function QuestionInterviewClient() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [index, setIndex] = useState<QuestionsIndex | null>(null);
  const [savedSession, setSavedSession] = useState<StoredInterviewSession | null>(null);

  const [direction, setDirection] = useState("");
  const [planQuestions, setPlanQuestions] = useState<PlanQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [startedAt, setStartedAt] = useState(0);

  const [planError, setPlanError] = useState("");
  const [analyzeError, setAnalyzeError] = useState("");
  const [results, setResults] = useState<ResultItem[] | null>(null);
  const [summary, setSummary] = useState("");

  useEffect(() => {
    fetchQuestionsIndex().then(setIndex).catch(() => setIndex({ directions: [] }));
  }, []);

  // Незавершённая сессия — предложить возобновление
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_SESSION_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as StoredInterviewSession;
      if (s?.version === 1 && Array.isArray(s.questions) && s.questions.length > 0) {
        setSavedSession(s);
      }
    } catch {}
  }, []);

  // Персистентность сессии (дебаунс 500мс)
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (phase !== "session" || !planQuestions) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      const s: StoredInterviewSession = {
        version: 1,
        startedAt,
        direction,
        questions: planQuestions,
        answers,
        currentIndex: current,
      };
      try {
        localStorage.setItem(LS_SESSION_KEY, JSON.stringify(s));
      } catch {}
    }, 500);
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [phase, planQuestions, answers, current, startedAt, direction]);

  const start = async (directionId: string, technologies: string[]) => {
    setPlanError("");
    setPhase("planning");
    try {
      const res = await fetch("/api/question-interview/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction: directionId, technologies }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось составить план собеседования");

      setDirection(directionId);
      setPlanQuestions(data.questions);
      setAnswers({});
      setCurrent(0);
      setStartedAt(Date.now());
      setSavedSession(null);
      setPhase("session");
    } catch (e) {
      setPlanError((e as Error).message);
      setPhase("setup");
    }
  };

  const resume = () => {
    if (!savedSession) return;
    setDirection(savedSession.direction);
    setPlanQuestions(savedSession.questions);
    setAnswers(savedSession.answers ?? {});
    setCurrent(savedSession.currentIndex ?? 0);
    setStartedAt(savedSession.startedAt);
    setPhase("session");
  };

  const discardSaved = () => {
    try {
      localStorage.removeItem(LS_SESSION_KEY);
    } catch {}
    setSavedSession(null);
  };

  const onAnswer = (qid: string, text: string) => {
    setAnswers((prev) => ({ ...prev, [qid]: text }));
  };

  const goTo = (i: number) => {
    setCurrent(Math.max(0, Math.min(i, (planQuestions?.length ?? 1) - 1)));
  };

  const next = () => {
    if (!planQuestions) return;
    if (current < planQuestions.length - 1) goTo(current + 1);
    else finish();
  };

  const finishEarly = () => {
    if (!planQuestions) return;
    if (confirm(`Завершить досрочно и отправить ответы на разбор?`)) finish();
  };

  const finish = async () => {
    const qs = planQuestions ?? [];
    const items = qs
      .map((q) => ({ question: q, userAnswer: (answers[q.id] ?? "").trim() }))
      .filter((it) => it.userAnswer.length > 0);

    if (items.length === 0) {
      setAnalyzeError("Нет ни одного ответа — ответьте хотя бы на один вопрос голосом или текстом");
      return;
    }

    setAnalyzeError("");
    setPhase("analyzing");
    try {
      const res = await fetch("/api/question-interview/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((it) => ({
            id: it.question.id,
            question: it.question.question,
            referenceAnswer: it.question.answer,
            userAnswer: it.userAnswer,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось разобрать ответы");

      const verdicts = new Map<string, AnalyzeVerdict>(
        ((data.results ?? []) as AnalyzeVerdict[]).map((v) => [v.id, v])
      );
      setResults(
        items.map((it) => ({
          question: it.question,
          userAnswer: it.userAnswer,
          ok: verdicts.get(it.question.id)?.ok ?? false,
          feedback: verdicts.get(it.question.id)?.feedback ?? "",
        }))
      );
      setSummary(data.summary ?? "");
      try {
        localStorage.removeItem(LS_SESSION_KEY);
      } catch {}
      setSavedSession(null);
      setPhase("results");
    } catch (e) {
      setAnalyzeError((e as Error).message);
      setPhase("session");
    }
  };

  const restart = () => {
    try {
      localStorage.removeItem(LS_SESSION_KEY);
    } catch {}
    setSavedSession(null);
    setPlanQuestions(null);
    setAnswers({});
    setResults(null);
    setSummary("");
    setCurrent(0);
    setPhase("setup");
  };

  if (phase === "setup" || phase === "planning") {
    return (
      <SetupPhase
        index={index}
        savedSession={savedSession}
        onResume={resume}
        onDiscard={discardSaved}
        onStart={start}
        busy={phase === "planning"}
        error={planError}
      />
    );
  }

  if ((phase === "session" || phase === "analyzing") && planQuestions) {
    return (
      <SessionPhase
        questions={planQuestions}
        current={current}
        answers={answers}
        onAnswer={onAnswer}
        onGoTo={goTo}
        onNext={next}
        onFinishEarly={finishEarly}
        startedAt={startedAt}
        analyzing={phase === "analyzing"}
        error={analyzeError}
      />
    );
  }

  if (phase === "results" && results) {
    return (
      <ResultsPhase
        items={results}
        summary={summary}
        totalQuestions={planQuestions?.length ?? results.length}
        onRestart={restart}
      />
    );
  }

  return null;
}
