/**
 * Sync engine: settings live in IndexedDB locally and sync to Supabase
 * when the user is online + signed in. Last-write-wins by updated_at.
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { idbGet, idbSet } from "@/lib/idb";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_BRUSH, DEFAULT_MAPPINGS, DEFAULT_SMOOTHING, type BrushSettings, type GestureMappings, type SmoothingSettings } from "@/lib/types";

export interface AppSettings {
  theme: "dark" | "light";
  gesture_mappings: GestureMappings;
  brush_settings: BrushSettings;
  smoothing: SmoothingSettings;
  smart_ink_mode: "off" | "heuristics" | "auto";
  mirror_camera: boolean;
  updated_at: string;
}

const DEFAULTS: AppSettings = {
  theme: "dark",
  gesture_mappings: DEFAULT_MAPPINGS,
  brush_settings: DEFAULT_BRUSH,
  smoothing: DEFAULT_SMOOTHING,
  smart_ink_mode: "auto",
  mirror_camera: true,
  updated_at: new Date(0).toISOString(),
};

const LOCAL_KEY = "app_settings";

export function useSyncEngine() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [online, setOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [syncing, setSyncing] = useState(false);

  // Load local on mount
  useEffect(() => {
    idbGet<AppSettings>("settings", LOCAL_KEY).then((s) => { if (s) setSettings({ ...DEFAULTS, ...s }); });
  }, []);

  // Online/offline tracking
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // On user login → pull remote, merge by updated_at
  useEffect(() => {
    if (!user) return;
    (async () => {
      setSyncing(true);
      const { data } = await supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        const remote: AppSettings = {
          theme: (data.theme as "dark" | "light") ?? "dark",
          gesture_mappings: { ...DEFAULT_MAPPINGS, ...(data.gesture_mappings as object) } as GestureMappings,
          brush_settings: { ...DEFAULT_BRUSH, ...(data.brush_settings as object) } as BrushSettings,
          smoothing: { ...DEFAULT_SMOOTHING, ...(data.smoothing as object) } as SmoothingSettings,
          smart_ink_mode: (data.smart_ink_mode as AppSettings["smart_ink_mode"]) ?? "auto",
          mirror_camera: ((data.ui_layout as { mirror_camera?: boolean })?.mirror_camera) ?? true,
          updated_at: data.updated_at,
        };
        const local = await idbGet<AppSettings>("settings", LOCAL_KEY);
        const winner = !local || new Date(remote.updated_at) >= new Date(local.updated_at) ? remote : local;
        setSettings(winner);
        await idbSet("settings", LOCAL_KEY, winner);
        if (winner === local) await pushRemote(user.id, winner);
      } else {
        // No remote yet — push current local
        const local = await idbGet<AppSettings>("settings", LOCAL_KEY);
        if (local) await pushRemote(user.id, local);
      }
      setSyncing(false);
    })();
  }, [user]);

  const update = useCallback(async (patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch, updated_at: new Date().toISOString() };
      idbSet("settings", LOCAL_KEY, next);
      if (user && online) pushRemote(user.id, next);
      return next;
    });
  }, [user, online]);

  return { settings, update, online, syncing };
}

async function pushRemote(userId: string, s: AppSettings) {
  await supabase.from("user_settings").upsert({
    user_id: userId,
    theme: s.theme,
    gesture_mappings: s.gesture_mappings as never,
    brush_settings: s.brush_settings as never,
    smoothing: s.smoothing as never,
    smart_ink_mode: s.smart_ink_mode,
    ui_layout: { mirror_camera: s.mirror_camera } as never,
    updated_at: s.updated_at,
  });
}
