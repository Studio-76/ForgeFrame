import { useCallback, useEffect, useMemo, useState } from "react";

import { roleAllows, sessionHasAnyInstancePermission } from "../../app/adminAccess";
import { useAppSession } from "../../app/session";
import {
  fetchMutableSettings,
  patchMutableSettings,
  resetMutableSetting,
  type MutableSettingEntry,
} from "../../api/admin";
import { formatSettingValue, getCategory, normalizeDraft } from "./utils";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  DEFAULT_CONFIRM_DIALOG,
  type CategoryFilter,
  type ConfirmDialogState,
  type LoadState,
} from "./types";

/**
 * Return value of the `useSettings()` master hook.
 * Provides all state, computed values, and action handlers
 * for the System Settings page.
 */
export interface UseSettingsReturn {
  /** Current app session state. */
  session: ReturnType<typeof useAppSession>["session"];
  /** Whether the session has finished loading. */
  sessionReady: boolean;
  /** Whether the user can mutate settings. */
  canMutate: boolean;
  /** Whether the user can view security-related pages. */
  canManageSecurity: boolean;
  /** Whether the user can open the security page. */
  canOpenSecurity: boolean;
  /** Human-readable access label for the page badge. */
  accessLabel: string;
  /** Tone for the access badge. */
  accessTone: "success" | "warning" | "neutral";

  /** Full list of settings from the API. */
  settings: MutableSettingEntry[];
  /** Load state for the initial fetch. */
  loadState: LoadState;
  /** Current error message, if any. */
  error: string;
  /** Current success/operation message, if any. */
  operationMessage: string;

  /** Current search text filter. */
  searchText: string;
  /** Set the search text filter. */
  setSearchText: React.Dispatch<React.SetStateAction<string>>;
  /** Current category filter value. */
  categoryFilter: CategoryFilter;
  /** Set the category filter. */
  setCategoryFilter: React.Dispatch<React.SetStateAction<CategoryFilter>>;
  /** Whether to show high-risk settings alongside regular ones. */
  showHighRisk: boolean;
  /** Toggle high-risk setting visibility. */
  setShowHighRisk: React.Dispatch<React.SetStateAction<boolean>>;

  /** Settings filtered by search text and category. */
  filteredSettings: MutableSettingEntry[];
  /** Filtered settings grouped and ordered by category. */
  groupedSettings: Array<{ category: string; label: string; items: MutableSettingEntry[] }>;

  /** Currently selected setting key. */
  selectedKey: string;
  /** Set the selected setting by key. */
  setSelectedKey: React.Dispatch<React.SetStateAction<string>>;
  /** The currently selected setting object, or null. */
  selectedSetting: MutableSettingEntry | null;

  /** Current draft values keyed by setting key. */
  drafts: Record<string, string>;
  /** Update a single draft value. */
  setDraftValue: (key: string, value: string) => void;

  /** Whether edit mode is active for the selected setting. */
  editMode: boolean;
  /** Toggle edit mode on/off. */
  toggleEditMode: () => void;

  /** Whether a save operation is in progress for the given key. */
  savingKey: string;
  /** Whether a reset operation is in progress for the given key. */
  resettingKey: string;

  /** State for the high-risk confirmation dialog. */
  confirmDialog: ConfirmDialogState;
  /** Close the confirmation dialog without acting. */
  cancelConfirm: () => void;
  /** Execute the confirmed action (save/reset). */
  executeConfirmed: () => Promise<void>;

  /** Initiate a save for the given setting (may show confirmation dialog). */
  handleSave: (item: MutableSettingEntry) => void;
  /** Initiate a reset for the given setting (may show confirmation dialog). */
  handleReset: (item: MutableSettingEntry) => void;
  /** Reload settings from the API. */
  reload: () => Promise<void>;
}

/**
 * Master hook for the System Settings page.
 *
 * Manages all settings state including fetching, filtering,
 * editing, saving, resetting, and confirmation flows.
 */
