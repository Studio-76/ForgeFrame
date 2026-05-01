import { Component, type ErrorInfo, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "../components/ui/Button";

type RouteErrorBoundaryProps = {
  readonly children: ReactNode;
  readonly boundaryKey: string;
};

type RouteErrorBoundaryState = {
  readonly error: Error | null;
};

/**
 * Route-scoped error boundary that prevents full white-screen failures.
 */
class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = { error: null };

  /**
   * Derive fallback state from a thrown rendering error.
   * @param error - Error raised by a child component.
   * @returns Updated fallback state.
   */
  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error };
  }

  /**
   * Reset boundary state when navigation changes route context.
   * @param prevProps - Previous component props.
   */
  componentDidUpdate(prevProps: RouteErrorBoundaryProps): void {
    if (prevProps.boundaryKey !== this.props.boundaryKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  /**
   * Record caught rendering errors for operator diagnostics.
   * @param error - Error raised by a child component.
   * @param errorInfo - React component stack metadata.
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Route module crashed", {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  /**
   * Retry rendering by clearing boundary error state.
   */
  private readonly handleRetry = (): void => {
    this.setState({ error: null });
  };

  /**
   * Render a route-level fallback or child content.
   * @returns Recovery UI or the original route element.
   */
  render(): ReactNode {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <section className="fg-page">
        <article className="fg-card fg-stack">
          <h2>Module Recovery Required</h2>
          <p className="fg-muted">
            This view hit an unexpected runtime fault. Retry this module or
            return to the dashboard while diagnostics continue in the console.
          </p>
          <div className="fg-inline-form">
            <Button className="fg-button" onPress={this.handleRetry}>
              Retry module
            </Button>
            <RouteFallbackNavigation />
          </div>
        </article>
      </section>
    );
  }
}

/**
 * Dashboard navigation action for route failure recovery.
 * @returns A route action button.
 */
function RouteFallbackNavigation(): ReactNode {
  const navigate = useNavigate();

  return (
    <Button
      className="fg-button fg-button-ghost"
      onPress={() => navigate("/dashboard")}
    >
      Go to dashboard
    </Button>
  );
}

/**
 * Wrap route elements in an error boundary keyed by pathname.
 * @param props - Wrapper properties.
 * @param props.children - Route element to guard.
 * @returns Route-scoped error boundary.
 */
export function RouteErrorBoundaryView(
  props: Readonly<{ children: ReactNode }>,
): ReactNode {
  const location = useLocation();

  return (
    <RouteErrorBoundary boundaryKey={location.pathname}>
      {props.children}
    </RouteErrorBoundary>
  );
}
