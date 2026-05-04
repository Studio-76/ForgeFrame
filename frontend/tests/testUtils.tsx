/**
 * Shared test utility helpers for ForgeFrame frontend tests.
 *
 * These helpers bridge the gap between the old `<Link>` pattern (rendering `<a>`
 * with an `href`) and the new `<Button variant="navigation">` pattern (rendering
 * `<button>` with `onPress` → `navigate()`).
 *
 * @packageDocumentation
 */

/**
 * Find a navigation element (either `<a>` or `<button>`) whose text content
 * includes the given substring.
 *
 * Use this when the tested page may use either `<Link>` (legacy) or
 * `<Button variant="navigation">` (current) for navigational elements.
 *
 * @param scope  - The parent DOM node to search within.
 * @param text   - Substring to match against each element's `textContent`.
 * @returns The first matching element, or `undefined`.
 */
export function findNavElement(scope: ParentNode, text: string): Element | undefined {
  // Try buttons first (the current pattern), then anchors (legacy)
  const button = Array.from(scope.querySelectorAll("button")).find(
    (el) => el.textContent?.includes(text),
  );
  if (button) {
    return button;
  }
  return Array.from(scope.querySelectorAll("a")).find(
    (el) => el.textContent?.includes(text),
  );
}

/**
 * Find a `<button>` element whose text content includes the given substring.
 *
 * Use this when you specifically need to find a `<Button>` component that
 * renders as a `<button>` element.
 *
 * @param scope  - The parent DOM node to search within.
 * @param text   - Substring to match against each button's `textContent`.
 * @returns The first matching button, or `undefined`.
 */
export function getNavButtonByText(scope: ParentNode, text: string): HTMLButtonElement | undefined {
  return Array.from(scope.querySelectorAll("button")).find(
    (el) => el.textContent?.includes(text),
  ) as HTMLButtonElement | undefined;
}

/**
 * Collect text labels from all navigation-like `<button>` elements within scope.
 *
 * Useful for test assertions that previously collected `<a>` href attributes.
 * After migration from `<Link>` to `<Button variant="navigation">`, the nav
 * semantics are captured by button labels rather than href values.
 *
 * @param scope  - The parent DOM node to search within.
 * @returns Array of trimmed text content strings from buttons.
 */
export function collectNavButtonLabels(scope: ParentNode): string[] {
  return Array.from(scope.querySelectorAll("button"))
    .map((btn) => btn.textContent?.trim() ?? "")
    .filter(Boolean);
}
