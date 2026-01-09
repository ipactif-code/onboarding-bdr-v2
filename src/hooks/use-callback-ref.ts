'use client';

import { useRef, useEffect, useCallback } from 'react';

/**
 * Creates a stable callback reference that always points to the latest callback.
 * Useful for avoiding stale closures in useEffect dependencies.
 *
 * This hook solves a common React pattern where you need to call a callback
 * inside a useEffect without adding it to the dependency array (which would
 * cause the effect to re-run on every render if the callback is recreated).
 *
 * @template T - The callback function type
 * @param callback - The callback function to wrap (can be undefined)
 * @returns A stable callback that always invokes the latest version
 *
 * @example
 * // Before: Manual ref pattern
 * const onChangeRef = useRef(onChange);
 * onChangeRef.current = onChange;
 * useEffect(() => {
 *   onChangeRef.current?.(value);
 * }, [value]);
 *
 * @example
 * // After: Using useCallbackRef
 * const stableOnChange = useCallbackRef(onChange);
 * useEffect(() => {
 *   stableOnChange(value);
 * }, [value]); // onChange not needed in deps
 *
 * @example
 * // With optional callback
 * function Editor({ onSave }: { onSave?: (content: string) => void }) {
 *   const stableOnSave = useCallbackRef(onSave);
 *
 *   useEffect(() => {
 *     const interval = setInterval(() => {
 *       stableOnSave(getContent()); // Safe to call even if onSave is undefined
 *     }, 5000);
 *     return () => clearInterval(interval);
 *   }, []); // No dependency on onSave needed
 * }
 */
export function useCallbackRef<T extends (...args: unknown[]) => unknown>(
  callback: T | undefined
): T {
  const callbackRef = useRef<T | undefined>(callback);

  // Update ref synchronously on every render to capture latest callback
  // Using useEffect ensures this happens after render is committed
  useEffect(() => {
    callbackRef.current = callback;
  });

  // Return a stable callback that delegates to the ref
  // The empty dependency array ensures this callback identity never changes
  return useCallback(
    ((...args: Parameters<T>) => callbackRef.current?.(...args)) as T,
    []
  );
}
