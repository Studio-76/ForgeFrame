import { useOutletContext } from "react-router-dom";

import type { AdminSessionUser } from "../api/admin";

export type AppSessionContext = {
  session: AdminSessionUser | null;
  sessionReady: boolean;
  markPasswordRotationComplete: () => void;
  replaceSession: (session: AdminSessionUser | null) => void;
};

export function useAppSession(): AppSessionContext {
  return useOutletContext<AppSessionContext>();
}
