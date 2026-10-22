import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

function normalizeDuration(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

function useExamTimer({
  durationSeconds = 20 * 60,
  onExpire,
} = {}) {
  const initialDuration = normalizeDuration(durationSeconds);

  const [remainingSeconds, setRemainingSeconds] =
    useState(initialDuration);

  const [isRunning, setIsRunning] = useState(false);

  const remainingRef = useRef(initialDuration);
  const hasStartedRef = useRef(false);
  const hasExpiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);

  // Keep the latest callback without restarting the interval.
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  // Keep a synchronous reference to the latest remaining time.
  useEffect(() => {
    remainingRef.current = remainingSeconds;
  }, [remainingSeconds]);

  /*
   * There is only one interval for this hook instance.
   * It runs only while isRunning is true.
   */
  useEffect(() => {
    if (!isRunning) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      setRemainingSeconds((currentSeconds) =>
        Math.max(0, currentSeconds - 1)
      );
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [isRunning]);

  /*
   * Stop the clock and notify the exam page exactly once
   * when the countdown reaches zero.
   */
  useEffect(() => {
    if (
      remainingSeconds !== 0 ||
      !hasStartedRef.current ||
      hasExpiredRef.current
    ) {
      return;
    }

    hasExpiredRef.current = true;
    setIsRunning(false);

    if (typeof onExpireRef.current === "function") {
      onExpireRef.current();
    }
  }, [remainingSeconds]);

  const start = useCallback(() => {
    if (remainingRef.current <= 0 || hasExpiredRef.current) {
      return;
    }

    hasStartedRef.current = true;
    setIsRunning(true);
  }, []);

  const stop = useCallback(() => {
    setIsRunning(false);
  }, []);

  const reset = useCallback((nextDuration = initialDuration) => {
    const normalized = normalizeDuration(nextDuration);

    // Update the ref immediately so start() sees the reset value.
    remainingRef.current = normalized;
    hasStartedRef.current = false;
    hasExpiredRef.current = false;

    setIsRunning(false);
    setRemainingSeconds(normalized);
  }, [initialDuration]);

  return {
    remainingSeconds,
    isRunning,
    start,
    stop,
    reset,
  };
}

export default useExamTimer;