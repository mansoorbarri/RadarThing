import { useEffect, useRef } from "react";

/**
 * Calls `onChange` whenever `value` changes after the first render, so restored
 * preferences (cookies, URL params) are not reported as user actions.
 */
export function useTrackChange<T>(
  value: T,
  onChange: (value: T, previous: T) => void,
) {
  const previousRef = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const previous = previousRef.current;
    if (Object.is(previous, value)) return;
    previousRef.current = value;
    onChangeRef.current(value, previous);
  }, [value]);
}
