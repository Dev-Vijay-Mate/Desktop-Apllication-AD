import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

function normalizeDuration(value) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
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
  const deadlineRef = useRef(null);
  const hasStartedRef = useRef(false);
  const hasExpiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);

  // Always use the latest callback without creating another timer.
  onExpireRef.current = onExpire;

  const start = useCallback(() => {
    if (
      hasExpiredRef.current ||
      remainingRef.current <= 0 ||
      deadlineRef.current !== null
    ) {
      return;
    }

    hasStartedRef.current = true;

    deadlineRef.current =
      Date.now() + remainingRef.current * 1000;

    setIsRunning(true);
  }, []);

  const stop = useCallback(() => {
    if (deadlineRef.current !== null) {
      const nextRemaining = Math.max(
        0,
        Math.ceil(
          (deadlineRef.current - Date.now()) / 1000
        )
      );

      remainingRef.current = nextRemaining;
      setRemainingSeconds(nextRemaining);
      deadlineRef.current = null;
    }

    setIsRunning(false);
  }, []);

  const reset = useCallback(
    (nextDuration = initialDuration) => {
      const normalized = normalizeDuration(nextDuration);

      deadlineRef.current = null;
      remainingRef.current = normalized;
      hasStartedRef.current = false;
      hasExpiredRef.current = false;

      setRemainingSeconds(normalized);
      setIsRunning(false);
    },
    [initialDuration]
  );

  useEffect(() => {
    if (!isRunning) {
      return undefined;
    }

    function tick() {
      if (deadlineRef.current === null) {
        return;
      }

      const nextRemaining = Math.max(
        0,
        Math.ceil(
          (deadlineRef.current - Date.now()) / 1000
        )
      );

      remainingRef.current = nextRemaining;
      setRemainingSeconds(nextRemaining);

      if (
        nextRemaining === 0 &&
        hasStartedRef.current &&
        !hasExpiredRef.current
      ) {
        hasExpiredRef.current = true;
        deadlineRef.current = null;

        setIsRunning(false);

        if (typeof onExpireRef.current === "function") {
          onExpireRef.current();
        }
      }
    }

    tick();

    const intervalId = setInterval(tick, 250);

    return () => {
      clearInterval(intervalId);
    };
  }, [isRunning]);

  return {
    remainingSeconds,
    isRunning,
    start,
    stop,
    reset,
  };
}

export default useExamTimer;