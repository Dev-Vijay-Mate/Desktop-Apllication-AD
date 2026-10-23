import formatTime from "../utils/formatTime.js";

function ExamHeader({
  title,
  currentQuestionNumber,
  totalQuestions,
  remainingSeconds,
  source = "demo",
  onSubmit,
  isSubmitting = false,
  submissionError = "",
}) {
  const formattedTime = formatTime(remainingSeconds);

  const isLowTime =
    remainingSeconds > 0 && remainingSeconds <= 60;

  const isExpired = remainingSeconds <= 0;

  return (
    <header className="exam-header">
      <div className="exam-header__top">
        <div className="exam-header__identity">
          <p className="exam-header__brand">ATHENA</p>

          <h1 className="exam-header__title">
            {title}
          </h1>

          <span
            className={
              source === "demo"
                ? "exam-source-badge exam-source-badge--demo"
                : "exam-source-badge"
            }
          >
            {source === "demo"
              ? "DEMONSTRATION EXAM"
              : "EXAM"}
          </span>
        </div>

        <div className="exam-header__timer">
          <span className="exam-header__timer-label">
            Time remaining
          </span>

          <strong
            className={[
              "exam-header__timer-value",
              isLowTime
                ? "exam-header__timer-value--warning"
                : "",
              isExpired
                ? "exam-header__timer-value--expired"
                : "",
            ].filter(Boolean).join(" ")}
            aria-label={`Time remaining ${formattedTime}`}
          >
            {formattedTime}
          </strong>

          {isLowTime && (
            <span className="exam-header__timer-hint">
              Less than one minute
            </span>
          )}
        </div>
      </div>

      <div className="exam-header__bottom">
        <p className="exam-header__progress">
          Question{" "}
          <strong>{currentQuestionNumber}</strong>
          {" "}of{" "}
          <strong>{totalQuestions}</strong>
        </p>

        <button
          type="button"
          className="button button--danger"
          onClick={onSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "Submitting..."
            : submissionError
              ? "Retry Submission"
              : "Submit Exam"}
        </button>
      </div>
    </header>
  );
}

export default ExamHeader;