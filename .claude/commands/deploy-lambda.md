---
description: Step-by-step Lambda deployment for ldk-quiz-api or ldk-quiz-grader
---

# Deploy Lambda

Ask the user which Lambda to deploy if not specified: **api** or **grader**.

## Deploy ldk-quiz-api (the API Lambda)

**File:** `lambda/index.mjs`  
**Function URL:** `https://wsi4xjvsewtoshfwqc2m2e24t40yvczk.lambda-url.us-east-1.on.aws/`

**Step 1 — Build the zip in VS Code terminal:**
```powershell
Compress-Archive -Force -Path lambda\index.mjs, lambda\node_modules, lambda\package.json -DestinationPath lambda.zip
```

**Step 2 — Upload:**
1. AWS Console → Lambda → **ldk-quiz-api**
2. Code tab → Upload from → .zip file → select `lambda.zip` → Save
3. Confirm the green success banner says **ldk-quiz-api** (not the grader)

**Step 3 — Verify it's live:**
```
https://wsi4xjvsewtoshfwqc2m2e24t40yvczk.lambda-url.us-east-1.on.aws/version
```
Should return the version string you set in the code.

---

## Deploy ldk-quiz-grader (the grader Lambda)

**File:** `lambda/grader-deploy.mjs` → must be renamed to `index.mjs` in the zip  
**Function URL:** `https://b5sk52hgpymcgmg3knpgzyjwim0dcpwr.lambda-url.us-east-1.on.aws/`  
**No node_modules needed** (grader uses raw `fetch`, no deps)

**Step 1 — Build the zip in VS Code terminal:**
```powershell
# Copy grader file as index.mjs into a temp folder, then zip it
Copy-Item lambda\grader-deploy.mjs -Destination lambda\index-grader-temp.mjs
Compress-Archive -Force -Path lambda\index-grader-temp.mjs -DestinationPath grader.zip
Remove-Item lambda\index-grader-temp.mjs
```

**Step 2 — Upload:**
1. AWS Console → Lambda → **ldk-quiz-grader**
2. Code tab → Upload from → .zip file → select `grader.zip` → Save
3. ⚠️ Confirm the green success banner says **ldk-quiz-grader** — easy to upload to the wrong one

**Step 3 — Verify:**
Send a test grading request or check the grader logs in CloudWatch.

---

## ⚠️ Rules that must never be broken
- NEVER enable CORS in AWS Function URL settings — CORS is in Lambda code only
- ALWAYS include `lambda/node_modules` when zipping the API (not the grader)
- ALWAYS confirm the success banner names the correct function before closing the console
