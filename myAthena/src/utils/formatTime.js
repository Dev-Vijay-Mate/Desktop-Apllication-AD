function formatTime(totalSeconds) {
  if (
    typeof totalSeconds !== "number" ||
    !Number.isFinite(totalSeconds)
  ) {
    return "00:00";
  }

  const safeSeconds = Math.max(0, Math.floor(totalSeconds));

  // Round remaining minutes upward so a positive countdown
  // does not display 00:00 before the timer actually expires.
  const totalMinutes = Math.ceil(safeSeconds / 60);

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const formattedHours = String(hours).padStart(2, "0");
  const formattedMinutes = String(minutes).padStart(2, "0");

  return `${formattedHours}:${formattedMinutes}`;
}

export default formatTime;