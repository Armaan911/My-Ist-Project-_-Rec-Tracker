// Server-side Gemini call with multi-key load-balancing + failover.
// Model is configurable; flash is cheap/fast for short summaries.
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// Pool of API keys: GEMINI_API_KEY, GEMINI_API_KEY_2..5, and/or a comma-separated
// GEMINI_API_KEYS. Load is spread across them and we fail over on quota/rate errors, so a
// single key's quota isn't the ceiling.
function geminiKeys(): string[] {
  const raw = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5,
    ...(process.env.GEMINI_API_KEYS || "").split(","),
  ];
  return [...new Set(raw.map((k) => (k || "").trim()).filter(Boolean))];
}

type CallResult = { ok: true; text: string } | { ok: false; reason: string; retryable: boolean };

async function callGemini(prompt: string, key: string, maxOutputTokens: number): Promise<CallResult> {
  // 2.5/3.x "think" by default and thinking tokens bill against output — disable it and keep
  // the output budget tight, since our summaries are only a few sentences.
  const supportsThinking = /gemini-(2\.5|3)/.test(MODEL);
  const generationConfig: Record<string, unknown> = { temperature: 0.4, maxOutputTokens };
  if (supportsThinking) generationConfig.thinkingConfig = { thinkingBudget: 0 };
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig }) }
    );
    const data = await res.json().catch(() => null as any);
    if (!res.ok) {
      const reason = data?.error?.message || `HTTP ${res.status}`;
      const retryable = res.status === 429 || res.status >= 500 || /quota|rate|exhaust|overload|unavailable/i.test(reason);
      return { ok: false, reason: `(${res.status}) ${reason}`, retryable };
    }
    const cand = data?.candidates?.[0];
    const text = (cand?.content?.parts ?? []).map((p: any) => p?.text).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    if (text) return { ok: true, text };
    const reason = data?.promptFeedback?.blockReason || cand?.finishReason || "empty response";
    return { ok: false, reason, retryable: false }; // safety block / truncation would recur on any key
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? "network error", retryable: true };
  }
}

// Generate text. `maxOutputTokens` is kept small by default — our outputs are short reads.
export async function geminiGenerate(prompt: string, maxOutputTokens = 512): Promise<string> {
  const keys = geminiKeys();
  if (!keys.length) return "AI summary unavailable — GEMINI_API_KEY is not set.";
  // Shuffle so load spreads across keys; fail over to the next key on quota/transient errors.
  const order = keys.map((k) => [Math.random(), k] as const).sort((a, b) => a[0] - b[0]).map(([, k]) => k);
  let lastReason = "";
  for (const key of order) {
    const r = await callGemini(prompt, key, maxOutputTokens);
    if (r.ok) return r.text;
    lastReason = r.reason;
    if (!r.retryable) break;
  }
  return `AI error: ${lastReason}`;
}
