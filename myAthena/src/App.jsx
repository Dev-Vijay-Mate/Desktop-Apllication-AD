import { useState } from "react";

import "./styles/global.css";

import PreflightPage from "./pages/PreflightPage.jsx";
import ExamPage from "./pages/ExamPage.jsx";

import useCamera from "./hooks/useCamera.js";

function App() {
  const [currentScreen, setCurrentScreen] =
    useState("preflight");

  /*
   * App owns the camera so the stream survives the transition
   * from PreflightPage to ExamPage.
   */
  const camera = useCamera();

  function handleStartExam() {
    setCurrentScreen("exam");
  }

  function handleExamComplete() {
    // Release the camera when the exam has been submitted.
    camera.stopCamera();
  }

  function handleReturnToSetup() {
    // Ensure the camera is released before returning to setup.
    camera.stopCamera();
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

  return (
    <ExamPage
      cameraStream={camera.stream}
      cameraStatus={camera.status}
      onComplete={handleExamComplete}
      onReturnToSetup={handleReturnToSetup}
    />
  );
}

export default App;