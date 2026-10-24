import { useEffect, useRef } from "react";

function CameraPreview({ stream }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const videoElement = videoRef.current;

    if (!videoElement) {
      return undefined;
    }

    videoElement.srcObject = stream ?? null;

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
          The live camera preview will appear here after
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
        Live camera preview. This implementation does not
        record or upload video.
      </p>
    </div>
  );
}

export default CameraPreview;