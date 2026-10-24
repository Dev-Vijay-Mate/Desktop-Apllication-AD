import { useEffect, useRef, useState } from "react";

import PermissionCard from "../components/PermissionCard.jsx";
import CameraPreview from "../components/CameraPreview.jsx";

import "../styles/setup-page.css";

function PreflightPage({ onStartExam, camera }) {
  const [fullscreenStatus, setFullscreenStatus] =
    useState("idle");

  const [fullscreenMessage, setFullscreenMessage] =
    useState("Fullscreen has not been confirmed.");

  const [pageNotice, setPageNotice] = useState(null);
  const [dialogMode, setDialogMode] = useState(null);

  const dialogRef = useRef(null);

  const cameraStatus = camera?.status ?? "idle";
  const cameraStream = camera?.stream ?? null;
  const cameraError = camera?.error ?? "";

  const isCameraReady =
    cameraStatus === "ready" &&
    Boolean(cameraStream) &&
    cameraStream.getVideoTracks().some(
      (track) => track.readyState === "live"
    );

  const setupReady =
    isCameraReady && fullscreenStatus === "ready";

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    const electronAPI = window.electronAPI;

    if (
      typeof electronAPI?.onFullscreenChanged !== "function" &&
      typeof document.addEventListener === "function"
    ) {
      const updateBrowserFullscreen = () => {
        if (!active) {
          return;
        }

        const isFullscreen = Boolean(document.fullscreenElement);
        setFullscreenStatus(isFullscreen ? "ready" : "idle");
        setFullscreenMessage(
          isFullscreen
            ? "Browser confirmed that fullscreen mode is active."
            : "Fullscreen is not active. Enable it before continuing."
        );
      };

      document.addEventListener(
        "fullscreenchange",
        updateBrowserFullscreen
      );
      updateBrowserFullscreen();

      return () => {
        active = false;
        document.removeEventListener(
          "fullscreenchange",
          updateBrowserFullscreen
        );
      };
    }

    if (
      typeof electronAPI?.onFullscreenChanged === "function"
    ) {
      const removeListener =
        electronAPI.onFullscreenChanged((isFullscreen) => {
          if (!active) {
            return;
          }

          if (isFullscreen) {
            setFullscreenStatus("ready");
            setFullscreenMessage(
              "Electron confirmed that fullscreen mode is active."
            );
          } else {
            setFullscreenStatus("idle");
            setFullscreenMessage(
              "Fullscreen is not active. Enable it before continuing."
            );
          }
        });

      if (typeof removeListener === "function") {
        unsubscribe = removeListener;
      }
    }

    if (
      typeof electronAPI?.getFullScreenState === "function"
    ) {
      electronAPI.getFullScreenState()
        .then((isFullscreen) => {
          if (!active) {
            return;
          }

          if (isFullscreen === true) {
            setFullscreenStatus("ready");
            setFullscreenMessage(
              "Electron confirmed that fullscreen mode is active."
            );
          } else {
            setFullscreenStatus("idle");
            setFullscreenMessage(
              "Fullscreen has not been enabled yet."
            );
          }
        })
        .catch(() => {
          if (!active) {
            return;
          }

          setFullscreenStatus("error");
          setFullscreenMessage(
            "Athena could not read the fullscreen state from Electron."
          );
        });
    } else {
      setFullscreenStatus("idle");
      setFullscreenMessage(
        "Use the browser fullscreen control before continuing."
      );
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (dialogMode && !dialog.open) {
      dialog.showModal();
    } else if (!dialogMode && dialog.open) {
      dialog.close();
    }
  }, [dialogMode]);

  async function requestFullscreen() {
    setPageNotice(null);

    const electronAPI = window.electronAPI;

    if (typeof electronAPI?.setFullScreen !== "function") {
      if (typeof document.documentElement.requestFullscreen !== "function") {
        setFullscreenStatus("unavailable");
        setFullscreenMessage(
          "Fullscreen is not supported by this browser."
        );
        return;
      }

      setFullscreenStatus("checking");
      setFullscreenMessage(
        "Waiting for the browser to confirm fullscreen mode."
      );

      try {
        await document.documentElement.requestFullscreen();
        setFullscreenStatus("ready");
        setFullscreenMessage(
          "Browser confirmed that fullscreen mode is active."
        );
      } catch (error) {
        setFullscreenStatus("error");
        setFullscreenMessage(
          error?.message ||
          "The browser could not enable fullscreen mode."
        );
      }

      return;
    }

    setFullscreenStatus("checking");
    setFullscreenMessage(
      "Waiting for Electron to confirm fullscreen mode."
    );

    try {
      const confirmed =
        await electronAPI.setFullScreen(true);

      if (confirmed === true) {
        setFullscreenStatus("ready");
        setFullscreenMessage(
          "Electron confirmed that fullscreen mode is active."
        );
      } else {
        setFullscreenStatus("unavailable");
        setFullscreenMessage(
          "Fullscreen could not be confirmed. Please try again."
        );
      }
    } catch (error) {
      setFullscreenStatus("error");
      setFullscreenMessage(
        error?.message ||
        "An error occurred while requesting fullscreen."
      );
    }
  }

  function openRulesDialog() {
    setPageNotice(null);
    setDialogMode("rules");
  }

  function openHelpDialog() {
    setDialogMode("help");
  }

  function closeDialog() {
    setDialogMode(null);
  }

  function acceptRules() {
    setDialogMode(null);

    if (!isCameraReady) {
      setPageNotice({
        tone: "warning",
        message:
          "Camera access is not ready. Enable your camera before continuing.",
      });
      return;
    }

    if (fullscreenStatus !== "ready") {
      setPageNotice({
        tone: "warning",
        message:
          "Fullscreen is not active. Enable fullscreen before continuing.",
      });
      return;
    }

    if (typeof onStartExam === "function") {
      onStartExam();
    }
  }

  const cameraStatusLabel = {
    idle: "Not configured",
    requesting: "Requesting access",
    ready: "Camera connected",
    error: "Needs attention",
  }[cameraStatus] ?? "Not configured";

  const cameraStatusTone = {
    idle: "neutral",
    requesting: "warning",
    ready: "success",
    error: "danger",
  }[cameraStatus] ?? "neutral";

  const fullscreenStatusLabel = {
    idle: "Not confirmed",
    checking: "Checking",
    ready: "Fullscreen active",
    unavailable: "Not confirmed",
    error: "Needs attention",
  }[fullscreenStatus] ?? "Not confirmed";

  const fullscreenStatusTone = {
    idle: "neutral",
    checking: "warning",
    ready: "success",
    unavailable: "warning",
    error: "danger",
  }[fullscreenStatus] ?? "neutral";

  const readinessItems = [
    {
      label: "Camera access",
      detail: isCameraReady
        ? "Camera connected and ready."
        : "Camera access is required.",
      ready: isCameraReady,
    },
    {
      label: "Fullscreen mode",
      detail: fullscreenStatus === "ready"
        ? "Fullscreen is confirmed."
        : "Fullscreen must be confirmed before starting.",
      ready: fullscreenStatus === "ready",
    },
    {
      label: "Exam readiness",
      detail: setupReady
        ? "All required checks are complete."
        : "Complete the remaining checks to continue.",
      ready: setupReady,
    },
  ];

  return (
    <main className="preflight-page">
      <div className="preflight-shell">
        <header className="preflight-greeting">
          <h1>Welcome to Athena</h1>

          <p>
            Before we begin, please check your camera and
            fullscreen settings.
          </p>
        </header>

        <section
          className="preflight-panel"
          aria-label="Examination setup requirements"
        >
          <PermissionCard
            id="camera"
            icon="◉"
            title="Configure Camera"
            description={
              "Allow camera access and check that the camera " +
              "is working before beginning the examination."
            }
            status={cameraStatusLabel}
            statusTone={cameraStatusTone}
            actionLabel={
              cameraStatus === "requesting"
                ? "Requesting Camera..."
                : cameraStatus === "ready"
                  ? "Camera Connected"
                  : cameraStatus === "error"
                    ? "Try Again"
                    : "Get Camera Access"
            }
            actionVariant="primary"
            actionDisabled={
              cameraStatus === "requesting" ||
              cameraStatus === "ready"
            }
            onAction={() => camera?.requestCamera?.()}
          >
            <CameraPreview stream={cameraStream} />

            {cameraError && (
              <p
                className="permission-card__message permission-card__message--error"
                role="alert"
              >
                {cameraError}
              </p>
            )}
          </PermissionCard>

          <div
            className="permission-divider"
            aria-hidden="true"
          />

          <PermissionCard
            id="fullscreen"
            icon="⛶"
            title="Switch to Full Screen"
            description={
              "Enter fullscreen mode for your examination. " +
              "Athena checks the actual Electron window state."
            }
            status={fullscreenStatusLabel}
            statusTone={fullscreenStatusTone}
            actionLabel={
              fullscreenStatus === "checking"
                ? "Checking Fullscreen..."
                : fullscreenStatus === "ready"
                  ? "Fullscreen Active"
                  : "Enable Full Screen"
            }
            actionVariant="soft"
            actionDisabled={
              fullscreenStatus === "checking" ||
              fullscreenStatus === "ready"
            }
            onAction={requestFullscreen}
            supportingMessage={fullscreenMessage}
            supportingMessageTone={
              fullscreenStatus === "error"
                ? "error"
                : "info"
            }
          />
        </section>

        <section
          className="readiness-checklist"
          aria-labelledby="readiness-checklist-title"
        >
          <div className="readiness-checklist__heading">
            <div>
              <p className="readiness-checklist__eyebrow">
                Before you begin
              </p>

              <h2 id="readiness-checklist-title">
                Readiness checklist
              </h2>
            </div>

            <span
              className={
                setupReady
                  ? "status-pill status-pill--success"
                  : "status-pill status-pill--warning"
              }
            >
              {setupReady ? "Ready to begin" : "Action required"}
            </span>
          </div>

          <ul className="readiness-checklist__items">
            {readinessItems.map((item) => (
              <li
                className={
                  item.ready
                    ? "readiness-checklist__item readiness-checklist__item--ready"
                    : "readiness-checklist__item"
                }
                key={item.label}
              >
                <span
                  className="readiness-checklist__indicator"
                  aria-hidden="true"
                >
                  {item.ready ? "✓" : "!"}
                </span>

                <span className="readiness-checklist__copy">
                  <strong>{item.label}</strong>
                  <span>{item.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {pageNotice && (
          <div
            className={`setup-notice setup-notice--${pageNotice.tone}`}
            role={
              pageNotice.tone === "warning"
                ? "alert"
                : "status"
            }
          >
            {pageNotice.message}
          </div>
        )}

        <footer className="preflight-actions">
          <button
            type="button"
            className="button button--primary"
            onClick={openRulesDialog}
            disabled={!setupReady}
            title={
              setupReady
                ? "Review the examination rules"
                : "Enable the camera and confirm fullscreen first"
            }
          >
            Go To Test
          </button>

          <button
            type="button"
            className="button button--outline"
            onClick={openHelpDialog}
          >
            Need Help?
          </button>
        </footer>

        <dialog
          ref={dialogRef}
          className="rules-dialog"
          aria-labelledby={
            dialogMode === "help"
              ? "help-dialog-title"
              : "rules-dialog-title"
          }
          onCancel={(event) => {
            event.preventDefault();
            closeDialog();
          }}
          onClose={() => {
            setDialogMode(null);
          }}
        >
          <div className="rules-dialog__content">
            {dialogMode === "rules" ? (
              <>
                <p className="rules-dialog__eyebrow">
                  Before you begin
                </p>

                <h2
                  className="rules-dialog__title"
                  id="rules-dialog-title"
                >
                  Examination Rules
                </h2>

                <p className="rules-dialog__description">
                  Review these requirements before proceeding.
                </p>

                <ol className="rules-dialog__list">
                  <li>
                    Keep your camera enabled during the examination.
                  </li>
                  <li>
                    Remain in fullscreen mode as required.
                  </li>
                  <li>
                    Do not use unauthorized applications or assistance.
                  </li>
                  <li>
                    Submit your answers before the deadline.
                  </li>
                </ol>

                <div className="rules-dialog__actions">
                  <button
                    type="button"
                    className="button button--outline"
                    onClick={closeDialog}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="button button--primary"
                    onClick={acceptRules}
                  >
                    Accept
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="rules-dialog__eyebrow">
                  Athena support
                </p>

                <h2
                  className="rules-dialog__title"
                  id="help-dialog-title"
                >
                  Need Help?
                </h2>

                <p className="rules-dialog__description">
                  Try these steps if you cannot complete setup.
                </p>

                <ol className="rules-dialog__list">
                  <li>
                    Allow camera access in the macOS permission prompt.
                  </li>
                  <li>
                    Check macOS Privacy &amp; Security settings if the
                    camera is unavailable.
                  </li>
                  <li>
                    If fullscreen is not confirmed, check the Electron
                    main process and preload bridge.
                  </li>
                </ol>

                <div className="rules-dialog__actions">
                  <button
                    type="button"
                    className="button button--primary"
                    onClick={closeDialog}
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </dialog>
      </div>
    </main>
  );
}

export default PreflightPage;