import { useEffect, useRef, useState } from "react";

import PermissionCard from "../components/PermissionCard.jsx";
import CameraPreview from "../components/CameraPreview.jsx";
import useCamera from "../hooks/useCamera.js";

import "../styles/setup-page.css";

function PreflightPage({ onStartExam }) {
  const camera = useCamera();

  const [fullscreenStatus, setFullscreenStatus] =
    useState("idle");

  const [fullscreenMessage, setFullscreenMessage] =
    useState("");

  const [pageNotice, setPageNotice] = useState(null);

  const [dialogMode, setDialogMode] = useState(null);

  const dialogRef = useRef(null);

  /*
   * Open and close the built-in HTML dialog based on React state.
   */
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

  /*
   * Ask Electron to enter fullscreen through the exposed preload API.
   *
   * The interface reports success only if the main process
   * explicitly confirms that fullscreen is active.
   */
  async function requestFullscreen() {
    setPageNotice(null);
    setFullscreenMessage("");

    const electronAPI = window.electronAPI;

    if (typeof electronAPI?.setFullScreen !== "function") {
      setFullscreenStatus("unavailable");

      setFullscreenMessage(
        "Fullscreen integration is not available. The Electron " +
        "preload bridge must expose setFullScreen()."
      );

      return;
    }

    setFullscreenStatus("checking");

    try {
      const result = await electronAPI.setFullScreen();

      if (result === true) {
        setFullscreenStatus("ready");

        setFullscreenMessage(
          "Electron confirmed that fullscreen mode is active."
        );
      } else {
        setFullscreenStatus("unavailable");

        setFullscreenMessage(
          "Electron did not confirm fullscreen mode. Athena has " +
          "not marked this requirement as complete."
        );
      }
    } catch (fullscreenError) {
      setFullscreenStatus("error");

      setFullscreenMessage(
        fullscreenError?.message ||
        "Fullscreen could not be activated. Please try again."
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

  function cancelDialog() {
    setDialogMode(null);
  }

  /*
   * The rules can be accepted even if setup is incomplete.
   * However, the application must not begin the examination
   * until its camera and fullscreen requirements are confirmed.
   */
  function acceptRules() {
    setDialogMode(null);

    if (camera.status !== "ready" || !camera.stream) {
      setPageNotice({
        tone: "warning",
        message:
          "The rules were accepted, but camera access is not ready. " +
          "Enable your camera before continuing.",
      });

      return;
    }

    if (fullscreenStatus !== "ready") {
      setPageNotice({
        tone: "warning",
        message:
          "The rules were accepted, but fullscreen mode has not " +
          "been confirmed by Electron. Athena cannot continue until " +
          "fullscreen integration is working.",
      });

      return;
    }

    if (typeof onStartExam === "function") {
      onStartExam();
      return;
    }

    setPageNotice({
      tone: "success",
      message:
        "The setup checks are complete. Exam navigation has not " +
        "been connected in this phase.",
    });
  }

  const cameraStatusLabel = {
    idle: "Not configured",
    requesting: "Requesting access",
    ready: "Camera connected",
    error: "Needs attention",
  }[camera.status];

  const cameraStatusTone = {
    idle: "neutral",
    requesting: "warning",
    ready: "success",
    error: "danger",
  }[camera.status];

  const fullscreenStatusLabel = {
    idle: "Not confirmed",
    checking: "Checking",
    ready: "Fullscreen active",
    unavailable: "Not confirmed",
    error: "Needs attention",
  }[fullscreenStatus];

  const fullscreenStatusTone = {
    idle: "neutral",
    checking: "warning",
    ready: "success",
    unavailable: "warning",
    error: "danger",
  }[fullscreenStatus];

  const fullscreenDescription =
    fullscreenMessage ||
    "Athena will mark fullscreen as ready only after Electron confirms it.";

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
              "Allow camera access and make sure your camera " +
              "is working before beginning the examination."
            }
            status={cameraStatusLabel}
            statusTone={cameraStatusTone}
            actionLabel={
              camera.status === "requesting"
                ? "Requesting Camera..."
                : camera.status === "ready"
                  ? "Camera Connected"
                  : camera.status === "error"
                    ? "Try Again"
                    : "Get Camera Access"
            }
            actionVariant="primary"
            actionDisabled={
              camera.status === "requesting" ||
              camera.status === "ready"
            }
            onAction={camera.requestCamera}
          >
            <CameraPreview stream={camera.stream} />

            {camera.error && (
              <p
                className="permission-card__message permission-card__message--error"
                role="alert"
              >
                {camera.error}
              </p>
            )}
          </PermissionCard>

          <div className="permission-divider" aria-hidden="true" />

          <PermissionCard
            id="fullscreen"
            icon="⛶"
            title="Switch to Full Screen"
            description={
              "Use fullscreen mode during your examination " +
              "to keep the test interface clearly visible."
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
            supportingMessage={fullscreenDescription}
            supportingMessageTone={
              fullscreenStatus === "error" ? "error" : "info"
            }
          />
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
            cancelDialog();
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
                  Please review these requirements before
                  proceeding to your examination.
                </p>

                <ol className="rules-dialog__list">
                  <li>
                    Keep your camera enabled throughout the
                    examination.
                  </li>

                  <li>
                    Remain in fullscreen mode when required
                    by the examination.
                  </li>

                  <li>
                    Do not use unauthorized applications or
                    external assistance.
                  </li>

                  <li>
                    Follow your examination instructions and
                    submit your answers before finishing.
                  </li>
                </ol>

                <div className="rules-dialog__actions">
                  <button
                    type="button"
                    className="button button--outline"
                    onClick={cancelDialog}
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
                  Try these steps if you cannot complete the
                  examination setup.
                </p>

                <ol className="rules-dialog__list">
                  <li>
                    Allow camera access when macOS displays
                    the permission prompt.
                  </li>

                  <li>
                    If the camera does not work, check your
                    macOS camera privacy settings.
                  </li>

                  <li>
                    If fullscreen cannot be confirmed, the
                    Electron fullscreen integration needs
                    to be configured.
                  </li>
                </ol>

                <div className="rules-dialog__actions">
                  <button
                    type="button"
                    className="button button--primary"
                    onClick={cancelDialog}
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