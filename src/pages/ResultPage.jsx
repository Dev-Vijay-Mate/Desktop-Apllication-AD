import "../styles/exam-page.css";

function formatTimestamp(timestamp) {
  const parsedTime = Date.parse(timestamp);

  if (!Number.isFinite(parsedTime)) {
    return "Unknown time";
  }

  return new Date(parsedTime).toLocaleString();
}

function getEventLabel(type) {
  switch (type) {
    case "fullscreen-exited":
      return "Fullscreen exited";

    case "fullscreen-restored":
      return "Fullscreen restored";

    case "fullscreen-not-active-at-exam-start":
      return "Fullscreen not active at exam start";

    default:
      return "Recorded examination event";
  }
}

function ResultPage({
  result,
  onReturnToSetup,
}) {
  const hasServerConfirmation =
    result?.submissionStatus === "server-confirmed" &&
    result?.serverConfirmed === true &&
    typeof result?.submissionId === "string" &&
    result.submissionId.trim() !== "";

  const isLocalDemo =
    result?.submissionStatus === "local-demo" &&
    result?.source === "demo" &&
    result?.persistence === "local-only" &&
    result?.serverConfirmed === false;

  const events = Array.isArray(result?.fullscreenEvents)
    ? result.fullscreenEvents
    : [];

  const heading = hasServerConfirmation
    ? "Submission confirmed"
    : isLocalDemo
      ? "Demonstration completed"
      : "Submission status unverified";

  return (
    <main className="exam-page">
      <div className="exam-shell">
        <section className="exam-completion-card">
          <div
            className={
              hasServerConfirmation || isLocalDemo
                ? "exam-completion-card__icon"
                : "exam-state-card__icon"
            }
            aria-hidden="true"
          >
            {hasServerConfirmation || isLocalDemo ? "✓" : "!"}
          </div>

          <p className="exam-header__brand">ATHENA</p>

          <h1>{heading}</h1>

          <p className="exam-completion-card__subtitle">
            {result?.examTitle || "Athena Examination"}
          </p>

          {hasServerConfirmation ? (
            <>
              <span className="exam-source-badge">
                BACKEND CONFIRMED
              </span>

              <p className="exam-message exam-message--info">
                The backend confirmed this submission.
                Reference: {result.submissionId}
              </p>
            </>
          ) : isLocalDemo ? (
            <>
              <span className="exam-source-badge exam-source-badge--demo">
                LOCAL DEMONSTRATION RESULT
              </span>

              <p className="exam-message exam-message--info">
                {result.message ||
                  "This result was calculated locally."}
                {" "}No server submission is claimed.
              </p>
            </>
          ) : (
            <p className="exam-message exam-message--error" role="alert">
              Athena cannot verify that the examination was
              accepted by a backend. Do not treat this screen
              as proof of a server-confirmed submission.
            </p>
          )}

          {result && (
            <div className="exam-result-grid">
              {Number.isFinite(result.totalQuestions) && (
                <div className="exam-result-metric">
                  <span>Total questions</span>
                  <strong>{result.totalQuestions}</strong>
                </div>
              )}

              {Number.isFinite(result.answeredCount) && (
                <div className="exam-result-metric">
                  <span>Answered</span>
                  <strong>{result.answeredCount}</strong>
                </div>
              )}

              {Number.isFinite(result.unansweredCount) && (
                <div className="exam-result-metric">
                  <span>Unanswered</span>
                  <strong>{result.unansweredCount}</strong>
                </div>
              )}

              {Number.isFinite(result.correctCount) && (
                <div className="exam-result-metric">
                  <span>Correct demonstration answers</span>
                  <strong>{result.correctCount}</strong>
                </div>
              )}

              {Number.isFinite(result.scorePercentage) && (
                <div className="exam-result-metric">
                  <span>Demonstration score</span>
                  <strong>{result.scorePercentage}%</strong>
                </div>
              )}

              {result.reason && (
                <div className="exam-result-metric">
                  <span>Submission reason</span>
                  <strong>
                    {result.reason === "time-expired"
                      ? "Time expired"
                      : "Manual"}
                  </strong>
                </div>
              )}

              {result.submittedAt && (
                <div className="exam-result-metric">
                  <span>Processed at</span>
                  <strong className="exam-result-metric__timestamp">
                    {formatTimestamp(result.submittedAt)}
                  </strong>
                </div>
              )}
            </div>
          )}

          <section className="exam-audit-section">
            <h2>Fullscreen activity log</h2>

            <p>
              {result?.policy?.recordFullscreenInterruptions
                ? "Fullscreen events were recorded according to this exam's configured policy."
                : "Fullscreen interruption logging was not enabled for this exam."}
            </p>

            {events.length > 0 ? (
              <ol className="exam-audit-list">
                {events.map((event, index) => (
                  <li
                    className="exam-audit-event"
                    key={`${event.type}-${event.occurredAt}-${index}`}
                  >
                    <span className="exam-audit-event__label">
                      {getEventLabel(event.type)}
                    </span>

                    <time dateTime={event.occurredAt}>
                      {formatTimestamp(event.occurredAt)}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="exam-message exam-message--info">
                No fullscreen events were recorded in this session.
              </p>
            )}

            <p className="exam-audit-disclaimer">
              A fullscreen interruption is an operational event.
              It does not, by itself, establish cheating or misconduct.
            </p>
          </section>

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

export default ResultPage;