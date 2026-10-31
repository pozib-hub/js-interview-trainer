"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Box, Button, EmptyState, Skeleton, Typography } from "@ui/index";
import type { QuestionsIndex } from "@lib/types";
import { fetchQuestionsIndex, technologyQuestionCount } from "@lib/questionsApi";
import { newQuestionIssueUrl } from "@lib/contribute";
import QuestionsBrowser from "../../components/QuestionsBrowser";
import styles from "../../questions.module.css";

interface ITechnologyPageClientProps {
  directionId: string;
  technologyId: string;
}

export default function TechnologyPageClient(props: ITechnologyPageClientProps) {
  const { directionId, technologyId } = props;
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
  const technology = useMemo(
    () => direction?.technologies.find((t) => t.id === `${directionId}/${technologyId}`) ?? null,
    [direction, directionId, technologyId]
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

  if (!technology) {
    return (
      <div className={styles.Container}>
        <EmptyState>
          <Typography align="center">
            Технология «{directionId}/{technologyId}» не найдена.
          </Typography>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className={styles.Container}>
      <div className={styles.PageHead}>
        <div className={styles.Breadcrumb}>
          <a href="/questions" className={styles.CrumbLink}>Вопросы</a>
          <span>/</span>
          <a href={`/questions/${directionId}`} className={styles.CrumbLink}>
            {direction?.title ?? directionId}
          </a>
        </div>
        <h1 className={styles.PageTitle}>{technology.title}</h1>
        <p className={styles.PageDesc}>{technology.description}</p>
        <div className={styles.PageMeta}>
          {technology.chapters.length} глав · {technologyQuestionCount(technology)} вопросов
        </div>
      </div>

      <QuestionsBrowser
        chapters={technology.chapters}
        focusChapterId={focusChapterId}
        searchPlaceholder={`Поиск по вопросам: ${technology.title}…`}
      />

      <div className={styles.AddQuestionNote}>
        Хотите поделиться вопросом со всеми?{" "}
        <Button
          size="sm"
          href={newQuestionIssueUrl({
            direction: directionId,
            technology: technologyId,
          })}
          external
          title="Предложить вопрос через GitHub Issue — AI оформит ответ и откроет PR"
        >
          ➕ Предложить в общий сборник
        </Button>
      </div>
    </div>
  );
}
