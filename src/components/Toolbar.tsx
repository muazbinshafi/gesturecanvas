import { Button } from "@/components/ui/button";
import { Pencil, Square, Circle, ArrowUpRight, Type, Eraser, MousePointer2, Hand, Undo2, Trash2 } from "lucide-react";
import type { Tool } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  tool: Tool;
  setTool: (t: Tool) => void;
  color: string;
  setColor: (c: string) => void;
  size: number;
  setSize: (n: number) => void;
  onUndo: () => void;
  onClear: () => void;
}

const TOOLS: { id: Tool; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "pen", label: "Pen", icon: Pencil },
  { id: "eraser", label: "Eraser", icon: Eraser },
  { id: "rect", label: "Rectangle", icon: Square },
  { id: "circle", label: "Circle", icon: Circle },
  { id: "arrow", label: "Arrow", icon: ArrowUpRight },
  { id: "text", label: "Text", icon: Type },
  { id: "select", label: "Select", icon: MousePointer2 },
  { id: "pan", label: "Pan", icon: Hand },
];

const COLORS = ["#a78bfa", "#22d3ee", "#f472b6", "#facc15", "#34d399", "#f87171", "#f8fafc", "#0d0f1a"];

export function Toolbar({ tool, setTool, color, setColor, size, setSize, onUndo, onClear }: Props) {
  return (
    <div className="glass shadow-toolbar rounded-2xl p-2 flex flex-col gap-2 max-h-[80vh] overflow-auto">
      <div className="grid grid-cols-2 gap-1">
        {TOOLS.map((t) => (
          <Button key={t.id} size="icon" variant={tool === t.id ? "default" : "ghost"} className={cn("h-9 w-9", tool === t.id && "shadow-glow")} onClick={() => setTool(t.id)} aria-label={t.label} title={t.label}>
            <t.icon className="w-4 h-4" />
          </Button>
        ))}
      </div>
      <div className="border-t border-border/40 pt-2">
        <div className="grid grid-cols-4 gap-1.5 px-1">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={cn("w-6 h-6 rounded-full border-2 transition-transform", color === c ? "border-foreground scale-110" : "border-border/40")}
              style={{ background: c }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
        <input type="range" min={1} max={20} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-full mt-2 accent-primary" aria-label="Brush size" />
      </div>
      <div className="border-t border-border/40 pt-2 flex flex-col gap-1">
        <Button size="icon" variant="ghost" className="h-8 w-9" onClick={onUndo} aria-label="Undo" title="Undo"><Undo2 className="w-4 h-4" /></Button>
        <Button size="icon" variant="ghost" className="h-8 w-9 text-destructive" onClick={onClear} aria-label="Clear board" title="Clear"><Trash2 className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}
