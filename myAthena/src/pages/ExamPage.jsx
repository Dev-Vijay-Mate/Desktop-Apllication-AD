import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import ExamHeader from "../components/ExamHeader.jsx";
import QuestionCard from "../components/QuestionCard.jsx";
import CameraPreview from "../components/CameraPreview.jsx";

import useExamTimer from "../hooks/useExamTimer.js";

import {
  loadExam,
  submitExam,
} from "../services/examService.js";

import {
  DEMO_EXAM_DURATION_SECONDS,
} from "../data/demoQuestions.js";

import "../styles/exam-page.css";

function ExamPage({
  onComplete,
  onReturnToSetup,
  cameraStream = null,
  cameraStatus = "idle",
  durationSeconds = DEMO_EXAM_DURATION_SECONDS,
}) {
  const [exam, setExam] = useState(null);
  const [loadStatus, setLoadStatus] = useState("loading");
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);

  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const [submissionResult, setSubmissionResult] = useState(null);

  const submissionLockRef = useRef(false);
  const submissionHandlerRef = useRef(null);
  const startedAtRef = useRef(null);

  /*
   * This stable callback allows the timer to request submission
   * without capturing outdated answers from an earlier render.
   */
  const handleTimerExpiration = useCallback(() => {
    if (submissionHandlerRef.current) {
      void submissionHandlerRef.current("time-expired");
    }
  }, []);

  /*
   * This is the only timer instance owned by the exam page.
   */
  const timer = useExamTimer({
    durationSeconds,
    onExpire: handleTimerExpiration,
  });

  /*
   * Load the exam through the service layer.
   */
  useEffect(() => {
    let cancelled = false;

    async function initialiseExam() {
      setLoadStatus("loading");
      setLoadError("");
      setSubmissionError("");
      setExam(null);

      try {
        const loadedExam = await loadExam();

        if (cancelled) {
          return;
        }

        if (
          !loadedExam ||
          !Array.isArray(loadedExam.questions)
        ) {
          throw new Error(
            "The examination service returned invalid question data."
          );
        }

        setExam(loadedExam);
        setAnswers({});
        setCurrentIndex(0);
        setSubmissionResult(null);
        setIsSubmitting(false);

        submissionLockRef.current = false;
        startedAtRef.current = new Date().toISOString();

        if (loadedExam.questions.length === 0) {
          setLoadStatus("empty");
          return;
        }

        setLoadStatus("ready");

        // Begin the countdown only after questions have loaded.
        timer.start();
      } catch (error) {
        if (cancelled) {
          return;
        }

        setLoadError(
          error?.message ||
          "The examination questions could not be loaded."
        );

        setLoadStatus("error");
      }
    }

    void initialiseExam();

    return () => {
      cancelled = true;
    };
  }, [loadAttempt, timer.start]);

  const questions = Array.isArray(exam?.questions)
    ? exam.questions
    : [];

  const totalQuestions = questions.length;

  const currentQuestion = questions[currentIndex] ?? null;

  const currentQuestionNumber =
    totalQuestions > 0 ? currentIndex + 1 : 0;

  const answeredCount = questions.filter(
    (question) => Boolean(answers[question.id])
  ).length;

  const unansweredCount =
    totalQuestions - answeredCount;

  /*
   * This function is shared by manual submission and automatic
   * submission when the timer expires.
   */
  async function performSubmission(reason) {
    if (
      submissionLockRef.current ||
      !exam ||
      questions.length === 0 ||
      submissionResult
    ) {
      return;
    }

    // Lock synchronously before awaiting anything.
    submissionLockRef.current = true;

    setIsSubmitting(true);
    setSubmissionError("");

    timer.stop();

    try {
      const result = await submitExam({
        exam,
        answers,
        startedAt: startedAtRef.current,
        submittedAt: new Date().toISOString(),
        reason,
      });

      setSubmissionResult(result);
      setIsSubmitting(false);

      /*
       * App owns the camera and stops it after submission.
       */
      if (typeof onComplete === "function") {
        onComplete(result);
      }
    } catch (error) {
      /*
       * Allow a retry if submission processing fails.
       * A local demo submission makes no network request.
       */
      submissionLockRef.current = false;

      setIsSubmitting(false);

      setSubmissionError(
        error?.message ||
        "The examination could not be processed. Please try again."
      );

      // Resume the remaining time after a failed manual attempt.
      // If time already expired, the student can retry submission.
      if (
        reason !== "time-expired" &&
        timer.remainingSeconds > 0
      ) {
        timer.start();
      }
    }
  }

  /*
   * Always point the timer to the latest submission function.
   */
  submissionHandlerRef.current = performSubmission;

  /*
   * Store the answer against its question ID.
   * Navigating between questions does not clear this object.
   */
  function handleAnswerChange(questionId, optionId) {
    if (isSubmitting || submissionResult) {
      return;
    }

    setAnswers((currentAnswers) => ({
      ...currentAnswers,
      [questionId]: optionId,
    }));
  }

  function goToPreviousQuestion() {
    setCurrentIndex((current) => Math.max(0, current - 1));
  }

  function goToNextQuestion() {
    setCurrentIndex((current) =>
      Math.min(totalQuestions - 1, current + 1)
    );
  }

  /*
   * The automatic time-expiry path calls performSubmission()
   * directly and does not ask for confirmation.
   */
  function handleManualSubmit() {
    if (
      submissionLockRef.current ||
      isSubmitting ||
      submissionResult
    ) {
      return;
    }

    const confirmationMessage =
      unansweredCount > 0
        ? `You have ${unansweredCount} unanswered question(s). ` +
          "Are you sure you want to submit the examination?"
        : "Are you sure you want to submit your examination? " +
          "You cannot change your answers afterwards.";

    const confirmed = window.confirm(
      confirmationMessage
    );

    if (!confirmed) {
      return;
    }

    void performSubmission("manual");
  }

  /*
   * Loading and error states are shown instead of assuming
   * that questions were successfully loaded.
   */
  if (loadStatus === "loading") {
    return (
      <main className="exam-page">
        <div className="exam-shell">
          <section className="exam-state-card">
            <div
              className="exam-loading-indicator"
              aria-hidden="true"
            />

            <h1>Loading examination</h1>

            <p>
              Athena is preparing the demonstration questions.
            </p>
          </section>
        </div>
      </main>
    );
  }

  if (loadStatus === "error") {
    return (
      <main className="exam-page">
        <div className="exam-shell">
          <section className="exam-state-card">
            <span className="exam-state-card__icon">
              !
            </span>

            <h1>Unable to load examination</h1>

            <p
              className="exam-message exam-message--error"
              role="alert"
            >
              {loadError}
            </p>

            <div className="exam-state-card__actions">
              <button
                type="button"
                className="button button--primary"
                onClick={() => {
                  setLoadAttempt((attempt) => attempt + 1);
                }}
              >
                Try Again
              </button>

              <button
                type="button"
                className="button button--secondary"
                onClick={onReturnToSetup}
              >
                Return to Setup
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (loadStatus === "empty" || totalQuestions === 0) {
    return (
      <main className="exam-page">
        <div className="exam-shell">
          <section className="exam-state-card">
            <span className="exam-state-card__icon">
              !
            </span>

            <h1>No examination questions</h1>

            <p>
              The question source is currently empty. Athena
              cannot start an examination without questions.
            </p>

            <div className="exam-state-card__actions">
              <button
                type="button"
                className="button button--primary"
                onClick={() => {
                  setLoadAttempt((attempt) => attempt + 1);
                }}
              >
                Reload Questions
              </button>

              <button
                type="button"
                className="button button--secondary"
                onClick={onReturnToSetup}
              >
                Return to Setup
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  /*
   * Once the submission result is available, show a clear
   * completion summary instead of the active question screen.
   */
  if (submissionResult) {
    return (
      <main className="exam-page">
        <div className="exam-shell">
          <section className="exam-completion-card">
            <div className="exam-completion-card__icon">
              ✓
            </div>

            <p className="exam-header__brand">ATHENA</p>

            <h1>Examination completed</h1>

            <p className="exam-completion-card__subtitle">
              {submissionResult.examTitle}
            </p>

            <span className="exam-source-badge exam-source-badge--demo">
              LOCAL DEMONSTRATION RESULT
            </span>

            <div className="exam-result-grid">
              <div className="exam-result-metric">
                <span>Total questions</span>
                <strong>
                  {submissionResult.totalQuestions}
                </strong>
              </div>

              <div className="exam-result-metric">
                <span>Answered</span>
                <strong>
                  {submissionResult.answeredCount}
                </strong>
              </div>

              <div className="exam-result-metric">
                <span>Unanswered</span>
                <strong>
                  {submissionResult.unansweredCount}
                </strong>
              </div>

              <div className="exam-result-metric">
                <span>Correct demo answers</span>
                <strong>
                  {submissionResult.correctCount}
                </strong>
              </div>

              <div className="exam-result-metric">
                <span>Demonstration score</span>
                <strong>
                  {submissionResult.scorePercentage}%
                </strong>
              </div>
            </div>

            <p className="exam-message exam-message--info">
              {submissionResult.message}
            </p>

            <button
              type="button"
              className="button button--primary"
              onClick={onReturnToSetup}
            >
              Return to Setup
            </button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="exam-page">
      <div className="exam-shell">
        <ExamHeader
          title={exam.title}
          currentQuestionNumber={currentQuestionNumber}
          totalQuestions={totalQuestions}
          remainingSeconds={timer.remainingSeconds}
          source={exam.source}
          onSubmit={handleManualSubmit}
          isSubmitting={isSubmitting}
        />

        {submissionError && (
          <p
            className="exam-message exam-message--error"
            role="alert"
          >
            {submissionError}
          </p>
        )}

        <div className="exam-layout">
          <section className="exam-main">
            <div className="exam-progress">
              <div className="exam-progress__labels">
                <span>Exam progress</span>

                <strong>
                  {answeredCount} / {totalQuestions} answered
                </strong>
              </div>

              <div
                className="exam-progress__track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={totalQuestions}
                aria-valuenow={answeredCount}
                aria-label="Questions answered"
              >
                <div
                  className="exam-progress__fill"
                  style={{
                    width:
                      `${(answeredCount / totalQuestions) * 100}%`,
                  }}
                />
              </div>
            </div>

            <QuestionCard
              question={currentQuestion}
              questionNumber={currentQuestionNumber}
              selectedOptionId={
                currentQuestion
                  ? answers[currentQuestion.id] ?? ""
                  : ""
              }
              onAnswerChange={handleAnswerChange}
              disabled={isSubmitting}
            />

            <nav
              className="exam-navigation"
              aria-label="Question navigation"
            >
              <button
                type="button"
                className="button button--secondary"
                onClick={goToPreviousQuestion}
                disabled={currentIndex === 0 || isSubmitting}
              >
                ← Previous
              </button>

              <span className="exam-navigation__counter">
                {currentQuestionNumber} of {totalQuestions}
              </span>

              <button
                type="button"
                className="button button--primary"
                onClick={goToNextQuestion}
                disabled={
                  currentIndex === totalQuestions - 1 ||
                  isSubmitting
                }
              >
                Next →
              </button>
            </nav>

            <p className="exam-demo-note">
              Demonstration mode: answers are held in React
              state and are not saved to a server.
            </p>
          </section>

          <aside className="exam-sidebar">
            <section className="exam-sidebar-card">
              <div className="exam-sidebar-card__heading">
                <h2>Camera status</h2>

                <span
                  className={
                    cameraStream &&
                    cameraStatus === "ready"
                      ? "status-pill status-pill--success"
                      : "status-pill status-pill--warning"
                  }
                >
                  {cameraStream &&
                  cameraStatus === "ready"
                    ? "Active"
                    : "Not available"}
                </span>
              </div>

              {cameraStream ? (
                <>
                  <CameraPreview stream={cameraStream} />

                  <p className="exam-sidebar-card__note">
                    Your camera preview remains visible. This
                    implementation does not record or upload video.
                  </p>
                </>
              ) : (
                <p className="exam-message exam-message--error">
                  The camera stream is unavailable. The examination
                  timer continues running.
                </p>
              )}
            </section>

            <section className="exam-sidebar-card">
              <h2>Answer summary</h2>

              <div className="exam-answer-summary">
                <div>
                  <span className="answer-summary-dot answer-summary-dot--answered" />
                  Answered
                </div>

                <strong>{answeredCount}</strong>
              </div>

              <div className="exam-answer-summary">
                <div>
                  <span className="answer-summary-dot answer-summary-dot--unanswered" />
                  Unanswered
                </div>

                <strong>{unansweredCount}</strong>
              </div>

              <p className="exam-sidebar-card__note">
                Use Previous and Next to review your answers.
                Selections are preserved when you navigate.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default ExamPage;