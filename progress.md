# Session Progress — 2026-03-26

## What Was Accomplished

### ✅ Quiz buttons fixed
- `handleSectionStart` was awaiting `startAttempt()` before switching screens
- Supabase was timing out → buttons appeared frozen
- Fix: switched to quiz screen immediately, Supabase call runs in background
- Committed and pushed to `claude/resume-session-KJyRW`
- **Still needs merge to `main` to deploy to quiz.ldk.lat**

### ✅ S3 handbook uploaded
- Bucket: `ldk-quiz-handbook` (us-east-1)
- Files: `handbook-esp.txt.txt` (118 KB), `handbook-en.txt.txt` (109 KB)
- IAM permission added to Lambda role: `s3:GetObject` on the bucket

### ✅ Lambda runtime upgraded
- Was: Node.js 24.x (broke Anthropic SDK layer)
- Now: Node.js 22.x (bundles `@aws-sdk/client-s3` natively, no layer needed)

### ✅ Lambda rewritten (no Anthropic SDK layer)
- Removed `@anthropic-ai/sdk` import (layer incompatible with Node.js 22)
- Now uses native `fetch()` to call Anthropic API directly
- API key reads from `process.env.ANTHROPIC_API_KEY` (already set in Lambda env vars)
- Handbook loads from S3 on cold start, cached in memory for warm invocations
- Handbook IS loading: 230,312 chars confirmed in CloudWatch

---

## Current Lambda Code (in AWS console, not in repo)

```javascript
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: "us-east-1" });
const BUCKET = "ldk-quiz-handbook";
let handbookCache = null;

async function fetchHandbook() {
  if (handbookCache) return handbookCache;
  const fetchFile = async (key) => {
    try {
      const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
      return await res.Body.transformToString("utf-8");
    } catch (e) {
      console.log("S3 fetch failed for", key, e.message);
      return "";
    }
  };
  const [es, en] = await Promise.all([
    fetchFile("handbook-esp.txt.txt"),
    fetchFile("handbook-en.txt.txt"),
  ]);
  handbookCache = [
    es ? `## Manual de Ventas LDK (Español)\n\n${es}` : "",
    en ? `## LDK Sales Handbook (English)\n\n${en}` : "",
  ].filter(Boolean).join("\n\n---\n\n");
  console.log("Handbook loaded, length:", handbookCache.length);
  return handbookCache;
}

export const handler = async (event) => {
  const body = typeof event.body === "string" ? JSON.parse(event.body) : event.body ?? event;
  const { question, answer, modelAnswer, section } = body;
  const handbook = await fetchHandbook();
  const systemPrompt = `Eres un evaluador experto del equipo de ventas de LDK DMC...
  [lenient grading prompt + handbook injection]`;
  // ... calls Anthropic API via fetch(), parses JSON, returns result
};
```

---

## 🐛 Active Bug: "Error al conectar con el servidor de evaluación"

### What CloudWatch shows (last successful invocation):
- `Handbook loaded, length: 230312` ✓
- `Anthropic status: 200` ✓
- `Anthropic response: {"model":"claude-haiku-4-5-20251001"...` (Claude DID respond)

### Root cause identified:
Claude Haiku is returning JSON **without curly braces**, wrapped in markdown:
```
```json
  "passed": false,
  "feedback": "No se proporcionaron los datos necesarios...",
  "correct_answer": null
```
```
Instead of:
```json
{"passed": false, "feedback": "...", "correct_answer": null}
```

The regex `text.match(/\{[\s\S]*\}/)` returns null → `JSON.parse(fullText)` throws → Lambda falls back to `{passed: false, feedback: "Error al procesar la evaluación."}` → Lambda returns 200.

But the **frontend still shows "Error al conectar"** (its own catch block) despite the Lambda returning 200. This means something is throwing in the frontend's fetch chain. Needs browser DevTools → Network tab investigation.

### Additional concern:
Claude's feedback says "No se proporcionaron los datos necesarios para evaluar la respuesta. Faltan: la sección del handbook..." — Claude Haiku is **confused by the 230K-char handbook** in the system prompt. It's treating it as something it needs to search rather than context it already has.

---

## Tomorrow's Fixes (in priority order)

### Fix 1: Repair JSON parsing in Lambda
Claude returns JSON without `{}` — fix the parser to handle this:
```javascript
// After getting text from Claude:
let jsonStr = text;
// Strip markdown code fences
jsonStr = jsonStr.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
// If missing braces, wrap it
if (!jsonStr.startsWith("{")) jsonStr = "{" + jsonStr + "}";
result = JSON.parse(jsonStr);
```

### Fix 2: Investigate frontend "Error al conectar"
- Open quiz.ldk.lat → DevTools (F12) → Network tab
- Submit an answer
- Find the Lambda request and check: HTTP status, response body, CORS headers
- The Lambda IS returning 200 but browser may be seeing something different

### Fix 3: Reduce handbook noise in Claude's context
The 230K handbook is confusing Claude Haiku. Options:
- **Option A**: Trim handbooks to only the most relevant sections (product/sales info, not full manual)
- **Option B**: Switch from Haiku to `claude-sonnet-4-5` for better instruction-following (slightly higher cost/latency)
- **Option C**: Move handbook to a separate "documents" block using Anthropic's document API

### Fix 4: Deploy quiz button fix to production
The `handleSectionStart` fix is on `claude/resume-session-KJyRW` but NOT yet on `main`.
- Merge `claude/resume-session-KJyRW` → `main` on GitHub → Amplify auto-deploys

---

## Infrastructure Reference
- **Lambda URL**: `https://b5sk52hgpymcgmg3knpgzyjwim0dcpwr.lambda-url.us-east-1.on.aws/`
- **Lambda name**: `ldk-quiz-grader`
- **Lambda runtime**: Node.js 22.x
- **S3 bucket**: `ldk-quiz-handbook`
- **Supabase**: `https://eqwrrcgclzaxvqglpqzj.supabase.co`
- **Amplify**: quiz.ldk.lat (deploys from `main` branch)
- **GitHub**: `kaho1312/ldk-sales-team-evaluation`
- **Dev branch**: `claude/resume-session-KJyRW`