export function useSettings(): UseSettingsReturn {
  const { session, sessionReady } = useAppSession();
  const canMutate = sessionReady && roleAllows(session?.role, "admin") && session?.read_only !== true;
  const canManageSecurity = sessionReady && sessionHasAnyInstancePermission(session, "security.write");
  const canOpenSecurity = sessionReady && (
    sessionHasAnyInstancePermission(session, "security.read")
    || sessionHasAnyInstancePermission(session, "security.write")
  );
  const accessLabel = canMutate ? "Admin mutations enabled" : sessionReady ? "Read-only review" : "Checking access";
  const accessTone: "success" | "warning" | "neutral" = canMutate ? "success" : sessionReady ? "warning" : "neutral";

  const [settings, setSettings] = useState<MutableSettingEntry[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [selectedKey, setSelectedKey] = useState("");
  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [showHighRisk, setShowHighRisk] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [error, setError] = useState("");
  const [operationMessage, setOperationMessage] = useState("");
  const [savingKey, setSavingKey] = useState("");
  const [resettingKey, setResettingKey] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(DEFAULT_CONFIRM_DIALOG);

  /** Reload settings from the API. */
  const load = useCallback(async () => {
    setLoadState("loading");
    setError("");
    setOperationMessage("");
    try {
      const payload = await fetchMutableSettings();
      setSettings(payload.settings);
      setDrafts(
        Object.fromEntries(
          payload.settings.map((item) => [item.key, formatSettingValue(item.effective_value)]),
        ),
      );
      setLoadState("success");
    } catch (err) {
      setLoadState("error");
      setError(err instanceof Error ? err.message : "Settings loading failed.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Reset edit mode when selected setting changes
  useEffect(() => {
    setEditMode(false);
  }, [selectedKey]);

  /** Filter settings by search text and category. */
  const filteredSettings = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return settings.filter((item) => {
      // Category filter
      if (categoryFilter !== "all") {
        const itemCategory = getCategory(item);
        if (itemCategory !== categoryFilter) {
          return false;
        }
      }
      // High-risk filter
      if (!showHighRisk && item.risk_level === "high") {
        return false;
      }
      // Search filter
      if (!query) {
        return true;
      }
      return [
        item.key,
        item.label,
        item.description,
        item.group,
        item.group_label,
        item.source_label,
        item.risk_label,
      ].some((field) => field.toLowerCase().includes(query));
    });
  }, [settings, categoryFilter, showHighRisk, searchText]);

  /** Group filtered settings by category in display order. */
  const groupedSettings = useMemo(() => {
    const categoryMap = new Map<string, MutableSettingEntry[]>();
    for (const item of filteredSettings) {
      const cat = getCategory(item);
      const existing = categoryMap.get(cat) ?? [];
      existing.push(item);
      categoryMap.set(cat, existing);
    }
    return CATEGORY_ORDER
      .filter((cat) => categoryMap.has(cat))
      .map((cat) => {
        const items = categoryMap.get(cat)!;
        const label = CATEGORY_LABELS[cat] ?? cat.charAt(0).toUpperCase() + cat.slice(1);
        return { category: cat, label, items };
      });
  }, [filteredSettings]);

  // Auto-select first setting when list changes
  useEffect(() => {
    if (!filteredSettings.length) {
      setSelectedKey("");
      return;
    }
    if (!filteredSettings.some((item) => item.key === selectedKey)) {
      setSelectedKey(filteredSettings[0].key);
    }
  }, [filteredSettings, selectedKey]);

  /** The currently selected setting. */
  const selectedSetting = useMemo(
    () => filteredSettings.find((item) => item.key === selectedKey)
      ?? settings.find((item) => item.key === selectedKey)
      ?? null,
    [filteredSettings, selectedKey, settings],
  );

  /** Update a single draft value. */
  const setDraftValue = useCallback((key: string, value: string) => {
    setDrafts((current) => ({ ...current, [key]: value }));
  }, []);

  /** Toggle edit mode on/off. */
  const toggleEditMode = useCallback(() => {
    setEditMode((current) => !current);
  }, []);

  /**
   * Show confirmation dialog or proceed directly with save.
   */
  const handleSave = useCallback(
    (item: MutableSettingEntry) => {
      if (item.confirmation_required) {
        setConfirmDialog({ visible: true, item, action: "save" });
        return;
      }
      // No confirmation needed, save directly
      setSavingKey(item.key);
      const nextValue = normalizeDraft(
        item,
        drafts[item.key] ?? formatSettingValue(item.effective_value),
      );
      void patchMutableSettings({ [item.key]: nextValue })
        .then((response) => {
          setSettings(response.settings);
          setDrafts(
            Object.fromEntries(
              response.settings.map((entry) => [entry.key, formatSettingValue(entry.effective_value)]),
            ),
          );
          setOperationMessage(response.operation.summary);
          setEditMode(false);
          setError("");
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Setting update failed.");
        })
        .finally(() => {
          setSavingKey("");
        });
    },
    [drafts],
  );

  /**
   * Show confirmation dialog or proceed directly with reset.
   */
  const handleReset = useCallback(
    (item: MutableSettingEntry) => {
      if (item.confirmation_required) {
        setConfirmDialog({ visible: true, item, action: "reset" });
        return;
      }
      setResettingKey(item.key);
      void resetMutableSetting(item.key)
        .then((response) => {
          setSettings(response.settings);
          setDrafts(
            Object.fromEntries(
              response.settings.map((entry) => [entry.key, formatSettingValue(entry.effective_value)]),
            ),
          );
          setOperationMessage(response.operation.summary);
          setEditMode(false);
          setError("");
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Setting reset failed.");
        })
        .finally(() => {
          setResettingKey("");
        });
    },
    [],
  );

  /** Execute the confirmed action from the dialog. */
  const executeConfirmed = useCallback(async () => {
    const { item, action } = confirmDialog;
    if (!item || !action) {
      setConfirmDialog(DEFAULT_CONFIRM_DIALOG);
      return;
    }
    setConfirmDialog(DEFAULT_CONFIRM_DIALOG);

    if (action === "save") {
      setSavingKey(item.key);
      const nextValue = normalizeDraft(
        item,
        drafts[item.key] ?? formatSettingValue(item.effective_value),
      );
      try {
        const response = await patchMutableSettings({ [item.key]: nextValue });
        setSettings(response.settings);
        setDrafts(
          Object.fromEntries(
            response.settings.map((entry) => [entry.key, formatSettingValue(entry.effective_value)]),
          ),
        );
        setOperationMessage(response.operation.summary);
        setEditMode(false);
        setError("");
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Setting update failed.");
      } finally {
        setSavingKey("");
      }
    } else {
      setResettingKey(item.key);
      try {
        const response = await resetMutableSetting(item.key);
        setSettings(response.settings);
        setDrafts(
          Object.fromEntries(
            response.settings.map((entry) => [entry.key, formatSettingValue(entry.effective_value)]),
          ),
        );
        setOperationMessage(response.operation.summary);
        setEditMode(false);
        setError("");
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Setting reset failed.");
      } finally {
        setResettingKey("");
      }
    }
  }, [confirmDialog, drafts]);

  /** Close the confirmation dialog without acting. */
  const cancelConfirm = useCallback(() => {
    setConfirmDialog(DEFAULT_CONFIRM_DIALOG);
  }, []);

  return {
    session,
    sessionReady,
    canMutate,
    canManageSecurity,
    canOpenSecurity,
    accessLabel,
    accessTone,

    settings,
    loadState,
    error,
    operationMessage,

    searchText,
    setSearchText,
    categoryFilter,
    setCategoryFilter,
    showHighRisk,
    setShowHighRisk,

    filteredSettings,
    groupedSettings,

    selectedKey,
    setSelectedKey,
    selectedSetting,

    drafts,
    setDraftValue,

    editMode,
    toggleEditMode,

    savingKey,
    resettingKey,

    confirmDialog,
    cancelConfirm,
    executeConfirmed,

    handleSave,
    handleReset,
    reload: load,
  };
}
