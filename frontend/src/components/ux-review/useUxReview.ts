import { useContext } from "react";
import { UxReviewContext } from "./UxReviewContext";
import type { UxReviewContextValue } from "./types";

/**
 * Hook to access the UX Review Mode context.
 *
 * @returns The current UX Review context value.
 * @throws {Error} If called outside of UxReviewProvider.
 */
export function useUxReview(): UxReviewContextValue {
  const context = useContext(UxReviewContext);
  if (!context) {
    throw new Error(
      "useUxReview must be used within a <UxReviewProvider>. " +
      "Ensure UxReviewProvider wraps your component tree in the app entry point.",
    );
  }
  return context;
}
