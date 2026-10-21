import { useEffect, useRef } from "react";

function CameraPreview({ stream }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const videoElement = videoRef.current;

    if (!videoElement) {
      return undefined;
    }

    // Connect the real MediaStream to the video element.
    videoElement.srcObject = stream ?? null;

    // Remove the old element's reference when the stream changes
    // or the component unmounts. The hook owns stopping the tracks.
    return () => {
      if (videoElement.srcObject === stream) {
        videoElement.srcObject = null;
      }
    };
  }, [stream]);

  if (!stream) {
    return (
      <div
        className="camera-placeholder"
        role="status"
      >
        <span
          className="camera-placeholder__icon"
          aria-hidden="true"
        >
          ◉
        </span>

        <span>
          Your live camera preview will appear here after
          camera access is granted.
        </span>
      </div>
    );
  }

  return (
    <div className="camera-preview">
      <video
        ref={videoRef}
        className="camera-preview__video"
        autoPlay
        muted
        playsInline
        aria-label="Live camera preview"
      />

      <p className="camera-preview__caption">
        Live camera preview. Athena is not recording video in
        this setup phase.
      </p>
    </div>
  );
}

export default CameraPreview;