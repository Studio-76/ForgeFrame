/**
 * Overlay that highlights UX-marked elements and shows inspection tooltips.
 *
 * This component receives props from UxReviewProvider rather than using
 * the useUxReview hook directly to avoid a circular dependency
 * (UxReviewOverlay → useUxReview → UxReviewContext → UxReviewOverlay).
 *
 * When UX Review Mode is active, this component:
 * - Attaches global event listeners for mousemove and click
 * - Highlights elements with `data-ux-id` attributes on hover
 * - Shows a floating tooltip with condensed metadata
 * - Clicks select an element for annotation in the side panel
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { CapturedElement } from "./types";
import { captureElement } from "./types";

/**
 * Props for UxReviewOverlay, passed from UxReviewProvider.
 */
export interface UxReviewOverlayProps {
  /** Whether UX Review Mode is active. */
  isEnabled: boolean;
  /** The currently hovered element, or null. */
  hoveredElement: CapturedElement | null;
  /** Set the hovered element for tooltip display. */
  setHoveredElement: (element: CapturedElement | null) => void;
  /** Select an element for annotation. */
  selectElement: (element: CapturedElement | null) => void;
  /** Clear the current selection. */
  clearSelection: () => void;
}

/**
 * Returns the nearest meaningful element for UX inspection.
 *
 * First tries to find an ancestor with a `data-ux-id` attribute (for
 * explicit instrumentation). If none exists, returns the deepest child
 * element that triggered the event, filtering out body/html and elements
 * that are too small to be meaningful.
 *
 * @param el - The element to check.
 * @returns An inspectable element, or null.
 */
function findUxElement(el: EventTarget | null): Element | null {
  if (!(el instanceof Element)) return null;

  // Prefer a data-ux-id ancestor for structured metadata
  let current: Element | null = el;
  while (current) {
    if (current.hasAttribute("data-ux-id")) return current;
    current = current.parentElement;
  }

  // No data-ux-id found — return the deepest element if it's meaningful
  const rect = el.getBoundingClientRect();
  const isTooSmall = rect.width < 4 || rect.height < 4;
  if (isTooSmall) return null;
  const isRoot = el === document.body || el === document.documentElement;
  if (isRoot) return null;

  return el;
}

/**
 * Overlay component for UX Review Mode.
 *
 * Renders highlight frames and tooltips over UX-marked elements.
 * Event handlers use refs to avoid re-registration on state changes.
 */
