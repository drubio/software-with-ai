# LLM Memory Gateway

This chapter extends Chapter 4's universal LLM gateway with **conversation memory**.

It provides cross-framework (**LangChain**, **LlamaIndex**) and dual-language (**Python**, **JavaScript**) implementations in two memory modes:

- **In-memory session memory** (lives for process lifetime)
- **Persistent session memory** (stored on disk and reused across runs)

Just like Chapter 4, each script can be run in:
- **Command line mode**
- **Web API mode**

## Project structure and characteristics

```text
chapter_5/
├── langchain/
│   ├── llm_memory_gateway.py
│   ├── llm_memory_gateway.js
│   ├── llm_memory_persist_gateway.py
│   └── llm_memory_persist_gateway.js
├── llamaindex/
│   ├── llm_memory_gateway.py
│   ├── llm_memory_gateway.js
│   ├── llm_memory_persist_gateway.py
│   └── llm_memory_persist_gateway.js
└── README.md
```

### Script matrix

| Framework | In-memory (Python) | In-memory (JavaScript) | Persistent (Python) | Persistent (JavaScript) |
|---|---|---|---|---|
| **LangChain** | `langchain/llm_memory_gateway.py` | `langchain/llm_memory_gateway.js` | `langchain/llm_memory_persist_gateway.py` | `langchain/llm_memory_persist_gateway.js` |
| **LlamaIndex** | `llamaindex/llm_memory_gateway.py` | `llamaindex/llm_memory_gateway.js` | `llamaindex/llm_memory_persist_gateway.py` | `llamaindex/llm_memory_persist_gateway.js` |

## Dependencies and environment

Chapter 5 reuses Chapter 4 shared components:
- `chapter_4/utils.py` / `chapter_4/utils.js`
- `chapter_4/web.py` / `chapter_4/web.js`
- `chapter_4/requirements.txt` / `chapter_4/package.json`
- `chapter_4/.env`

Ensure API keys are set in `chapter_4/.env`:

```env
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
GOOGLE_API_KEY=your-google-key
XAI_API_KEY=your-xai-key
```

## Usage

> Run commands from this folder (`volume_1/chapter_5`) unless otherwise noted.

### Command line mode

#### Python

```bash
python langchain/llm_memory_gateway.py
python langchain/llm_memory_persist_gateway.py
python llamaindex/llm_memory_gateway.py
python llamaindex/llm_memory_persist_gateway.py
```

#### JavaScript

```bash
node langchain/llm_memory_gateway.js
node langchain/llm_memory_persist_gateway.js
node llamaindex/llm_memory_gateway.js
node llamaindex/llm_memory_persist_gateway.js
```

### Web API mode

Each script can launch a web API server (default port `8000`):

```bash
python langchain/llm_memory_gateway.py web
node llamaindex/llm_memory_persist_gateway.js web
```

## Memory-aware API endpoints

In addition to Chapter 4 endpoints (`/`, `/providers`, `/query`, `/query-all`, `/health`), memory-capable managers expose:

| Method | Path | Description |
|---|---|---|
| GET | `/history?provider=<name>&session_id=<id>` | Get stored turns for a provider/session |
| POST | `/reset-memory` | Clear memory by provider/session or clear all |

### Query with session context

Use `session_id` in `/query` requests so consecutive calls share context:

```bash
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{
        "topic": "My name is Sam. Remember it.",
        "provider": "openai",
        "session_id": "demo-1"
      }'
```

```bash
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{
        "topic": "What is my name?",
        "provider": "openai",
        "session_id": "demo-1"
      }'
```

### Read session history

```bash
curl "http://localhost:8000/history?provider=openai&session_id=demo-1"
```

### Reset memory

```bash
curl -X POST http://localhost:8000/reset-memory \
  -H "Content-Type: application/json" \
  -d '{"provider": "openai", "session_id": "demo-1"}'
```

To clear all sessions:

```bash
curl -X POST http://localhost:8000/reset-memory \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Notes

- Persistent variants save session memory to a local `sessions/` folder under each framework implementation.
- Session memory is isolated by both `provider` and `session_id`.
- Keep using Chapter 4 for base, stateless gateway behavior; use Chapter 5 when multi-turn memory is needed.
