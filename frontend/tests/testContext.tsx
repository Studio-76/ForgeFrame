import type { ReactElement } from "react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";

import type { AdminSessionUser } from "../src/api/admin";

type RenderOptions = {
  path: string;
  element: ReactElement;
  session?: AdminSessionUser | null;
  sessionReady?: boolean;
};

export function withAppContext({ path, element, session = null, sessionReady = true }: RenderOptions) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          element={(
            <Outlet
              context={{
                session,
                sessionReady,
                markPasswordRotationComplete: () => undefined,
                replaceSession: () => undefined,
              }}
            />
          )}
        >
          <Route path="*" element={element} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}
