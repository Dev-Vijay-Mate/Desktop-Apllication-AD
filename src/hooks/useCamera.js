import { useEffect, useRef, useState } from "react";

function getCameraErrorMessage(error) {
  switch (error?.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return (
        "Camera access was denied. Allow camera access in the " +
        "permission prompt or macOS privacy settings, then try again."
      );

    case "NotFoundError":
    case "DevicesNotFoundError":
      return (
        "No camera was found. Connect a working camera and try again."
      );

    case "NotReadableError":
    case "TrackStartError":
      return (
        "The camera could not be opened. Another application may " +
        "be using it. Close that application and try again."
      );

    case "OverconstrainedError":
      return (
        "The available camera does not support the requested settings."
      );

    case "SecurityError":
      return (
        "Camera access is blocked in the current application environment."
      );

    default:
      return (
        error?.message ||
        "An unexpected camera error occurred. Please try again."
      );
  }
}

function stopMediaStream(stream) {
  if (!stream) {
    return;
  }

  stream.getTracks().forEach((track) => {
    track.stop();
  });
}

function useCamera() {
  const [stream, setStream] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const streamRef = useRef(null);
  const mountedRef = useRef(false);
  const requestInProgressRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      // Stop the actual hardware stream on unmount.
      stopMediaStream(streamRef.current);
      streamRef.current = null;
    };
  }, []);

  async function requestCamera() {
    if (requestInProgressRef.current) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setError(
        "Camera access is unavailable in this environment. " +
        "Run Athena through Electron or a supported secure context."
      );
      return;
    }

    requestInProgressRef.current = true;

    setStatus("requesting");
    setError("");

    try {
      /*
       * Request video only. The microphone is not requested.
       */
      const newStream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
          },
          audio: false,
        });

      /*
       * A permission prompt might finish after this component
       * has already been unmounted. Stop the new stream in that case.
       */
      if (!mountedRef.current) {
        stopMediaStream(newStream);
        return;
      }

      // Release an old stream before replacing it.
      stopMediaStream(streamRef.current);

      streamRef.current = newStream;

      newStream.getVideoTracks().forEach((track) => {
        track.addEventListener(
          "ended",
          () => {
            if (
              !mountedRef.current ||
              streamRef.current !== newStream
            ) {
              return;
            }

            streamRef.current = null;
            setStream(null);
            setStatus("error");

            setError(
              "The camera stream ended. Check the camera connection " +
              "or permissions and try again."
            );
          },
          { once: true }
        );
      });

      setStream(newStream);
      setStatus("ready");
    } catch (cameraError) {
      if (!mountedRef.current) {
        return;
      }

      setStatus("error");
      setError(getCameraErrorMessage(cameraError));
    } finally {
      requestInProgressRef.current = false;
    }
  }

  /*
   * Stop the current stream explicitly when needed.
   */
  function stopCamera() {
    const currentStream = streamRef.current;

    // Clear the reference before stopping tracks, avoiding stale events.
    streamRef.current = null;

    stopMediaStream(currentStream);

    if (mountedRef.current) {
      setStream(null);
      setStatus("idle");
      setError("");
    }
  }

  return {
    stream,
    status,
    error,
    requestCamera,
    stopCamera,
  };
}

export default useCamera;