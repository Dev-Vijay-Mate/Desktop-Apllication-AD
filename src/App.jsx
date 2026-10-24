import { useState } from "react";

import "./styles/global.css";

import PreflightPage from "./pages/PreflightPage.jsx";
import ExamPage from "./pages/ExamPage.jsx";
import ResultPage from "./pages/ResultPage.jsx";

import useCamera from "./hooks/useCamera.js";

function App() {
  const [currentScreen, setCurrentScreen] =
    useState("preflight");

  const [submissionResult, setSubmissionResult] =
    useState(null);

  /*
   * App owns the camera so its stream survives the setup-to-exam
   * transition.
   */
  const camera = useCamera();

  function handleStartExam() {
    setSubmissionResult(null);
    setCurrentScreen("exam");
  }

  function handleExamComplete(result) {
    /*
     * This callback runs only after the exam service returns
     * a result that the app can route to the result page.
     */
    camera.stopCamera();

    setSubmissionResult(result);
    setCurrentScreen("result");
  }

  function handleReturnToSetup() {
    // Ensure no camera tracks remain active after leaving the exam.
    camera.stopCamera();

    setSubmissionResult(null);
    setCurrentScreen("preflight");
  }

  if (currentScreen === "preflight") {
    return (
      <PreflightPage
        camera={camera}
        onStartExam={handleStartExam}
      />
    );
  }

  if (currentScreen === "exam") {
    return (
      <ExamPage
        cameraStream={camera.stream}
        cameraStatus={camera.status}
        onComplete={handleExamComplete}
        onReturnToSetup={handleReturnToSetup}
      />
    );
  }

  return (
    <ResultPage
      result={submissionResult}
      onReturnToSetup={handleReturnToSetup}
    />
  );
}

export default App;