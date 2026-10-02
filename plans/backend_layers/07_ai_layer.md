# AI layer (aiAdapter)

> Extracted from `04_backend_architecture.md` (same decisions, no changes). Related: `03_data_modelling.md`

---

> AI part extracted from `02_tech_stack.md` §5 + `04_backend_architecture.md`.

## From tech stack

### Models
- **Chat model**: text in → text/JSON out (search → filters, review summaries, dish-match confirmation).
- **Embedding model**: text in → vector out (dish matching, meaning search).

### Providers & fallback
- **Chat:** Gemini → (limit/error) → OpenAI → (both fail) → keyword search
- **Embeddings:** **Gemini only** → (fail) → keyword search
  - Reason: embeddings from different providers are different "number systems" and can't be compared. Switching the embedding provider later requires re-converting all stored vectors.
- Gemini API free tier (via Google AI Studio). Note: free-tier data may be used by Google to improve products → never send private user data in prompts. Rate limits apply.
- OpenAI API usually needs prepaid credits.
- Consumer Gemini subscription (AI Plus) ≠ API access.

### aiAdapter layer
- One file (`aiAdapter.js`) with `chat()` and `embed()`; services never call a provider directly.
- Benefits: switch provider/model in one file, easy mocking in tests, one place for timeout/retry/error handling.
- Position: `controller → service → aiAdapter → Gemini/OpenAI` (alongside `service → repository → PostgreSQL`).

### Rules
- **Zod** validates every AI JSON output before use.
- **LLM for words, code for numbers**: ranking, scores, "Match for you %", order/mixed labels are computed by code.
- **Search result reasons** use **code templates** filled with DB data (not LLM).
- Timeout + retry; keyword search fallback.

---

## From backend architecture
- Only **services** call `aiAdapter` (folder `src/ai/`: aiAdapter.js, prompts/, schemas/ — Zod for AI output).
- **Search step 2 (Understand):** sentence → JSON filters `{ dish, spice, maxPrice, area, openNow, mood, mealTime, diet, vibe }`; Zod-validated; sentence→filters cached 24 h; Gemini → OpenAI → keyword parser (pg_trgm + simple rules). UI-picked filters override the AI's guess.
- **Search step 8 (Reason):** code template, not AI.
- **dishMatcher helper:** typed name → standard dish (alias → pg_trgm → embedding).
- **Jobs using AI:** AI summary refresh (every 5 new reviews) → menuItemService + aiAdapter · embeddings for new dishes / reviews → dishService / reviewService + aiAdapter.
- **AI caches:** sentence → filters `parse:<hash>` 24 h · text → embedding `embed:<hash>` 7 days.

### AI safety
- 5 s timeout, retry once, then fallback
- Chat: Gemini → OpenAI → keyword · Embeddings: Gemini → keyword
- Daily Gemini call counter in Redis → switch to fallback before hitting the free-tier limit
- Never send private data (notes, emails, names) in prompts
