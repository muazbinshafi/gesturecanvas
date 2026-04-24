import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SmartCanvas, type SmartCanvasHandle } from "@/components/SmartCanvas";
import type { BoardData } from "@/lib/types";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ShareView() {
  const { token } = useParams();
  const ref = useRef<SmartCanvasHandle>(null);
  const [state, setState] = useState<"loading" | "ready" | "notfound">("loading");
  const [title, setTitle] = useState("Shared board");
  const [data, setData] = useState<BoardData | null>(null);

  useEffect(() => {
    if (!token) { setState("notfound"); return; }
    (async () => {
      const { data: row, error } = await supabase
        .from("whiteboards")
        .select("title, data, is_public")
        .eq("share_token", token)
        .eq("is_public", true)
        .maybeSingle();
      if (error || !row) { setState("notfound"); return; }
      setTitle(row.title);
      setData(row.data as unknown as BoardData);
      setState("ready");
    })();
  }, [token]);

  useEffect(() => {
    if (state === "ready" && data && ref.current) ref.current.loadData(data);
  }, [state, data]);

  if (state === "loading") {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }
  if (state === "notfound") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-4 text-center">
        <h1 className="text-2xl font-bold">Board not found</h1>
        <p className="text-muted-foreground">This share link may have expired or been revoked.</p>
        <Button asChild><Link to="/">Open Whiteboard</Link></Button>
      </div>
    );
  }
  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center justify-between p-3 glass">
        <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" />Back</Link>
        <h1 className="font-semibold truncate">{title}</h1>
        <span className="text-xs text-muted-foreground">Read-only</span>
      </header>
      <div className="flex-1 p-2">
        <SmartCanvas
          ref={ref}
          tool="select" color="#a78bfa" size={4} smartInkMode="off" online={false} readOnly
          initialData={data ?? undefined}
        />
      </div>
    </div>
  );
}
