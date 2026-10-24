function PermissionCard({
  id,
  icon,
  title,
  description,
  status,
  statusTone = "neutral",
  actionLabel,
  onAction,
  actionVariant = "primary",
  actionDisabled = false,
  supportingMessage,
  supportingMessageTone = "info",
  children,
}) {
  const titleId = `permission-card-title-${id}`;

  return (
    <section
      className="permission-card"
      aria-labelledby={titleId}
    >
      <div className="permission-card__header">
        <div
          className="permission-card__icon"
          aria-hidden="true"
        >
          {icon}
        </div>

        <div className="permission-card__copy">
          <h2
            className="permission-card__title"
            id={titleId}
          >
            {title}
          </h2>

          <p className="permission-card__description">
            {description}
          </p>
        </div>

        {status && (
          <span
            className={`status-pill status-pill--${statusTone}`}
          >
            {status}
          </span>
        )}
      </div>

      {children && (
        <div className="permission-card__content">
          {children}
        </div>
      )}

      {supportingMessage && (
        <p
          className={`permission-card__message permission-card__message--${supportingMessageTone}`}
          role={
            supportingMessageTone === "error"
              ? "alert"
              : "status"
          }
        >
          {supportingMessage}
        </p>
      )}

      <div className="permission-card__actions">
        <button
          type="button"
          className={`button button--${actionVariant}`}
          onClick={onAction}
          disabled={actionDisabled}
        >
          {actionLabel}
        </button>
      </div>
    </section>
  );
}

export default PermissionCard;