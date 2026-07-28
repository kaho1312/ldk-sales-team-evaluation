// LDK quiz grader — evaluates open-ended answers with an LLM.
// Provider: DeepSeek (OpenAI-compatible Chat Completions API).
//   Endpoint: https://api.deepseek.com/chat/completions
//   Auth:     Authorization: Bearer <DEEPSEEK_API_KEY>
//   Model:    deepseek-chat (DeepSeek-V3)
// Contract is unchanged from the old Anthropic grader so the frontend needs no
// change: in  { question, answer, modelAnswer, section }
//          out { passed: bool, feedback: string, correct_answer: string|null }.
// On failure it also returns { error: true, error_detail } (extra fields the
// frontend ignores) so the cause is visible without digging through CloudWatch.

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";
const MAX_TOKENS = 1024;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const handler = async (event) => {
  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }

  const body = typeof event.body === "string" ? JSON.parse(event.body) : event.body ?? event;
  const { question, answer, modelAnswer, section } = body;

  const systemPrompt = `Eres un evaluador experto del equipo de ventas de LDK DMC, una empresa de turismo receptivo en México.

Tu tarea es evaluar si la respuesta de un agente de ventas es correcta, usando criterio interpretativo:

APROBAR si:
- La respuesta demuestra comprensión conceptual correcta, aunque use palabras diferentes
- Los números, fechas o datos específicos son correctos o muy cercanos
- La respuesta captura la idea principal aunque no sea exactamente como la respuesta modelo

REPROBAR si:
- La respuesta contiene información factualmente incorrecta
- La respuesta demuestra un malentendido fundamental del tema
- La respuesta está completamente en blanco o es irrelevante

NO REPROBAR por:
- Diferencias de redacción o vocabulario
- Respuestas más cortas que la respuesta modelo pero correctas
- Orden diferente de presentar la información correcta

Responde ÚNICAMENTE con un objeto JSON en este formato exacto:
{"passed": true/false, "feedback": "Explicación breve en español de máximo 2 oraciones", "correct_answer": "La respuesta correcta si reprobó, o null si aprobó"}`;

  const userMessage = `Sección: ${section}

Pregunta: ${question}

Respuesta modelo (referencia): ${modelAnswer}

Respuesta del agente: ${answer}

Evalúa la respuesta del agente y responde solo con el JSON.`;

  const apiKey = process.env.DEEPSEEK_API_KEY;
  const reply = (result, extra = {}) => ({
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ ...result, ...extra }),
  });
  const failure = (detail) => {
    console.log("Grader error:", detail);
    return reply(
      { passed: false, feedback: "Error al procesar la evaluación.", correct_answer: null },
      { error: true, error_detail: detail },
    );
  };

  if (!apiKey) return failure("DEEPSEEK_API_KEY no está configurada en el entorno de la Lambda.");

  // Up to 3 attempts, backing off on rate-limit / transient server errors.
  const RETRYABLE = new Set([429, 500, 502, 503, 504, 529]);
  let lastDetail = "sin respuesta";

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(DEEPSEEK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
        }),
      });

      const data = await response.json().catch(() => ({}));
      console.log("DeepSeek status:", response.status, "attempt", attempt);

      if (!response.ok) {
        lastDetail = `HTTP ${response.status}: ${data?.error?.message || data?.error?.type || "error desconocido"}`;
        console.log("DeepSeek error:", lastDetail);
        if (RETRYABLE.has(response.status) && attempt < 3) { await sleep(attempt * 800); continue; }
        return failure(lastDetail);
      }

      const text = (data?.choices?.[0]?.message?.content || "").trim();
      if (!text) { lastDetail = "respuesta vacía del modelo"; if (attempt < 3) { await sleep(attempt * 800); continue; } return failure(lastDetail); }

      let jsonStr = text.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
      if (!jsonStr.startsWith("{")) jsonStr = "{" + jsonStr + "}";
      const result = JSON.parse(jsonStr);

      return reply({
        passed: !!result.passed,
        feedback: typeof result.feedback === "string" ? result.feedback : "",
        correct_answer: result.correct_answer ?? null,
      });
    } catch (e) {
      lastDetail = e.message;
      console.log("Grader exception attempt", attempt, ":", e.message);
      if (attempt < 3) { await sleep(attempt * 800); continue; }
    }
  }

  return failure(lastDetail);
};
