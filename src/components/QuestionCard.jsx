function QuestionCard({
  question,
  questionNumber,
  selectedOptionId,
  onAnswerChange,
  disabled = false,
}) {
  if (!question) {
    return (
      <section className="question-card">
        <p className="exam-message exam-message--error">
          This question could not be displayed.
        </p>
      </section>
    );
  }

  const options = Array.isArray(question.options)
    ? question.options
    : [];

  return (
    <section
      className="question-card"
      aria-labelledby={`question-title-${question.id}`}
    >
      <div className="question-card__eyebrow">
        Question {questionNumber}
      </div>

      <h2
        className="question-card__title"
        id={`question-title-${question.id}`}
      >
        {question.question}
      </h2>

      {options.length === 0 ? (
        <p className="exam-message exam-message--error">
          No answer options are available for this question.
        </p>
      ) : (
        <fieldset
          className="question-card__options"
          disabled={disabled}
        >
          <legend className="question-card__legend">
            Select one answer
          </legend>

          {options.map((option) => {
            const inputId =
              `answer-${question.id}-${option.id}`;

            return (
              <label
                className={
                  selectedOptionId === option.id
                    ? "answer-option answer-option--selected"
                    : "answer-option"
                }
                htmlFor={inputId}
                key={option.id}
              >
                <input
                  id={inputId}
                  type="radio"
                  name={`question-${question.id}`}
                  value={option.id}
                  checked={selectedOptionId === option.id}
                  onChange={() => {
                    onAnswerChange(question.id, option.id);
                  }}
                />

                <span className="answer-option__letter">
                  {option.id.toUpperCase()}
                </span>

                <span className="answer-option__text">
                  {option.text}
                </span>
              </label>
            );
          })}
        </fieldset>
      )}
    </section>
  );
}

export default QuestionCard;