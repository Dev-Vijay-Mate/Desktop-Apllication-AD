const {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  session,
} = require("electron");

const path = require("node:path");
const { fileURLToPath } = require("node:url");

const CHANNELS = {
  setFullscreen: "athena:fullscreen:set",
  getFullscreen: "athena:fullscreen:get",
  fullscreenChanged: "athena:fullscreen:changed",
};

let mainWindow = null;

/*
 * Only trust the URL that belongs to Athena.
 *
 * During development, Vite runs at localhost:5173.
 * In a packaged app, Electron loads dist/index.html.
 */
function isTrustedRendererUrl(rawUrl) {
  if (typeof rawUrl !== "string" || rawUrl.length === 0) {
    return false;
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return false;
  }

  if (!app.isPackaged) {
    return (
      parsedUrl.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(parsedUrl.hostname) &&
      parsedUrl.port === "5173"
    );
  }

  if (parsedUrl.protocol !== "file:") {
    return false;
  }

  try {
    const requestedPath = path.resolve(
      fileURLToPath(parsedUrl)
    );

    const expectedPath = path.resolve(
      __dirname,
      "..",
      "dist",
      "index.html"
    );

    return requestedPath === expectedPath;
  } catch {
    return false;
  }
}

/*
 * Ensure IPC calls originate from Athena's trusted main frame.
 */
function isTrustedIpcSender(event) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return false;
  }

  if (event.sender !== mainWindow.webContents) {
    return false;
  }

  if (mainWindow.webContents.isDestroyed()) {
    return false;
  }

  const senderFrame = event.senderFrame;

  if (!senderFrame) {
    return false;
  }

  if (senderFrame !== mainWindow.webContents.mainFrame) {
    return false;
  }

  return isTrustedRendererUrl(senderFrame.url);
}

/*
 * Configure the Electron session to allow video-only camera
 * access from Athena's trusted main frame.
 *
 * Audio access is not granted by this handler.
 */
function installPermissionHandlers() {
  const defaultSession = session.defaultSession;

  defaultSession.setPermissionCheckHandler(
    (webContents, permission, requestingOrigin) => {
      if (permission !== "media") {
        return false;
      }

      if (!mainWindow || !webContents) {
        return false;
      }

      if (webContents !== mainWindow.webContents) {
        return false;
      }

      return (
        isTrustedRendererUrl(requestingOrigin) ||
        isTrustedRendererUrl(webContents.getURL())
      );
    }
  );

  defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      const mediaTypes = details?.mediaTypes ?? [];

      const isVideoOnly =
        Array.isArray(mediaTypes) &&
        mediaTypes.includes("video") &&
        !mediaTypes.includes("audio");

      const allowed =
        permission === "media" &&
        Boolean(webContents) &&
        Boolean(mainWindow) &&
        webContents === mainWindow.webContents &&
        details?.isMainFrame === true &&
        isVideoOnly &&
        isTrustedRendererUrl(
          details?.requestingUrl || webContents.getURL()
        );

      callback(Boolean(allowed));
    }
  );
}

/*
 * Notify React whenever the real BrowserWindow fullscreen
 * state changes, including changes made outside the React UI.
 */
function sendFullscreenState() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (mainWindow.webContents.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send(
    CHANNELS.fullscreenChanged,
    mainWindow.isFullScreen()
  );
}

/*
 * Change fullscreen and wait for Electron to confirm the result.
 *
 * Returns true only when BrowserWindow.isFullScreen() matches
 * the requested state.
 */
