export const handler = async (event) => {
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
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

Responde ÚNICAMENTE en este formato JSON exacto:
{"passed": true/false, "feedback": "Explicación breve en español de máximo 2 oraciones", "correct_answer": "La respuesta correcta si reprobó, o null si aprobó"}`;

  const userMessage = `Sección: ${section}

Pregunta: ${question}

Respuesta modelo (referencia): ${modelAnswer}

Respuesta del agente: ${answer}

Evalúa la respuesta del agente.`;

  let result;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    console.log("Anthropic status:", response.status);
    const data = await response.json();
    console.log("Anthropic response:", JSON.stringify(data).slice(0, 300));

    if (!response.ok) {
      console.log("Anthropic error:", data.error?.type, data.error?.message);
      throw new Error(`Anthropic API error: ${data.error?.type}`);
    }

    const text = data.content[0].text.trim();
    let jsonStr = text.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
    if (!jsonStr.startsWith("{")) jsonStr = "{" + jsonStr + "}";
    result = JSON.parse(jsonStr);
  } catch (e) {
    console.log("Error:", e.message);
    result = { passed: false, feedback: "Error al procesar la evaluación.", correct_answer: null };
  }

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(result),
  };
};
