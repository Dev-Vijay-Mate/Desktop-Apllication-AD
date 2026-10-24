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
  const [answerSaveStatus, setAnswerSaveStatus] =
    useState("not-started");

  const [fullscreenEvents, setFullscreenEvents] = useState([]);
  const [fullscreenNotice, setFullscreenNotice] = useState("");
  const [examModeError, setExamModeError] = useState("");
  const [isWindowActive, setIsWindowActive] = useState(true);

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

  async function initialiseExam() {
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

      setLoadError("");
      setSubmissionError("");
      setAnswerSaveStatus("not-started");
      setExam(loadedExam);

      setAnswers({});
      setCurrentIndex(0);
      setIsSubmitting(false);

      setFullscreenEvents([]);
      fullscreenEventsRef.current = [];
      setFullscreenNotice("");

      submissionLockRef.current = false;
      startedAtRef.current = null;

      if (loadedExam.questions.length === 0) {
        setLoadStatus("empty");
        return;
      }

      startedAtRef.current = new Date().toISOString();

      resetTimer(
        loadedExam.durationSeconds ?? durationSeconds
      );

      setLoadStatus("ready");
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
  };
}, [
  loadAttempt,
  durationSeconds,
  resetTimer,
  startTimer,
]);

  const questions = Array.isArray(exam?.questions)
    ? exam.questions
    : [];

  const totalQuestions = questions.length;
  const currentQuestion = questions[currentIndex] ?? null;

  const currentQuestionNumber =
    totalQuestions > 0 ? currentIndex + 1 : 0;

  function getSelectedOptionId(question) {
    const selectedOptionId = answers[question.id];

    return question.options.some(
      (option) => option.id === selectedOptionId
    )
      ? selectedOptionId
      : "";
  }

  function isQuestionAnswered(question) {
    return getSelectedOptionId(question) !== "";
  }

  const answeredCount = questions.filter((question) =>
    isQuestionAnswered(question)
  ).length;

  const unansweredCount =
    totalQuestions - answeredCount;

  const isCameraReady =
    cameraStatus === "ready" &&
    Boolean(cameraStream) &&
    cameraStream.getVideoTracks().some(
      (track) => track.readyState === "live"
    );

  useEffect(() => {
    function updateWindowActivity() {
      setIsWindowActive(
        document.visibilityState === "visible" &&
        document.hasFocus()
      );
    }

    updateWindowActivity();

    window.addEventListener("focus", updateWindowActivity);
    window.addEventListener("blur", updateWindowActivity);
    document.addEventListener(
      "visibilitychange",
      updateWindowActivity
    );

    return () => {
      window.removeEventListener("focus", updateWindowActivity);
      window.removeEventListener("blur", updateWindowActivity);
      document.removeEventListener(
        "visibilitychange",
        updateWindowActivity
      );
    };
  }, []);

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

  useEffect(() => {
    if (loadStatus !== "ready") {
      return undefined;
    }

    const setExamMode = window.electronAPI?.setExamMode;

    if (typeof setExamMode !== "function") {
      setExamModeError("");
      return () => {
        if (document.fullscreenElement) {
          void document.exitFullscreen?.();
        }
      };
    }

    let active = true;

    setExamMode(true).then((enabled) => {
      if (active && enabled !== true) {
        setExamModeError(
          "Athena could not secure the exam window. " +
          "Please return to setup and try again."
        );
      }
    }).catch(() => {
      if (active) {
        setExamModeError(
          "Athena could not secure the exam window. " +
          "Please return to setup and try again."
        );
      }
    });

    return () => {
      active = false;
      void setExamMode(false);
    };
  }, [loadStatus]);

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
    setAnswerSaveStatus("saved");
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

        {examModeError && (
          <p
            className="exam-message exam-message--error"
            role="alert"
          >
            {examModeError}
          </p>
        )}

        {!isWindowActive && (
          <p
            className="exam-message exam-message--error"
            role="alert"
          >
            Athena is not the active window. Return to the exam
            window to continue.
          </p>
        )}

        <div className="exam-layout">
          <section className="exam-main">
            <QuestionCard
              question={currentQuestion}
              questionNumber={currentQuestionNumber}
              selectedOptionId={
                currentQuestion
                  ? getSelectedOptionId(currentQuestion)
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

            <p
              className="exam-answer-save-status"
              role="status"
              aria-live="polite"
            >
              {answerSaveStatus === "saved"
                ? "Answer saved for this session. It has not been sent to a server."
                : "Select an answer to save it for this session."}
            </p>

          </section>

          <aside className="exam-sidebar">
            <section className="exam-sidebar-card">
              <div className="exam-sidebar-card__heading">
                <h2>Camera status</h2>

                <span
                  className={
                    !isWindowActive
                      ? "status-pill status-pill--danger"
                      : isCameraReady
                      ? "status-pill status-pill--success"
                      : "status-pill status-pill--warning"
                  }
                >
                  {!isWindowActive
                    ? "Window inactive"
                    : isCameraReady
                      ? "Camera active"
                      : "Camera unavailable"}
                </span>
              </div>

              {cameraStream ? (
                <CameraPreview stream={cameraStream} />
              ) : (
                <p className="exam-message exam-message--error">
                  The camera stream is unavailable. The exam timer
                  continues running.
                </p>
              )}
            </section>

            <section className="exam-sidebar-card exam-question-nav">
              <div className="exam-sidebar-card__heading">
                <h2>Question navigator</h2>

                <span className="exam-question-nav__count">
                  {answeredCount}/{totalQuestions}
                </span>
              </div>

              <p className="exam-sidebar-card__note">
                Select a question to jump directly to it.
              </p>

              <div
                className="exam-question-nav__grid"
                role="group"
                aria-label="Question navigator"
              >
                {questions.map((question, index) => {
                  const answered = isQuestionAnswered(question);
                  const isCurrent = index === currentIndex;

                  return (
                    <button
                      type="button"
                      className={[
                        "exam-question-nav__button",
                        isCurrent
                          ? "exam-question-nav__button--current"
                          : "",
                        answered
                          ? "exam-question-nav__button--answered"
                          : "",
                      ].filter(Boolean).join(" ")}
                      aria-current={isCurrent ? "step" : undefined}
                      aria-label={[
                        `Go to question ${index + 1}`,
                        answered ? "answered" : "not answered",
                        isCurrent ? "current question" : "",
                      ].filter(Boolean).join(", ")}
                      onClick={() => setCurrentIndex(index)}
                      disabled={isSubmitting}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>

              <div className="exam-question-nav__legend">
                <span>
                  <i className="exam-question-nav__dot exam-question-nav__dot--answered" />
                  Answered
                </span>
                <span>
                  <i className="exam-question-nav__dot" />
                  Unanswered
                </span>
              </div>
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

            <details className="exam-sidebar-card exam-session-info">
              <summary>Session information</summary>

              <div className="exam-session-info__content">
                <p>
                  Demo session. Answers remain on this screen and
                  are not sent to a server.
                </p>

                <p>
                  {exam.policy?.recordFullscreenInterruptions
                    ? `${fullscreenEvents.length} fullscreen event${
                        fullscreenEvents.length === 1 ? "" : "s"
                      } recorded for this session.`
                    : "Fullscreen activity is not recorded for this session."}
                </p>

                {fullscreenNotice && (
                  <p className="exam-session-info__notice">
                    {fullscreenNotice}
                  </p>
                )}

                <p>
                  Fullscreen activity is an operational record and
                  does not by itself indicate misconduct.
                </p>
              </div>
            </details>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default ExamPage;