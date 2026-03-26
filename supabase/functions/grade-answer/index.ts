// Supabase Edge Function: grade-answer
// Replaces the AWS Lambda grading endpoint.
// Deploy: supabase functions deploy grade-answer
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import Anthropic from "npm:@anthropic-ai/sdk@0.36.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { question, answer, modelAnswer, section } = await req.json();

    if (!question || !answer || !modelAnswer) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const client = new Anthropic({ apiKey });

    const prompt = `You are grading a sales certification quiz for LDK DMC (a destination management company).

Question (Section ${section ?? "?"}): ${question}

Model Answer: ${modelAnswer}

Agent's Answer: ${answer}

Evaluate whether the agent's answer demonstrates sufficient understanding of the key concepts in the model answer. Be lenient with phrasing and synonyms — what matters is conceptual correctness. Minor omissions are acceptable; major gaps are not.

Respond in JSON only (no markdown):
{
  "passed": true or false,
  "feedback": "2-3 sentence coaching comment in the same language as the question. Address the agent directly (use 'Tu respuesta...' for Spanish or 'Your answer...' for English). Be encouraging but specific.",
  "correct_answer": "Brief ideal answer — only include this field if passed is false"
}`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (message.content[0] as { type: string; text: string }).text.trim();

    // Strip markdown code fences if present
    const jsonText = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const result = JSON.parse(jsonText);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("grade-answer error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
