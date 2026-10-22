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
    useState("Fullscreen has not been confirmed.");

  const [pageNotice, setPageNotice] = useState(null);
  const [dialogMode, setDialogMode] = useState(null);

  const dialogRef = useRef(null);

  /*
   * Subscribe to fullscreen changes and read the initial state.
   */
  useEffect(() => {
    let active = true;

    const electronAPI = window.electronAPI;

    if (
      typeof electronAPI?.onFullscreenChanged === "function"
    ) {
      const unsubscribe = electronAPI.onFullscreenChanged(
        (isFullscreen) => {
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
              "Fullscreen is not active. Enable it before starting the examination."
            );
          }
        }
      );

      // Save the cleanup function on the effect instance.
      cleanupSubscription = unsubscribe;
    }

    if (
      typeof electronAPI?.getFullScreenState === "function"
    ) {
      electronAPI.getFullScreenState()
        .then((isFullscreen) => {
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
      setFullscreenStatus("unavailable");

      setFullscreenMessage(
        "The Electron fullscreen bridge is unavailable."
      );
    }

    return () => {
      active = false;

      if (typeof cleanupSubscription === "function") {
        cleanupSubscription();
      }
    };

    // This effect subscribes once for this page instance.
  }, []);

  /*
   * Keep the native HTML dialog synchronized with React state.
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

  async function requestFullscreen() {
    setPageNotice(null);

    const electronAPI = window.electronAPI;

    if (typeof electronAPI?.setFullScreen !== "function") {
      setFullscreenStatus("unavailable");

      setFullscreenMessage(
        "The Electron fullscreen API is unavailable."
      );

      return;
    }

    setFullscreenStatus("checking");

    setFullscreenMessage(
      "Waiting for Electron to confirm fullscreen mode."
    );

    try {
      const confirmed = await electronAPI.setFullScreen(true);

      if (confirmed === true) {
        setFullscreenStatus("ready");

        setFullscreenMessage(
          "Electron confirmed that fullscreen mode is active."
        );
      } else {
        setFullscreenStatus("unavailable");

        setFullscreenMessage(
          "Fullscreen could not be confirmed. Try again."
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
          "Camera access is no longer ready. Enable your camera before continuing.",
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
      return;
    }

    setPageNotice({
      tone: "success",
      message:
        "Setup checks are complete. Exam navigation has not been connected in this phase.",
    });
  }

  const isCameraReady =
    camera.status === "ready" &&
    Boolean(camera.stream) &&
    camera.stream.getVideoTracks().some(
      (track) => track.readyState === "live"
    );

  const setupReady =
    isCameraReady &&
    fullscreenStatus === "ready";

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
              "Athena verifies the actual Electron window state."
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
                    Submit your answers before the examination
                    deadline.
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
                  Try these steps if you cannot complete the
                  examination setup.
                </p>

                <ol className="rules-dialog__list">
                  <li>
                    Allow camera access when macOS displays
                    the permission prompt.
                  </li>

                  <li>
                    If the camera does not work, check macOS
                    Privacy &amp; Security camera settings.
                  </li>

                  <li>
                    If fullscreen cannot be confirmed, check
                    the Electron main process and preload bridge.
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