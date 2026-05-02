/**
 * Local harness UI state hook.
 *
 * Manages selection state, edit mode, action parameters, and collapse toggles
 * that are local to the harness page — separate from the server-backed
 * providers control-plane hook.
 */
import { useEffect, useMemo, useState } from "react";

import {
  getRollbackRevisions,
  latestRunForProfile,
  profileProofState,
} from "../providers/providersSectionUtils";
import type { ProvidersPageData } from "../providers/providersShared";
import type { HarnessEditMode } from "./types";

/**
 * All local UI state for the harness workspace.
 */
export type HarnessUIState = {
  selectedProfileKey: string;
  setSelectedProfileKey: (key: string) => void;
  selectedProfile: ProvidersPageData["profiles"][number] | null;
  editMode: HarnessEditMode;
  setEditMode: (mode: HarnessEditMode) => void;
  actionModel: string;
  setActionModel: (model: string) => void;
  actionMessage: string;
  setActionMessage: (message: string) => void;
  rollbackRevision: number | null;
  setRollbackRevision: (revision: number | null) => void;
  rollbackOptions: number[];
  showRunDetails: boolean;
  setShowRunDetails: (show: boolean) => void;
  showTemplateCollapse: boolean;
  setShowTemplateCollapse: (show: boolean) => void;
  selectedProfileLastRun: ProvidersPageData["runs"][number] | null;
  selectedProfileProof: { status: "none" | "partial" | "proven"; note: string } | null;
  selectedProfileRuns: ProvidersPageData["runs"];
};

/**
 * Manage all local UI state for the harness workspace.
 *
 * @param data - Current providers control-plane data snapshot
 * @returns All harness UI state and setters
 */
export function useHarnessState(
  data: ProvidersPageData,
): HarnessUIState {
  const [selectedProfileKey, setSelectedProfileKey] = useState<string>(
    data.profiles[0]?.provider_key ?? "",
  );
  const [editMode, setEditMode] = useState<HarnessEditMode>("view");
  const [actionModel, setActionModel] = useState<string>(
    data.profiles[0]?.models[0] ?? "model-1",
  );
  const [actionMessage, setActionMessage] = useState<string>(
    "Hello from ForgeFrame harness",
  );
  const [rollbackRevision, setRollbackRevision] = useState<number | null>(null);
  const [showRunDetails, setShowRunDetails] = useState(false);
  const [showTemplateCollapse, setShowTemplateCollapse] = useState(false);

  // Reset selection when profiles change
  useEffect(() => {
    if (!data.profiles.length) {
      if (selectedProfileKey) {
        setSelectedProfileKey("");
      }
      return;
    }
    if (!data.profiles.some((p) => p.provider_key === selectedProfileKey)) {
      setSelectedProfileKey(data.profiles[0].provider_key);
    }
  }, [data.profiles, selectedProfileKey]);

  const selectedProfile = useMemo(
    () =>
      data.profiles.find((p) => p.provider_key === selectedProfileKey)
      ?? data.profiles[0]
      ?? null,
    [data.profiles, selectedProfileKey],
  );

  // Sync action model with selected profile
  useEffect(() => {
    if (!selectedProfile) {
      return;
    }
    const nextModel = selectedProfile.models[0] ?? "model-1";
    setActionModel((current) =>
      selectedProfile.models.includes(current) ? current : nextModel,
    );
  }, [selectedProfile?.provider_key, selectedProfile?.models]);

  const rollbackOptions = useMemo(
    () => (selectedProfile ? getRollbackRevisions(selectedProfile) : []),
    [selectedProfile],
  );

  useEffect(() => {
    if (rollbackOptions.length === 0) {
      if (rollbackRevision !== null) {
        setRollbackRevision(null);
      }
      return;
    }
    if (rollbackRevision === null || !rollbackOptions.includes(rollbackRevision)) {
      setRollbackRevision(rollbackOptions[0]);
    }
  }, [rollbackOptions, rollbackRevision]);

  const selectedProfileLastRun = selectedProfile
    ? latestRunForProfile(selectedProfile.provider_key, data.runs, data.runOps)
    : null;

  const selectedProfileProof = selectedProfile
    ? profileProofState(selectedProfile, data.providers)
    : null;

  const selectedProfileRuns = selectedProfile
    ? data.runs.filter((run) => run.provider_key === selectedProfile.provider_key)
    : data.runs;

  return {
    selectedProfileKey,
    setSelectedProfileKey,
    selectedProfile,
    editMode,
    setEditMode,
    actionModel,
    setActionModel,
    actionMessage,
    setActionMessage,
    rollbackRevision,
    setRollbackRevision,
    rollbackOptions,
    showRunDetails,
    setShowRunDetails,
    showTemplateCollapse,
    setShowTemplateCollapse,
    selectedProfileLastRun,
    selectedProfileProof,
    selectedProfileRuns,
  };
}