function setFullscreenAndConfirm(win, enabled) {
  if (win.isDestroyed()) {
    return Promise.resolve(false);
  }

  if (win.isFullScreen() === enabled) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let settled = false;
    let timeoutId;

    const expectedEvent = enabled
      ? "enter-full-screen"
      : "leave-full-screen";

    function cleanup() {
      clearTimeout(timeoutId);

      win.removeListener(
        "enter-full-screen",
        onFullscreenEvent
      );

      win.removeListener(
        "leave-full-screen",
        onFullscreenEvent
      );

      win.removeListener("closed", onClosed);
    }

    function finish(result) {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(Boolean(result));
    }

    function onFullscreenEvent() {
      finish(
        !win.isDestroyed() &&
        win.isFullScreen() === enabled
      );
    }

    function onClosed() {
      finish(false);
    }

    win.on("enter-full-screen", onFullscreenEvent);
    win.on("leave-full-screen", onFullscreenEvent);
    win.once("closed", onClosed);

    timeoutId = setTimeout(() => {
      finish(
        !win.isDestroyed() &&
        win.isFullScreen() === enabled
      );
    }, 2000);

    try {
      win.setFullScreen(enabled);

      // Handle an already-achieved target state immediately.
      if (
        !win.isDestroyed() &&
        win.isFullScreen() === enabled
      ) {
        finish(true);
      }
    } catch (error) {
      console.error(
        "Failed to change fullscreen state:",
        error
      );

      finish(false);
    }
  });
}

/*
 * Register only the specific IPC operations React needs.
 * The renderer never receives ipcRenderer or Node.js access.
 */
function registerIpcHandlers() {
  ipcMain.handle(
    CHANNELS.getFullscreen,
    (event) => {
      if (!isTrustedIpcSender(event)) {
        return false;
      }

      return mainWindow.isFullScreen();
    }
  );

  ipcMain.handle(
    CHANNELS.setFullscreen,
    async (event, enabled = true) => {
      if (!isTrustedIpcSender(event)) {
        return false;
      }

      if (typeof enabled !== "boolean") {
        return false;
      }

      const win = mainWindow;

      const confirmed = await setFullscreenAndConfirm(
        win,
        enabled
      );

      if (
        win === mainWindow &&
        !win.isDestroyed()
      ) {
        sendFullscreenState();
      }

      return confirmed;
    }
  );
}

/*
 * Preserve the normal macOS application menu and Command+Q.
 *
 * No global shortcut is registered, and Force Quit is not
 * intercepted or disabled.
 */
function installApplicationMenu() {
  const isMac = process.platform === "darwin";

  const template = [];

  if (isMac) {
    template.push({
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    });
  } else {
    template.push({
      label: "File",
      submenu: [{ role: "quit" }],
    });
  }

  template.push({
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "selectAll" },
    ],
  });

  template.push({
    label: "Window",
    submenu: [
      { role: "minimize" },
      { role: "zoom" },
      { type: "separator" },
      { role: "close" },
    ],
  });

  Menu.setApplicationMenu(
    Menu.buildFromTemplate(template)
  );
}

/*
 * Create Athena's desktop window.
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 720,
    minHeight: 600,
    show: true,

    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),

      // Keep renderer and preload JavaScript environments separate.
      contextIsolation: true,

      // Prevent renderer JavaScript from using Node.js directly.
      nodeIntegration: false,

      // Keep the renderer sandbox enabled.
      sandbox: true,

      // Do not allow insecure content to override HTTPS/file security.
      webSecurity: true,
    },
  });

  mainWindow.on("enter-full-screen", sendFullscreenState);
  mainWindow.on("leave-full-screen", sendFullscreenState);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  /*
   * Prevent navigation to unrelated pages inside Athena's window.
   */
  mainWindow.webContents.on(
    "will-navigate",
    (event, navigationUrl) => {
      if (!isTrustedRendererUrl(navigationUrl)) {
        event.preventDefault();
      }
    }
  );

  /*
   * Do not allow arbitrary websites or windows to be opened
   * from links within the renderer.
   */
  mainWindow.webContents.setWindowOpenHandler(() => ({
    action: "deny",
  }));

  /*
   * Do not automatically open DevTools during exam launches.
   */
  if (app.isPackaged) {
    mainWindow.loadFile(
      path.join(__dirname, "..", "dist", "index.html")
    ).catch((error) => {
      console.error("Failed to load Athena:", error);
    });
  } else {
    mainWindow.loadURL("http://localhost:5173/").catch(
      (error) => {
        console.error(
          "Could not load Athena. Make sure Vite is running on port 5173.",
          error
        );
      }
    );
  }
}

/*
 * Application lifecycle.
 */
app.whenReady().then(() => {
  installApplicationMenu();
  installPermissionHandlers();
  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // macOS applications normally remain available from the Dock.
  if (process.platform !== "darwin") {
    app.quit();
  }
});