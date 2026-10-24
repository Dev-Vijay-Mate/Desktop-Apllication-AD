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

function getFullscreenEventMessage(type, time) {
  const formattedTime = new Date(time).toLocaleTimeString();

  if (type === "fullscreen-exited") {
    return (
      `Fullscreen was exited at ${formattedTime}. ` +
      "This event is recorded for review; an interruption alone " +
      "does not establish misconduct."
    );
  }

  if (type === "fullscreen-restored") {
    return (
      `Fullscreen was restored at ${formattedTime}. ` +
      "The restoration was recorded in the exam audit."
    );
  }

  return (
    `Fullscreen was not active when exam monitoring began at ${formattedTime}. ` +
    "This is an operational record, not a finding of misconduct."
  );
}

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

  const [fullscreenEvents, setFullscreenEvents] = useState([]);
  const [fullscreenNotice, setFullscreenNotice] = useState("");

  const submissionLockRef = useRef(false);
  const submissionHandlerRef = useRef(null);
  const startedAtRef = useRef(null);
  const fullscreenEventsRef = useRef([]);

  const handleTimerExpiration = useCallback(() => {
    if (submissionHandlerRef.current) {
      void submissionHandlerRef.current("time-expired");
    }
  }, []);

  const {
    remainingSeconds,
    isRunning,
    start: startTimer,
    stop: stopTimer,
    reset: resetTimer,
  } = useExamTimer({
    durationSeconds,
    onExpire: handleTimerExpiration,
  });

  /*
   * Load the exam from the service. Cleanup prevents an old
   * asynchronous load from updating an unmounted component.
   */
  useEffect(() => {
    let cancelled = false;

    stopTimer();
    resetTimer(durationSeconds);

    async function initialiseExam() {
      setLoadStatus("loading");
      setLoadError("");
      setSubmissionError("");
      setExam(null);

      setAnswers({});
      setCurrentIndex(0);
      setIsSubmitting(false);

      setFullscreenEvents([]);
      fullscreenEventsRef.current = [];
      setFullscreenNotice("");

      submissionLockRef.current = false;
      startedAtRef.current = null;

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

        if (loadedExam.questions.length === 0) {
          setLoadStatus("empty");
          return;
        }

        startedAtRef.current = new Date().toISOString();
        setLoadStatus("ready");

        resetTimer(
          loadedExam.durationSeconds ?? durationSeconds
        );

        startTimer();
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
      stopTimer();
    };
  }, [
    loadAttempt,
    durationSeconds,
    resetTimer,
    startTimer,
    stopTimer,
  ]);

  const questions = Array.isArray(exam?.questions)
    ? exam.questions
    : [];

  const totalQuestions = questions.length;
  const currentQuestion = questions[currentIndex] ?? null;

  const currentQuestionNumber =
    totalQuestions > 0 ? currentIndex + 1 : 0;

  const answeredCount = questions.filter((question) =>
    question.options.some(
      (option) => option.id === answers[question.id]
    )
  ).length;

  const unansweredCount =
    totalQuestions - answeredCount;

  const isCameraReady =
    cameraStatus === "ready" &&
    Boolean(cameraStream) &&
    cameraStream.getVideoTracks().some(
      (track) => track.readyState === "live"
    );

  /*
   * Record fullscreen changes only while an exam is active and
   * only when its configured policy enables the audit.
   */
  useEffect(() => {
    if (
      loadStatus !== "ready" ||
      exam?.policy?.recordFullscreenInterruptions !== true
    ) {
      return undefined;
    }

    const electronAPI = window.electronAPI;

    if (
      typeof electronAPI?.onFullscreenChanged !== "function" ||
      typeof electronAPI?.getFullScreenState !== "function"
    ) {
      setFullscreenNotice(
        "Fullscreen interruption monitoring is unavailable in this environment."
      );

      return undefined;
    }

    let active = true;
    let previousFullscreen = null;
    let observedEvent = false;

    function recordFullscreenEvent(type) {
      if (!active || submissionLockRef.current) {
        return;
      }

      const event = {
        type,
        occurredAt: new Date().toISOString(),
      };

      const updatedEvents = [
        ...fullscreenEventsRef.current,
        event,
      ];

      fullscreenEventsRef.current = updatedEvents;
      setFullscreenEvents(updatedEvents);

      setFullscreenNotice(
        getFullscreenEventMessage(type, event.occurredAt)
      );
    }

    const unsubscribe = electronAPI.onFullscreenChanged(
      (isFullscreen) => {
        if (!active) {
          return;
        }

        observedEvent = true;

        const nextFullscreen = isFullscreen === true;

        if (
          previousFullscreen === true &&
          !nextFullscreen
        ) {
          recordFullscreenEvent("fullscreen-exited");
        } else if (
          previousFullscreen === false &&
          nextFullscreen
        ) {
          recordFullscreenEvent("fullscreen-restored");
        } else if (
          previousFullscreen === null &&
          !nextFullscreen
        ) {
          recordFullscreenEvent(
            "fullscreen-not-active-at-exam-start"
          );
        }

        previousFullscreen = nextFullscreen;
      }
    );

    electronAPI.getFullScreenState()
      .then((isFullscreen) => {
        if (!active || observedEvent) {
          return;
        }

        previousFullscreen = isFullscreen === true;

        if (previousFullscreen === false) {
          recordFullscreenEvent(
            "fullscreen-not-active-at-exam-start"
          );
        }
      })
      .catch(() => {
        if (active) {
          setFullscreenNotice(
            "Athena could not verify fullscreen state for the exam audit."
          );
        }
      });

    return () => {
      active = false;

      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [
    loadStatus,
    exam?.policy?.recordFullscreenInterruptions,
  ]);

  /*
   * One submission handler serves manual submission and timer expiry.
   */
  async function performSubmission(reason) {
    if (
      submissionLockRef.current ||
      !exam ||
      questions.length === 0
    ) {
      return;
    }

    submissionLockRef.current = true;
    setIsSubmitting(true);
    setSubmissionError("");

    stopTimer();

    try {
      const result = await submitExam({
        exam,
        answers,
        startedAt: startedAtRef.current,
        submittedAt: new Date().toISOString(),
        reason,
        fullscreenEvents: fullscreenEventsRef.current,
      });

      if (typeof onComplete !== "function") {
        throw new Error(
          "The result screen is not connected. " +
          "The result could not be routed to the completion screen."
        );
      }

      /*
       * The parent records the result, stops the camera and
       * switches to ResultPage. The submission lock stays closed.
       */
      onComplete(result);
    } catch (error) {
      submissionLockRef.current = false;

      setIsSubmitting(false);

      setSubmissionError(
        error?.message ||
        "The examination could not be processed. Please try again."
      );

      /*
       * Resume the timer after a failed manual attempt only
       * when time remains. Expiry cannot restart the timer.
       */
      if (
        reason !== "time-expired" &&
        remainingSeconds > 0
      ) {
        startTimer();
      }
    }
  }

  // The timer always calls the latest submission handler.
  submissionHandlerRef.current = performSubmission;

  function handleAnswerChange(questionId, optionId) {
    if (isSubmitting || submissionLockRef.current) {
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

  function handleManualSubmit() {
    if (submissionLockRef.current || isSubmitting) {
      return;
    }

    /*
     * If automatic expiry processing failed, let the student
     * retry that operation rather than trapping them at zero.
     */
    if (
      remainingSeconds <= 0 &&
      submissionError
    ) {
      void performSubmission("time-expired");
      return;
    }

    const message =
      unansweredCount > 0
        ? `You have ${unansweredCount} unanswered question(s). ` +
          "Are you sure you want to submit the examination?"
        : "Are you sure you want to submit your examination? " +
          "You cannot change your answers afterwards.";

    if (window.confirm(message)) {
      void performSubmission("manual");
    }
  }

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
            <h1>No examination questions</h1>

            <p>
              The question source is empty. Athena cannot start an
              examination without questions.
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

  return (
    <main className="exam-page">
      <div className="exam-shell">
        <ExamHeader
          title={exam.title}
          currentQuestionNumber={currentQuestionNumber}
          totalQuestions={totalQuestions}
          remainingSeconds={remainingSeconds}
          source={exam.source}
          onSubmit={handleManualSubmit}
          isSubmitting={isSubmitting}
          submissionError={submissionError}
        />

        {submissionError && (
          <p
            className="exam-message exam-message--error"
            role="alert"
          >
            {submissionError}
          </p>
        )}

        {fullscreenNotice && (
          <p
            className="exam-message exam-message--info exam-policy-notice"
            role="status"
          >
            {fullscreenNotice}
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
              Demonstration mode: answers are held in React state
              and are not saved to a server.
            </p>

            {exam.policy?.recordFullscreenInterruptions && (
              <p className="exam-demo-note">
                Fullscreen events recorded: {fullscreenEvents.length}.
                An interruption alone does not establish misconduct.
              </p>
            )}
          </section>

          <aside className="exam-sidebar">
            <section className="exam-sidebar-card">
              <div className="exam-sidebar-card__heading">
                <h2>Camera status</h2>

                <span
                  className={
                    isCameraReady
                      ? "status-pill status-pill--success"
                      : "status-pill status-pill--warning"
                  }
                >
                  {isCameraReady ? "Active" : "Not available"}
                </span>
              </div>

              {cameraStream ? (
                <>
                  <CameraPreview stream={cameraStream} />

                  <p className="exam-sidebar-card__note">
                    Live preview only. This implementation does
                    not record or upload video.
                  </p>
                </>
              ) : (
                <p className="exam-message exam-message--error">
                  The camera stream is unavailable. The exam timer
                  continues running.
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
                Previous and Next preserve each selected answer.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default ExamPage;