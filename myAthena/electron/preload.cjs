const {
  contextBridge,
  ipcRenderer,
} = require("electron");

const CHANNELS = {
  setFullscreen: "athena:fullscreen:set",
  getFullscreen: "athena:fullscreen:get",
  fullscreenChanged: "athena:fullscreen:changed",
};

/*
 * Only expose specific operations to the React application.
 *
 * Do not expose ipcRenderer itself or unrestricted send/invoke
 * functions to the renderer.
 */
contextBridge.exposeInMainWorld("electronAPI", {
  /*
   * Enter fullscreen by default.
   * Passing false explicitly requests exiting fullscreen.
   */
  setFullScreen: (enabled = true) => {
    if (typeof enabled !== "boolean") {
      return Promise.resolve(false);
    }

    return ipcRenderer.invoke(
      CHANNELS.setFullscreen,
      enabled
    );
  },

  /*
   * Query the actual Electron window state.
   */
  getFullScreenState: () =>
    ipcRenderer.invoke(CHANNELS.getFullscreen),

  /*
   * Subscribe to state changes.
   * Return a function that removes the listener.
   */
  onFullscreenChanged: (callback) => {
    if (typeof callback !== "function") {
      return () => {};
    }

    const listener = (_event, isFullscreen) => {
      callback(Boolean(isFullscreen));
    };

    ipcRenderer.on(
      CHANNELS.fullscreenChanged,
      listener
    );

    return () => {
      ipcRenderer.removeListener(
        CHANNELS.fullscreenChanged,
        listener
      );
    };
  },
});