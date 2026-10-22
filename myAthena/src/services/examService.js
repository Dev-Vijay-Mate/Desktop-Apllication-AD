import {
  demoQuestions,
  DEMO_EXAM_TITLE,
  DEMO_EXAM_DURATION_SECONDS,
} from "../data/demoQuestions.js";

function validateQuestions(questions) {
  if (!Array.isArray(questions)) {
    throw new Error("The question data must be an array.");
  }

  const seenQuestionIds = new Set();

  return questions.map((question, index) => {
    if (
      !question ||
      typeof question.id !== "string" ||
      question.id.trim() === ""
    ) {
      throw new Error(
        `Question ${index + 1} has a missing or invalid ID.`
      );
    }

    if (seenQuestionIds.has(question.id)) {
      throw new Error(
        `Question ID "${question.id}" is duplicated.`
      );
    }

    seenQuestionIds.add(question.id);

    if (
      typeof question.question !== "string" ||
      question.question.trim() === ""
    ) {
      throw new Error(
        `Question ${index + 1} has no question text.`
      );
    }

    if (
      !Array.isArray(question.options) ||
      question.options.length < 2
    ) {
      throw new Error(
        `Question "${question.id}" must have at least two options.`
      );
    }

    const seenOptionIds = new Set();

    const options = question.options.map((option) => {
      if (
        !option ||
        typeof option.id !== "string" ||
        option.id.trim() === "" ||
        typeof option.text !== "string" ||
        option.text.trim() === ""
      ) {
        throw new Error(
          `Question "${question.id}" contains an invalid option.`
        );
      }

      if (seenOptionIds.has(option.id)) {
        throw new Error(
          `Question "${question.id}" contains a duplicate option ID.`
        );
      }

      seenOptionIds.add(option.id);

      return {
        id: option.id,
        text: option.text,
      };
    });

    if (
      typeof question.correctAnswerId !== "string" ||
      !seenOptionIds.has(question.correctAnswerId)
    ) {
      throw new Error(
        `Question "${question.id}" has an invalid demonstration answer key.`
      );
    }

    return {
      id: question.id,
      question: question.question,
      options,
      correctAnswerId: question.correctAnswerId,
    };
  });
}

/**
 * Load the local demonstration examination.
 *
 * This function does not contact a backend.
 * Its Promise-based interface allows the page to use async/await
 * consistently with a future real service implementation.
 */
export async function loadExam() {
  const questions = validateQuestions(demoQuestions);

  return {
    title: DEMO_EXAM_TITLE,
    durationSeconds: DEMO_EXAM_DURATION_SECONDS,
    source: "demo",
    questions,
  };
}

/**
 * Process the demonstration answers locally.
 *
 * No network request is made, and no server persistence occurs.
 */
export async function submitExam({
  exam,
  answers,
  startedAt,
  submittedAt,
  reason,
}) {
  if (!exam || exam.source !== "demo") {
    throw new Error(
      "The local demonstration service only processes demo examinations."
    );
  }

  const questions = validateQuestions(exam.questions);

  if (questions.length === 0) {
    throw new Error(
      "An examination with no questions cannot be submitted."
    );
  }

  if (
    !answers ||
    typeof answers !== "object" ||
    Array.isArray(answers)
  ) {
    throw new Error("The answer collection is invalid.");
  }

  const answeredCount = questions.filter(
    (question) => Boolean(answers[question.id])
  ).length;

  const unansweredCount = questions.length - answeredCount;

  const correctCount = questions.filter(
    (question) =>
      answers[question.id] === question.correctAnswerId
  ).length;

  const scorePercentage = Math.round(
    (correctCount / questions.length) * 100
  );

  return {
    examTitle: exam.title,
    source: "demo",
    persistence: "local-only",
    savedToServer: false,

    totalQuestions: questions.length,
    answeredCount,
    unansweredCount,
    correctCount,
    scorePercentage,

    startedAt: startedAt ?? null,
    submittedAt: submittedAt ?? new Date().toISOString(),
    reason: reason ?? "manual",

    message:
      "Demonstration result calculated locally. No answers were sent to a server.",
  };
}