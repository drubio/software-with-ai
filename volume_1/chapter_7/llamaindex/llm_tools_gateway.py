"""LLM Tools Gateway - LlamaIndex (Chapter 7).

Builds on Chapter 6 manager hierarchy:
Chapter 4 (base providers) -> Chapter 5 (memory/persistence) ->
Chapter 6 (structured patterns) -> Chapter 7 (tool use).
"""

from __future__ import annotations

import json
import os
import re
import sys
from typing import Dict, Optional

from llama_index.core.llms import ChatMessage

CHAPTER_4_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "chapter_4"))
CHAPTER_6_LLAMAINDEX = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "chapter_6", "llamaindex"))
CHAPTER_7_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

sys.path.append(CHAPTER_4_ROOT)
sys.path.append(CHAPTER_6_LLAMAINDEX)
sys.path.append(CHAPTER_7_ROOT)

from llm_structured_gateway import LlamaIndexLLMManager as Chapter6LlamaIndexManager
from tools import build_tools_prompt, run_tool
from utils import get_default_model, interactive_cli

TOOLS_TEMPLATE = """
You are a helpful assistant with access to external tools.

Available tools:
{tools}

For every response, return strict JSON with this shape:
{{
  "tool_call": null OR {{"name": "tool_name", "arguments": {{"arg": "value"}}}},
  "final_answer": "string"
}}

Rules:
- If no tool is needed, set tool_call to null.
- If a tool is needed, set tool_call and keep final_answer short (what you expect to answer after tool execution).
- Return JSON only.

User topic: {topic}
""".strip()

FOLLOW_UP_TEMPLATE = """
You already requested a tool and now have the result.

Original user topic: {topic}
Tool call: {tool_call}
Tool output: {tool_output}

Return strict JSON:
{{
  "tool_call": null,
  "final_answer": "final response for the user"
}}
""".strip()


class LlamaIndexLLMManager(Chapter6LlamaIndexManager):
    """Chapter 7 LlamaIndex manager with simple JSON-driven tool execution."""

    def __init__(self, memory_enabled: bool = True):
        super().__init__(memory_enabled=memory_enabled)
        self.framework = "LlamaIndex+Tools"

    @staticmethod
    def _extract_json_object(raw: str) -> Dict:
        text = raw.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]

        text = text.strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            match = re.search(r"\{[\s\S]*\}", text)
            if not match:
                raise
            return json.loads(match.group(0))

    def _invoke_json_step(self, provider: str, prompt: str, temperature: float, max_tokens: int) -> Dict:
        client = self._create_client(provider, temperature=temperature, max_tokens=max_tokens)
        result = client.chat([ChatMessage(role="user", content=prompt)])
        text = self._extract_text(result)
        return self._extract_json_object(text)

    def ask_question(
        self,
        topic: str,
        provider: Optional[str] = None,
        template: str = TOOLS_TEMPLATE,
        max_tokens: int = 1000,
        temperature: float = 0.2,
        session_id: str = "default",
    ) -> Dict:
        prompt = template.format(topic=topic, tools=build_tools_prompt())
        provider = self._resolve_provider(provider)

        if not provider:
            return {
                "success": False,
                "error": "No providers available",
                "provider": "none",
                "model": "none",
                "prompt": prompt,
                "response": None,
            }

        model = get_default_model(provider)

        try:
            first_step = self._invoke_json_step(provider, prompt, temperature=temperature, max_tokens=max_tokens)
            tool_call = first_step.get("tool_call")
            final_answer = str(first_step.get("final_answer", "")).strip()

            tool_output = None
            if isinstance(tool_call, dict) and tool_call.get("name"):
                tool_name = str(tool_call.get("name"))
                tool_args = tool_call.get("arguments") or {}
                if not isinstance(tool_args, dict):
                    tool_args = {}

                tool_output = run_tool(tool_name, tool_args)

                follow_up_prompt = FOLLOW_UP_TEMPLATE.format(
                    topic=topic,
                    tool_call=json.dumps(tool_call, ensure_ascii=False),
                    tool_output=tool_output,
                )
                second_step = self._invoke_json_step(provider, follow_up_prompt, temperature=temperature, max_tokens=max_tokens)
                final_answer = str(second_step.get("final_answer", final_answer)).strip() or final_answer

            return {
                "success": True,
                "provider": provider,
                "model": model,
                "prompt": prompt,
                "response": {
                    "tool_call": tool_call,
                    "tool_output": tool_output,
                    "final_answer": final_answer,
                },
                "raw_answer": final_answer,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "session_id": session_id,
            }
        except Exception as exc:
            return {
                "success": False,
                "provider": provider,
                "model": model,
                "prompt": prompt,
                "error": str(exc),
                "response": None,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "session_id": session_id,
            }


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "web":
        from web import run_web_server

        run_web_server(lambda: LlamaIndexLLMManager(memory_enabled=True))
    else:
        interactive_cli(LlamaIndexLLMManager(memory_enabled=True))


if __name__ == "__main__":
    main()
