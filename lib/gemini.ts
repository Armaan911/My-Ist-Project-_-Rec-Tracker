// Server-side Gemini call. Model is configurable; flash is cheap/fast for summaries.
// gemini-2.5-flash has a usable free tier (earlier flash models hit a 0-quota 429).
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export async function geminiGenerate(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return "AI summary unavailable — GEMINI_API_KEY is not set.";

  // 2.5 / 3.x models "think" by default, and thinking tokens are billed against the
  // output budget — leaving short summaries empty. Disable thinking for those models
  // and give the answer enough room.
  const supportsThinking = /gemini-(2\.5|3)/.test(MODEL);
  const generationConfig: Record<string, unknown> = { temperature: 0.4, maxOutputTokens: 2048 };
  if (supportsThinking) generationConfig.thinkingConfig = { thinkingBudget: 0 };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig }),
      }
    );
    const data = await res.json().catch(() => null as any);
    if (!res.ok) {
      // Surface Google's real reason (e.g. "API key not valid", "model not found", quota).
      const reason = data?.error?.message || `HTTP ${res.status}`;
      return `AI error (${res.status}): ${reason}`;
    }
    const cand = data?.candidates?.[0];
    const text = (cand?.content?.parts ?? [])
      .map((p: any) => p?.text)
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) return text;
    // No text: surface why (safety block, token limit, etc.) so it can be diagnosed.
    const reason = data?.promptFeedback?.blockReason || cand?.finishReason || "empty response";
    return `AI summary unavailable — ${reason}.`;
  } catch (e: any) {
    return "AI request failed: " + (e?.message ?? "unknown error");
  }
}
