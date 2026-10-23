function formatTime(totalSeconds) {
  if (
    typeof totalSeconds !== "number" ||
    !Number.isFinite(totalSeconds)
  ) {
    return "00:00";
  }

  const safeSeconds = Math.max(0, Math.floor(totalSeconds));

  // Round upward so a positive countdown never displays 00:00 early.
  const totalMinutes = Math.ceil(safeSeconds / 60);

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
  ].join(":");
}

export default formatTime;