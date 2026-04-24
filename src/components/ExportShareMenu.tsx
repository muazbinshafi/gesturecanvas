import { useRef, useState } from "react";
import { Download, FileJson, Image as ImageIcon, Link2, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { BoardData } from "@/lib/types";

interface Props {
  exportPNG: () => Promise<Blob | null>;
  exportData: () => BoardData;
  loadData: (d: BoardData) => void;
}

export function ExportShareMenu({ exportPNG, exportData, loadData }: Props) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handlePng() {
    const blob = await exportPNG();
    if (!blob) return;
    triggerDownload(blob, `board-${Date.now()}.png`);
    toast({ title: "PNG downloaded" });
  }

  function handleJson() {
    const data = exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    triggerDownload(blob, `board-${Date.now()}.lovable-board.json`);
    toast({ title: "Board JSON downloaded" });
  }

  function handleImport() {
    const f = fileRef.current?.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as BoardData;
        if (!Array.isArray(data.objects)) throw new Error("Invalid board file");
        loadData(data);
        toast({ title: "Board loaded" });
      } catch (e) {
        toast({ title: "Import failed", description: e instanceof Error ? e.message : "Invalid file", variant: "destructive" });
      }
    };
    reader.readAsText(f);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleShareLink() {
    if (!user) {
      toast({ title: "Sign in required", description: "Sign in to create a shareable link." });
      return;
    }
    setBusy(true);
    try {
      const data = exportData();
      const { data: row, error } = await supabase
        .from("whiteboards")
        .insert({
          user_id: user.id,
          title: `Board ${new Date().toLocaleString()}`,
          data: data as never,
          is_public: true,
          share_token: crypto.randomUUID(),
        })
        .select("share_token")
        .single();
      if (error) throw error;
      const url = `${window.location.origin}/b/${row.share_token}`;
      await navigator.clipboard.writeText(url);
      toast({ title: "Share link copied", description: url });
    } catch (e) {
      toast({ title: "Share failed", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-2"><Download className="w-4 h-4" />Export</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-2">
        <div className="flex flex-col">
          <Button variant="ghost" className="justify-start gap-2" onClick={handlePng}><ImageIcon className="w-4 h-4" />Download PNG</Button>
          <Button variant="ghost" className="justify-start gap-2" onClick={handleJson}><FileJson className="w-4 h-4" />Download JSON</Button>
          <Button variant="ghost" className="justify-start gap-2" onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4" />Import JSON</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={handleImport} />
          <div className="h-px bg-border/40 my-1" />
          <Button variant="ghost" className="justify-start gap-2" onClick={handleShareLink} disabled={busy} title={user ? "Copy public share link" : "Sign in to share"}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            {user ? "Copy share link" : "Sign in to share"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
