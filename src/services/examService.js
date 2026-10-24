import {
  demoQuestions,
  DEMO_EXAM_TITLE,
  DEMO_EXAM_DURATION_SECONDS,
  DEMO_EXAM_POLICY,
} from "../data/demoQuestions.js";

const ALLOWED_AUDIT_EVENT_TYPES = new Set([
  "fullscreen-exited",
  "fullscreen-restored",
  "fullscreen-not-active-at-exam-start",
]);

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
        `Question "${question.id}" has an invalid demo answer key.`
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

function normalizeAuditEvents(events, policy) {
  if (
    !policy?.recordFullscreenInterruptions ||
    !Array.isArray(events)
  ) {
    return [];
  }

  return events.filter((event) => {
    return (
      event &&
      ALLOWED_AUDIT_EVENT_TYPES.has(event.type) &&
      typeof event.occurredAt === "string" &&
      Number.isFinite(Date.parse(event.occurredAt))
    );
  }).map((event) => ({
    type: event.type,
    occurredAt: new Date(event.occurredAt).toISOString(),
  }));
}

/**
 * Load a demonstration exam from the local question bank.
 *
 * This function does not contact a server.
 */
export async function loadExam() {
  const questions = validateQuestions(demoQuestions);

  return {
    id: "athena-demo-exam",
    title: DEMO_EXAM_TITLE,
    durationSeconds: DEMO_EXAM_DURATION_SECONDS,
    source: "demo",
    policy: { ...DEMO_EXAM_POLICY },
    questions,
  };
}

/**
 * Process an exam submission using the local demo data.
 *
 * No server request is made. Backend exams must use a separately
 * configured service and must not be reported as confirmed by this one.
 */
export async function submitExam({
  exam,
  answers,
  startedAt,
  submittedAt,
  reason = "manual",
  fullscreenEvents = [],
}) {
  if (exam?.source !== "demo") {
    throw new Error(
      "No real backend submission service is configured. " +
      "The examination was not sent to or confirmed by a server."
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

  const answeredQuestions = questions.filter((question) =>
    question.options.some(
      (option) => option.id === answers[question.id]
    )
  );

  const answeredCount = answeredQuestions.length;

  const unansweredCount = questions.length - answeredCount;

  const correctCount = questions.filter(
    (question) =>
      answers[question.id] === question.correctAnswerId
  ).length;

  const scorePercentage = Math.round(
    (correctCount / questions.length) * 100
  );

  const auditEvents = normalizeAuditEvents(
    fullscreenEvents,
    exam.policy
  );

  const fullscreenInterruptionCount = auditEvents.filter(
    (event) =>
      event.type === "fullscreen-exited" ||
      event.type === "fullscreen-not-active-at-exam-start"
  ).length;

  return {
    examId: exam.id,
    examTitle: exam.title,

    source: "demo",
    persistence: "local-only",
    submissionStatus: "local-demo",
    serverConfirmed: false,
    savedToServer: false,
    submissionId: null,

    totalQuestions: questions.length,
    answeredCount,
    unansweredCount,
    correctCount,
    scorePercentage,

    startedAt: startedAt ?? null,
    submittedAt: submittedAt ?? new Date().toISOString(),
    reason,

    fullscreenEvents: auditEvents,
    fullscreenInterruptionCount,

    policy: { ...exam.policy },

    message:
      "This is a local demonstration result. No answers were " +
      "sent to or saved by a server.",
  };
}