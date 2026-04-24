import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Loader2, Sparkles } from "lucide-react";

export default function Auth() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast({ title: "Account created", description: "You're signed in." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      nav("/");
    } catch (err) {
      toast({ title: "Auth failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      toast({ title: "Google sign-in unavailable", description: error.message, variant: "destructive" });
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md glass shadow-toolbar">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: "var(--gradient-accent)" }}>
            <Sparkles className="w-6 h-6 text-primary-foreground" />
          </div>
          <CardTitle className="gradient-text">{mode === "signin" ? "Welcome back" : "Create your account"}</CardTitle>
          <CardDescription>Sync your gestures, brushes, and boards across devices.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={submit} className="space-y-3">
            <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <div className="flex items-center gap-2"><div className="flex-1 h-px bg-border" /><span className="text-xs text-muted-foreground">or</span><div className="flex-1 h-px bg-border" /></div>
          <Button variant="outline" className="w-full" onClick={google} disabled={busy}>Continue with Google</Button>
          <p className="text-center text-sm text-muted-foreground">
            {mode === "signin" ? "No account?" : "Already have one?"}{" "}
            <button className="text-primary underline" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
          <Button variant="ghost" className="w-full" onClick={() => nav("/")}>Continue as guest</Button>
        </CardContent>
      </Card>
    </main>
  );
}
