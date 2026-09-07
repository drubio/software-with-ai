# Shared utilities

The `shared/` folder contains helper modules to run examples across the series and individual books in this repository.

## Purpose

These files centralize common logic so individual chapters avoid duplicating the same implementation details across Python and TypeScript examples.

## What's here

- `utils.py` / `utils.ts`: Utilities used across the book series, including provider/model lookup, response normalization, structured JSON parsing, logging and simple CLI helpers.
- `web.py` / `web.ts`: Web logic used across the book series, including app/server setup, manager construction, SSE formatting, chunk streaming and capability checks.
- `llm_models.py` / `llm_models.ts`: LLM configuration and initialization helpers used across the book series.
- `essentials/utils.py` / `essentials/utils.ts`: Utilities for the 'Agent Essentials' book, includes provider-manager base class and memory-aware interactive CLI flow.
- `essentials/web.py` / `essentials/web.ts`: Web logic for the 'Agent Essentials' book, includes status/providers/capabilities/query/query-stream/history/reset-memory endpoints.
- `.env` - Environment file with LLM API keys

## Environment Setup

For each language, install the dependencies in the root level folder (one level up from here)

### ❯ Example (Python)
   ```bash
   cd ../
   pip install -r requirements # or a pip alternative like poetry or uv
````

### ❯ Example (TypeScript)
   ```bash
   cd ../
   npm install
````

TypeScript exercises can import the `.ts` modules directly and run with `npx tsx`. Validate the TypeScript shared modules with `npm run typecheck:shared`.

### Create an `.env` file and place it here with the different provider LLM API keys:

   ```env
   ANTHROPIC_API_KEY="sk-ant-api03-xxxxxx"
   OPENAI_API_KEY="sk-proj-xxxx-xxxx-xxxx"
   GOOGLE_API_KEY="AIzaSyBAKuqxxxxxxxxxxxx"
   XAI_API_KEY="xai-UXxxxxxxx"
   DEEPSEEK_API_KEY="sk-e0fxxxxxxx"
   ```

### You're set! The chapters that require this shared code are ready to run!

## Which chapters use this shared folder?

The repository-level `shared/utils*`, `shared/web*`, and `shared/llm_models*` files are intended to be used across books and chapters. Book specific modules are under namespaced folders, like `shared/essentials/` used by the 'Agent Essentials' book. 
