// Smart Ink AI — calls our edge function for handwriting/shape recognition.
import { supabase } from "@/integrations/supabase/client";

export interface AIRecognition {
  kind: "text" | "shape" | "equation" | "unknown";
  value: string;
  confidence: number;
}

export async function recognizeInkAI(pngDataUrl: string): Promise<AIRecognition | null> {
  try {
    const { data, error } = await supabase.functions.invoke("smart-ink-ai", { body: { image: pngDataUrl } });
    if (error) {
      console.warn("Smart Ink AI error:", error.message);
      return null;
    }
    return data as AIRecognition;
  } catch (e) {
    console.warn("Smart Ink AI failed", e);
    return null;
  }
}
