# LLM Structured Gateway

This chapter extends Chapter 5's memory-enabled gateways with **structured JSON output**.

It provides cross-framework (**LangChain**, **LlamaIndex**) and dual-language (**Python**, **JavaScript**) implementations that:

- Reuse Chapter 4 base provider/client setup and shared CLI/Web helpers
- Reuse Chapter 5 persistent session-memory behavior
- Add Chapter 6 structured prompt + JSON parsing on top

Just like earlier chapters, each script can run in:
- **Command line mode**
- **Web API mode**

## Project structure

```text
chapter_6/
├── langchain/
│   ├── llm_structured_gateway.py
│   └── llm_structured_gateway.js
├── llamaindex/
│   ├── llm_structured_gateway.py
│   └── llm_structured_gateway.js
└── README.md
```

## Script matrix

| Framework | Python | JavaScript |
|---|---|---|
| **LangChain** | `langchain/llm_structured_gateway.py` | `langchain/llm_structured_gateway.js` |
| **LlamaIndex** | `llamaindex/llm_structured_gateway.py` | `llamaindex/llm_structured_gateway.js` |

## Dependencies and environment

Chapter 6 builds on Chapter 4 and 5:

- Chapter 4 shared utilities and web server helpers
- Chapter 5 memory + persistence managers
- Chapter 4 `.env` for API keys

Set keys in `volume_1/chapter_4/.env`:

```env
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
GOOGLE_API_KEY=your-google-key
XAI_API_KEY=your-xai-key
```

## Usage

Run commands from `volume_1/chapter_6`.

### Command line mode

#### Python

```bash
python langchain/llm_structured_gateway.py
python llamaindex/llm_structured_gateway.py
```

#### JavaScript

```bash
node langchain/llm_structured_gateway.js
node llamaindex/llm_structured_gateway.js
```

### Web API mode

```bash
python langchain/llm_structured_gateway.py web
node llamaindex/llm_structured_gateway.js web
```

## Structured response format

Both Chapter 6 managers request and parse this JSON shape:

```json
{
  "answer": "direct answer",
  "summary": "question summary",
  "keywords": ["keyword1", "keyword2"],
  "distilled": "short distilled form"
}
```

On success, `response` contains the parsed JSON object and `raw_answer`/`rawAnswer` contains the extracted answer field.

## Notes

- Session memory remains isolated by `provider` + `session_id`.
- Persistence behavior (read/write/reset of session files) is inherited from Chapter 5.
- If a model returns non-JSON output, the manager returns a parsing error with the original raw response.
