/**
 * Plate.js Utility Functions
 *
 * This module provides utilities for working with Plate.js editor components,
 * specifically handling the filtering of internal plugin methods that should
 * not be passed to DOM elements.
 */

/**
 * Filters out Plate.js internal plugin methods from props object.
 *
 * Plate.js hooks (e.g., useMarkToolbarButton, useLinkToolbarButton) return props
 * containing internal store methods (setOption, setOptions, getOption, getOptions)
 * that are part of Plate's internal plugin API. These methods should NEVER reach
 * the DOM as they will cause React warnings about unknown props on DOM elements.
 *
 * @example
 * ```tsx
 * const { props: buttonProps } = useMarkToolbarButton(state);
 *
 * // WRONG - spreads internal methods to DOM
 * <ToolbarButton {...buttonProps} />
 *
 * // CORRECT - filters out internal methods first
 * <ToolbarButton {...filterPlatejsProps(buttonProps)} />
 * ```
 *
 * @param props - The props object from a Plate.js hook
 * @returns A new props object with internal methods removed
 */
export function filterPlatejsProps<T extends Record<string, unknown>>(
  props: T
): Omit<T, 'setOption' | 'setOptions' | 'getOption' | 'getOptions'> {
  const {
    setOption: _setOption,
    setOptions: _setOptions,
    getOption: _getOption,
    getOptions: _getOptions,
    ...domSafeProps
  } = props as T & {
    setOption?: unknown;
    setOptions?: unknown;
    getOption?: unknown;
    getOptions?: unknown;
  };

  return domSafeProps as Omit<
    T,
    'setOption' | 'setOptions' | 'getOption' | 'getOptions'
  >;
}