export function UxReviewOverlay({
  isEnabled,
  hoveredElement,
  setHoveredElement,
  selectElement,
  clearSelection,
}: UxReviewOverlayProps) {
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  /* Refs keep stable references for event handlers */
  const hoveredRef = useRef(hoveredElement);
  const isEnabledRef = useRef(isEnabled);
  hoveredRef.current = hoveredElement;
  isEnabledRef.current = isEnabled;

  /**
   * Global mousemove handler — uses refs to avoid stale closures.
   * Captures mouse position via RAF throttling to avoid excessive state updates.
   */
  const rafId = useRef<number>(0);
  const rafCleanup = useRef(false);
  const handleMouseMove = useCallback((event: MouseEvent) => {
    const uxEl = findUxElement(event.target);
    if (uxEl) {
      const captured = captureElement(uxEl);
      setHoveredElement(captured);
      // Throttle mouse position updates to animation frame
      if (!rafId.current) {
        rafId.current = requestAnimationFrame(() => {
          if (!rafCleanup.current) {
            setMousePos({ x: event.clientX, y: event.clientY });
          }
          rafId.current = 0;
        });
      }
      return;
    }
    // Only clear if something was hovered (avoids unnecessary renders)
    if (hoveredRef.current) {
      setHoveredElement(null);
    }
  }, [setHoveredElement]);

  /* Cleanup RAF on unmount */
  useEffect(() => {
    rafCleanup.current = false;
    return () => {
      rafCleanup.current = true;
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  /**
   * Global click handler — uses refs to avoid stale closures.
   */
  const handleClick = useCallback((event: MouseEvent) => {
    if (!isEnabledRef.current) return;
    const uxEl = findUxElement(event.target);
    if (!uxEl) return;

    event.preventDefault();
    event.stopPropagation();
    const captured = captureElement(uxEl);

    // Toggle selection: clicking the same element deselects it
    if (
      hoveredRef.current &&
      hoveredRef.current.elementData.uxId === captured.elementData.uxId
    ) {
      clearSelection();
    } else {
      selectElement(captured);
    }
  }, [selectElement, clearSelection]);

  /* Attach global event listeners once (stable via refs) */
  useEffect(() => {
    if (!isEnabled) return;
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("click", handleClick, { capture: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("click", handleClick, { capture: true });
    };
  }, [isEnabled, handleMouseMove, handleClick]);

  /* Restore cursor on disable and on unmount */
  useEffect(() => {
    if (!isEnabled) {
      document.body.style.cursor = "";
    }
    return () => {
      document.body.style.cursor = "";
    };
  }, [isEnabled]);

  if (!isEnabled) return null;

  return (
    <>
      {/* Highlight ring on hovered element */}
      {hoveredElement ? (
        <HighlightFrame
          key={hoveredElement.elementData.uxId + "-hover"}
          captured={hoveredElement}
        />
      ) : null}

      {/* Tooltip near cursor */}
      {hoveredElement ? (
        <Tooltip
          mouseX={mousePos.x}
          mouseY={mousePos.y}
          uxId={hoveredElement.elementData.uxId}
          uxComponent={hoveredElement.elementData.uxComponent}
          uxRole={hoveredElement.elementData.uxRole}
          uxActionKind={hoveredElement.elementData.uxActionKind}
          uxAttention={hoveredElement.elementData.uxAttention}
          uxDensity={hoveredElement.elementData.uxDensity}
          uxSource={hoveredElement.elementData.uxSource}
        />
      ) : null}
    </>
  );
}

// ── Sub-components ──────────────────────────────────────

/**
 * Highlights a DOM element by reading its current bounding rect.
 */
function HighlightFrame({ captured }: { captured: NonNullable<ReturnType<typeof captureElement>> }) {
  if (!captured.boundingBox) return null;
  const bb = captured.boundingBox;
  return (
    <div
      className="ux-review-highlight"
      style={{
        position: "fixed",
        pointerEvents: "none",
        zIndex: 99998,
        left: bb.x,
        top: bb.y,
        width: bb.width,
        height: bb.height,
        border: "2px solid #06b6d4",
        borderRadius: "4px",
        background: "rgba(6, 182, 212, 0.08)",
        transition: "all 0.1s ease",
      }}
    />
  );
}

/**
 * Floating tooltip positioned near cursor position.
 * Shows condensed UX metadata for the hovered element.
 */
function Tooltip({
  mouseX,
  mouseY,
  uxId,
  uxComponent,
  uxRole,
  uxActionKind,
  uxAttention,
  uxDensity,
  uxSource,
}: {
  mouseX: number;
  mouseY: number;
  uxId: string;
  uxComponent?: string;
  uxRole?: string;
  uxActionKind?: string;
  uxAttention?: string;
  uxDensity?: string;
  uxSource?: string;
}) {
  const tooltipWidth = 280;
  const offsetX = 16;
  const offsetY = 16;
  const left = Math.min(mouseX + offsetX, window.innerWidth - tooltipWidth - 8);
  const top = Math.min(mouseY + offsetY, window.innerHeight - 200);

  return (
    <div
      className="ux-review-tooltip"
      style={{
        position: "fixed",
        pointerEvents: "none",
        zIndex: 99999,
        left,
        top: Math.max(top, 8),
      }}
    >
      <div
        style={{
          background: "#0b101b",
          border: "1px solid #06b6d4",
          borderRadius: "6px",
          padding: "6px 10px",
          fontSize: "12px",
          fontFamily: "'Inter', system-ui, sans-serif",
          lineHeight: 1.5,
          color: "#e2e8f0",
          minWidth: "220px",
          maxWidth: tooltipWidth,
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        }}
      >
        <div
          style={{
            fontWeight: 600,
            color: "#06b6d4",
            marginBottom: 2,
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          UX Review
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "2px 8px" }}>
          <span style={{ color: "#64748b" }}>ID</span>
          <span style={{ color: "#e2e8f0" }}>{uxId}</span>
          {uxComponent ? (
            <>
              <span style={{ color: "#64748b" }}>Component</span>
              <span>{uxComponent}</span>
            </>
          ) : null}
          {uxRole ? (
            <>
              <span style={{ color: "#64748b" }}>Role</span>
              <span>{uxRole}</span>
            </>
          ) : null}
          {uxActionKind ? (
            <>
              <span style={{ color: "#64748b" }}>Action</span>
              <span>{uxActionKind}</span>
            </>
          ) : null}
          {uxAttention ? (
            <>
              <span style={{ color: "#64748b" }}>Attention</span>
              <span>{uxAttention}</span>
            </>
          ) : null}
          {uxDensity ? (
            <>
              <span style={{ color: "#64748b" }}>Density</span>
              <span>{uxDensity}</span>
            </>
          ) : null}
          {uxSource ? (
            <>
              <span style={{ color: "#64748b" }}>Source</span>
              <span>{uxSource}</span>
            </>
          ) : null}
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: "11px",
            color: "#94a3b8",
            borderTop: "1px solid #1e293b",
            paddingTop: 4,
          }}
        >
          Click to annotate &middot; Ctrl+Shift+U to toggle
        </div>
      </div>
    </div>
  );
}
