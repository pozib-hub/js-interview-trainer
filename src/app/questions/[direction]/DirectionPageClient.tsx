"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Box, EmptyState, Skeleton, Typography } from "@ui/index";
import type { QuestionsIndex } from "@lib/types";
import { fetchQuestionsIndex, directionQuestionCount, technologyQuestionCount } from "@lib/questionsApi";
import QuestionsBrowser from "../components/QuestionsBrowser";
import styles from "../questions.module.css";

interface IDirectionPageClientProps {
  directionId: string;
}

export default function DirectionPageClient(props: IDirectionPageClientProps) {
  const { directionId } = props;
  const [index, setIndex] = useState<QuestionsIndex | null>(null);
  const searchParams = useSearchParams();
  const focusChapterId = searchParams.get("ch") || undefined;

  useEffect(() => {
    fetchQuestionsIndex().then(setIndex).catch(() => setIndex({ directions: [] }));
  }, []);

  const direction = useMemo(
    () => index?.directions.find((d) => d.id === directionId) ?? null,
    [index, directionId]
  );

  if (!index) {
    return (
      <div className={styles.Container}>
        <Box p="24px 0">
          <Skeleton line width="30%" />
          <Skeleton line width="80%" />
          <Skeleton line width="60%" />
        </Box>
      </div>
    );
  }

  if (!direction) {
    return (
      <div className={styles.Container}>
        <EmptyState>
          <Typography align="center">Направление «{directionId}» не найдено.</Typography>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className={styles.Container}>
      <div className={styles.PageHead}>
        <div className={styles.Breadcrumb}>
          <a href="/questions" className={styles.CrumbLink}>← Все направления</a>
        </div>
        <h1 className={styles.PageTitle}>{direction.title}</h1>
        <p className={styles.PageDesc}>{direction.description}</p>
        <div className={styles.PageMeta}>
          {direction.technologies.length > 0
            ? `${direction.technologies.length} технологий · `
            : ""}
          {directionQuestionCount(direction)} вопросов
        </div>
      </div>

      {direction.chapters.length > 0 ? (
        <QuestionsBrowser
          chapters={direction.chapters}
          focusChapterId={focusChapterId}
          searchPlaceholder={`Поиск по вопросам: ${direction.title}…`}
        />
      ) : (
        <div className={styles.Grid}>
          {direction.technologies.map((tech) => (
            <a key={tech.id} href={`/questions/${tech.id}`} className={styles.Card}>
              <h3 className={styles.CardTitle}>{tech.title}</h3>
              <p className={styles.CardDesc}>{tech.description}</p>
              <div className={styles.CardMeta}>
                {tech.chapters.length} глав · {technologyQuestionCount(tech)} вопросов
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
