const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { image } = await req.json();
    if (!image || typeof image !== "string") {
      return json({ error: "image (base64 data URL) is required" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You inspect a small image of a hand-drawn sketch and decide what the user meant to draw. Respond ONLY by calling the recognize tool." },
          { role: "user", content: [
            { type: "text", text: "Recognize this sketch." },
            { type: "image_url", image_url: { url: image } },
          ]},
        ],
        tools: [{
          type: "function",
          function: {
            name: "recognize",
            description: "Return the recognized content of the sketch.",
            parameters: {
              type: "object",
              properties: {
                kind: { type: "string", enum: ["text", "shape", "equation", "unknown"] },
                value: { type: "string", description: "Plain text of the recognized content; for shapes use 'circle'|'rect'|'arrow'|'line'|'triangle'." },
                confidence: { type: "number", minimum: 0, maximum: 1 },
              },
              required: ["kind", "value", "confidence"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "recognize" } },
      }),
    });

    if (resp.status === 429) return json({ error: "Rate limited. Try again shortly." }, 429);
    if (resp.status === 402) return json({ error: "AI credits exhausted." }, 402);
    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      return json({ error: "AI gateway error" }, 500);
    }

    const data = await resp.json();
    const tc = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = tc?.function?.arguments ? JSON.parse(tc.function.arguments) : null;
    if (!args) return json({ kind: "unknown", value: "", confidence: 0 });
    return json(args);
  } catch (e) {
    console.error("smart-ink-ai error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
