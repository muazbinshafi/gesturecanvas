import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon } from "lucide-react";
import type { AppSettings } from "@/hooks/useSyncEngine";
import type { GestureMappings, Tool, Pose } from "@/lib/types";

const TOOL_OPTIONS: Tool[] = ["pen", "eraser", "rect", "circle", "arrow", "text", "select", "pan"];
const POSE_LABELS: { key: Pose; label: string; hint: string }[] = [
  { key: "DRAW", label: "Index finger up", hint: "Draw" },
  { key: "HOVER", label: "Index + Middle up", hint: "Cursor / hover" },
  { key: "PAN", label: "Closed fist", hint: "Pan canvas" },
  { key: "ERASE", label: "Open hand", hint: "Erase" },
  { key: "PINCH", label: "Pinch (thumb + index)", hint: "Select / move" },
];

export function SettingsPanel({ settings, update }: { settings: AppSettings; update: (p: Partial<AppSettings>) => void }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Settings"><SettingsIcon className="w-4 h-4" /></Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>Customize gestures, brush, smoothing, and Smart Ink.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <section>
            <h3 className="text-sm font-semibold mb-2">Gesture mappings</h3>
            <div className="space-y-2">
              {POSE_LABELS.map(({ key, label, hint }) => (
                <div key={key} className="flex items-center justify-between gap-2 text-sm">
                  <div>
                    <div className="font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">{hint}</div>
                  </div>
                  <select
                    value={settings.gesture_mappings[key]}
                    onChange={(e) => update({ gesture_mappings: { ...settings.gesture_mappings, [key]: e.target.value as Tool } as GestureMappings })}
                    className="bg-input text-foreground rounded-md px-2 py-1 text-sm border border-border"
                  >
                    {TOOL_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-2">Brush defaults</h3>
            <label className="text-xs text-muted-foreground">Size: {settings.brush_settings.size}px</label>
            <input type="range" min={1} max={20} value={settings.brush_settings.size}
              onChange={(e) => update({ brush_settings: { ...settings.brush_settings, size: Number(e.target.value) } })}
              className="w-full accent-primary" />
            <label className="text-xs text-muted-foreground mt-2 block">Color</label>
            <input type="color" value={settings.brush_settings.color}
              onChange={(e) => update({ brush_settings: { ...settings.brush_settings, color: e.target.value } })}
              className="w-12 h-8 rounded border border-border bg-transparent" />
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-2">Cursor smoothing</h3>
            <label className="text-xs text-muted-foreground">Min cutoff (Hz): {settings.smoothing.minCutoff.toFixed(2)} — lower = smoother</label>
            <input type="range" min={0.1} max={5} step={0.1} value={settings.smoothing.minCutoff}
              onChange={(e) => update({ smoothing: { ...settings.smoothing, minCutoff: Number(e.target.value) } })}
              className="w-full accent-primary" />
            <label className="text-xs text-muted-foreground mt-2 block">Beta: {settings.smoothing.beta.toFixed(3)} — higher = more responsive</label>
            <input type="range" min={0.001} max={0.1} step={0.001} value={settings.smoothing.beta}
              onChange={(e) => update({ smoothing: { ...settings.smoothing, beta: Number(e.target.value) } })}
              className="w-full accent-primary" />
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-2">Smart Ink</h3>
            <select
              value={settings.smart_ink_mode}
              onChange={(e) => update({ smart_ink_mode: e.target.value as AppSettings["smart_ink_mode"] })}
              className="w-full bg-input text-foreground rounded-md px-2 py-1.5 text-sm border border-border"
            >
              <option value="off">Off — keep raw strokes</option>
              <option value="heuristics">Heuristics only (offline)</option>
              <option value="auto">Auto (heuristics + AI when online)</option>
            </select>
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-2">Camera</h3>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={settings.mirror_camera}
                onChange={(e) => update({ mirror_camera: e.target.checked })} />
              Mirror camera (recommended)
            </label>
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-2">Onboarding</h3>
            <Button variant="outline" size="sm" onClick={() => { localStorage.removeItem("onboarding_done"); window.location.reload(); }}>
              Replay tour
            </Button>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
