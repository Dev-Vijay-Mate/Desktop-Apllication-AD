function formatTime(totalSeconds) {
  if (
    typeof totalSeconds !== "number" ||
    !Number.isFinite(totalSeconds)
  ) {
    return "00:00:00";
  }

  const safeSeconds = Math.max(0, Math.floor(totalSeconds));

  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0"),
  ].join(":");
}

export default formatTime;