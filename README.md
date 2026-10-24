# Athena Desktop Examination Application

Athena is a desktop examination and proctoring application built
with Electron, React, Vite, JavaScript, and JSX.

The current implementation is a college-project demonstration.
It provides a pre-exam setup screen, camera preview, Electron
fullscreen integration, an MCQ examination, a countdown timer,
and a local demonstration completion screen.

## Current features

- Pre-exam setup and examination-rule confirmation.
- Camera permission request and live camera preview.
- Explicit Electron fullscreen API through a restricted preload bridge.
- Multiple-choice demonstration questions.
- Previous and Next navigation.
- Answers preserved across question navigation.
- Countdown timer displayed as HH:MM:SS.
- Manual submission confirmation.
- Automatic submission processing when the countdown expires.
- Duplicate-submission protection within the active renderer session.
- Local demonstration result summary.
- Optional fullscreen interruption logging with timestamps.
- Camera cleanup when the examination is completed.
- Responsive setup, examination, and result screens.

## Requirements

- Node.js and npm compatible with the installed Vite version.
- macOS or another platform supported by the installed Electron version.
- A working camera for testing camera access.
- A project directory containing the existing package.json and
  package-lock.json files.

## Installation

Open Terminal in the Athena project root and run:

    npm install

Do not install additional packages unless a later implementation
requires them.

## Development

Start both the Vite renderer and Electron window with:

    npm start

The development Electron window uses:

    http://localhost:5173/

To run only the renderer during UI development, use:

    npm run dev

## Lint and build

Create a production build of the Vite renderer:

    npm run build

Preview the Vite build:

    npm run preview

Build an unsigned Apple Silicon macOS DMG:

    npm run dist:mac

The installer is created in the `dist/` directory. The DMG is
unsigned unless a valid Apple Developer signing identity is
configured on the build machine, so macOS may require the user to
approve it in Privacy & Security before opening it.

Check Electron source syntax:

    find electron -name '*.cjs' -print0 | xargs -0 -n1 node --check

The Vite build command does not, by itself, package the Electron
application or create a distributable desktop installer. A separate
packaging workflow would be required for release builds.

## Project architecture

### Electron

- electron/main.cjs
  Creates the desktop window, manages fullscreen state, handles
  permitted camera media requests, registers IPC handlers, and
  controls application lifecycle.

- electron/preload.cjs
  Exposes an explicit and restricted window.electronAPI bridge.
  React does not receive unrestricted access to ipcRenderer or Node.js.

### React application

- src/main.jsx
  Mounts the top-level React application.

- src/App.jsx
  Owns application screen navigation and the camera lifecycle.
  It switches between preflight, exam, and result screens.

### Components

- src/components/PermissionCard.jsx
  Reusable permission section for setup requirements.

- src/components/CameraPreview.jsx
  Displays a MediaStream in a video element.

- src/components/ExamHeader.jsx
  Displays exam metadata, timer, progress, and submit action.

- src/components/QuestionCard.jsx
  Renders a question and controlled radio inputs.

### Pages

- src/pages/PreflightPage.jsx
  Camera/fullscreen readiness checks and examination-rule confirmation.

- src/pages/ExamPage.jsx
  Loads questions, stores answers, manages question navigation,
  starts the countdown, processes submissions, and records permitted
  fullscreen events.

- src/pages/ResultPage.jsx
  Displays the local demonstration result or the explicitly
  confirmed status supplied by a future backend integration.

### Hooks

- src/hooks/useCamera.js
  Requests camera access and owns the MediaStream lifecycle.

- src/hooks/useExamTimer.js
  Manages the single countdown timer and expiry callback.

### Data, services, and utilities

- src/data/demoQuestions.js
  Contains the local demonstration question bank and demo exam policy.

- src/services/examService.js
  Validates questions and processes local demonstration submissions.

- src/utils/formatTime.js
  Formats remaining seconds as HH:MM:SS.

### Styles

- src/styles/tokens.css
  Shared color, spacing, typography, border, and shadow tokens.

- src/styles/global.css
  Global styles and baseline layout.

- src/styles/setup-page.css
  Pre-exam setup interface.

- src/styles/exam-page.css
  Examination, answer selection, timer, sidebar, completion screen,
  and fullscreen audit log styles.

## Application flow

1. Electron creates the desktop window and loads the React renderer.
2. App.jsx displays PreflightPage.jsx.
3. The student grants camera access and enables fullscreen.
4. Electron confirms fullscreen through the preload bridge.
5. The student opens and accepts the examination rules.
6. App.jsx renders ExamPage.jsx while retaining the camera hook.
7. examService.js loads demonstration questions.
8. The timer starts after questions are loaded.
9. React stores answers keyed by question ID.
10. Manual submission requires confirmation; timer expiry triggers
    the automatic submission path.
11. examService.js calculates a local demonstration result.
12. App.jsx stops the camera and renders ResultPage.jsx.

## Demonstration data and backend limitations

The current exam service uses a local question bank.

The completion screen must identify this as a local demonstration
result and must not claim that answers were saved to a backend.

A production implementation requires a real backend service,
authentication, server-side validation, durable answer storage,
server-side timing/deadline validation, and an explicit successful
server response before displaying a backend-confirmed submission.

The demonstration answer key exists in the client-side source and
is not suitable for a secure, high-stakes examination.

## Camera and privacy

Athena requests video access through navigator.mediaDevices.getUserMedia.
The current demo does not request microphone access, record video, or
upload camera data.

The active MediaStream tracks are stopped when the camera is released
or the application-level camera owner is unmounted.

## Fullscreen events

The configured demo policy can record fullscreen exits and restorations
with timestamps during an active examination.

These events are operational records. They do not automatically
establish cheating, intent, or misconduct.

The current demonstration stores event records in renderer memory and
passes them into the local result. They are not a tamper-proof,
server-persisted audit log.

## Security and application lifecycle

The intended Electron configuration uses contextIsolation, disabled
nodeIntegration, and a restricted preload bridge.

Fullscreen is managed by Electron's BrowserWindow APIs. The application
does not attempt to disable macOS Force Quit or intercept the operating
system's emergency controls.

## Known limitations

- No real examination backend is currently configured.
- Demo submissions are not saved to a server.
- Client-side demo scoring is illustrative and is not secure for real exams.
- Fullscreen event records are not tamper-proof.
- Leaving fullscreen is recorded, not treated as proof of misconduct.
- No video recording or remote proctoring upload is implemented.
- npm run build builds the Vite renderer; there is no configured
  desktop packaging/release script in the current package scripts.
- Runtime behavior still needs to be verified on the target macOS device.

## Testing checklist

- [ ] Vite starts with npm run dev.
- [ ] Electron opens with npm start.
- [ ] Camera permission can be granted and denied.
- [ ] Fullscreen can be entered and exited.
- [ ] Go To Test is disabled until required setup checks pass.
- [ ] Questions load from the local demonstration source.
- [ ] Previous and Next preserve selected answers.
- [ ] Manual submission requests confirmation.
- [ ] Timer expiry triggers automatic submission processing.
- [ ] Repeated submit requests do not create overlapping submissions.
- [ ] The result screen identifies local demo status correctly.
- [ ] Fullscreen events are timestamped when policy logging is enabled.
- [ ] The camera is stopped after successful completion.
- [ ] npm run lint completes.
- [ ] npm run build completes.