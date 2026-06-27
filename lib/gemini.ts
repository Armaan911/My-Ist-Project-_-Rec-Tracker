// Server-side Gemini call. Model is configurable; flash is cheap/fast for summaries.
// gemini-2.5-flash has a usable free tier (earlier flash models hit a 0-quota 429).
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export async function geminiGenerate(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return "AI summary unavailable — GEMINI_API_KEY is not set.";
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 400 },
        }),
      }
    );
    if (!res.ok) return `AI error (${res.status}). Check the API key / model.`;
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "No summary produced.";
  } catch (e: any) {
    return "AI request failed: " + (e?.message ?? "unknown error");
  }
}
