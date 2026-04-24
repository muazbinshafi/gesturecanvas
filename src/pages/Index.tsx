import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { SmartCanvas, type SmartCanvasHandle } from "@/components/SmartCanvas";
import { Toolbar } from "@/components/Toolbar";
import { GestureController, type GestureFrame } from "@/components/GestureController";
import { ExportShareMenu } from "@/components/ExportShareMenu";
import { SettingsPanel } from "@/components/SettingsPanel";
import { OnboardingTour } from "@/components/OnboardingTour";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useSyncEngine } from "@/hooks/useSyncEngine";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Sparkles, Wifi, WifiOff, User } from "lucide-react";
import type { Tool } from "@/lib/types";
import { idbGet, saveLocalBoard } from "@/lib/idb";

const LOCAL_BOARD_ID = "current";

export default function Index() {
  const { user, signOut } = useAuth();
  const { settings, update, online } = useSyncEngine();
  const canvasRef = useRef<SmartCanvasHandle>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(settings.brush_settings.color);
  const [size, setSize] = useState(settings.brush_settings.size);
  const [cameraOn, setCameraOn] = useState(false);
  const [pose, setPose] = useState<string>("NONE");
  const [boardSize, setBoardSize] = useState({ w: 800, h: 600 });

  // Track canvas wrapper size for gesture coords
  useEffect(() => {
    const el = document.getElementById("canvas-wrap");
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setBoardSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Sync brush from settings on first load
  useEffect(() => { setColor(settings.brush_settings.color); setSize(settings.brush_settings.size); }, [settings.brush_settings.color, settings.brush_settings.size]);

  // Restore last local board
  useEffect(() => {
    idbGet<{ objects: unknown[] }>("boards", LOCAL_BOARD_ID).then((d) => {
      if (d && canvasRef.current) canvasRef.current.loadData(d as never);
    });
  }, []);

  function onFrame(f: GestureFrame) {
    setPose(f.pose);
    // Map pose → tool from settings
    const mapped = settings.gesture_mappings[f.pose as keyof typeof settings.gesture_mappings];
    if (mapped && mapped !== tool && f.pose !== "NONE") setTool(mapped);
    canvasRef.current?.applyGestureCursor(f.pose, f.cursor);
  }

  return (
    <main className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      <OnboardingTour />

      {/* Top bar */}
      <header className="flex items-center justify-between gap-2 px-3 py-2 glass z-20">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--gradient-accent)" }}>
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="hidden sm:block min-w-0">
            <h1 className="text-sm font-semibold truncate">Gesture Whiteboard</h1>
            <p className="text-[10px] text-muted-foreground truncate">{pose !== "NONE" ? `Gesture: ${pose}` : "Draw with your hand or mouse"}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground" title={online ? "Online" : "Offline"}>
            {online ? <Wifi className="w-3.5 h-3.5 text-success" /> : <WifiOff className="w-3.5 h-3.5 text-warning" />}
            {online ? "Online" : "Offline"}
          </span>
          <span data-tour="export">
            <ExportShareMenu
              exportPNG={() => canvasRef.current!.exportPNG(settings.theme === "light" ? "#ffffff" : "#0d0f1a")}
              exportData={() => canvasRef.current!.exportData()}
              loadData={(d) => canvasRef.current?.loadData(d)}
            />
          </span>
          <span data-tour="settings"><SettingsPanel settings={settings} update={update} /></span>
          {user ? (
            <Button variant="ghost" size="icon" onClick={signOut} title="Sign out"><LogOut className="w-4 h-4" /></Button>
          ) : (
            <Button asChild variant="outline" size="sm" className="gap-1"><Link to="/auth"><User className="w-3.5 h-3.5" />Sign in</Link></Button>
          )}
        </div>
      </header>

      <div className="flex-1 relative flex">
        {/* Toolbar — vertical on left, floating on mobile */}
        <aside data-tour="toolbar" className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
          <Toolbar
            tool={tool} setTool={setTool} color={color} setColor={setColor} size={size} setSize={setSize}
            onUndo={() => canvasRef.current?.undo()}
            onClear={() => { if (confirm("Clear the entire board?")) canvasRef.current?.clear(); }}
          />
        </aside>

        {/* Canvas */}
        <div id="canvas-wrap" className="flex-1 m-2 ml-16 sm:ml-20 rounded-xl overflow-hidden">
          <SmartCanvas
            ref={canvasRef}
            tool={tool}
            color={color}
            size={size}
            smartInkMode={settings.smart_ink_mode}
            online={online}
            onChange={(d) => { saveLocalBoard(LOCAL_BOARD_ID, d); }}
          />
        </div>

        {/* Gesture controller (with camera preview) */}
        <span data-tour="camera">
          <GestureController
            width={boardSize.w}
            height={boardSize.h}
            enabled={cameraOn}
            mirror={settings.mirror_camera}
            smoothing={settings.smoothing}
            onFrame={onFrame}
            onToggle={setCameraOn}
          />
        </span>
      </div>
    </main>
  );
}
