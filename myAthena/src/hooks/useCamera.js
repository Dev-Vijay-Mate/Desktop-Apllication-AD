import { useEffect, useRef, useState } from "react";

function getCameraErrorMessage(error) {
  switch (error?.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return (
        "Camera access was denied. Allow camera access in the " +
        "permission prompt or your macOS privacy settings, then try again."
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
        "The application is not allowed to access the camera in " +
        "its current environment."
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

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      // Stop the real camera tracks when the hook's component
      // unmounts.
      stopMediaStream(streamRef.current);

      streamRef.current = null;
    };
  }, []);

  async function requestCamera() {
    setError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");

      setError(
        "Camera access is unavailable. Open Athena through Electron " +
        "or a supported secure browser context, and try again."
      );

      return;
    }

    if (status === "requesting") {
      return;
    }

    setStatus("requesting");

    try {
      const newStream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
          },
          audio: false,
        });

      // If the component was removed while the permission prompt
      // was open, do not leave the newly acquired camera running.
      if (!mountedRef.current) {
        stopMediaStream(newStream);
        return;
      }

      // Stop any previously owned stream before replacing it.
      stopMediaStream(streamRef.current);

      streamRef.current = newStream;
      setStream(newStream);
      setStatus("ready");

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
              "and grant access again."
            );
          },
          { once: true }
        );
      });
    } catch (cameraError) {
      if (!mountedRef.current) {
        return;
      }

      setStatus("error");
      setError(getCameraErrorMessage(cameraError));
    }
  }

  return {
    stream,
    status,
    error,
    requestCamera,
  };
}

export default useCamera;