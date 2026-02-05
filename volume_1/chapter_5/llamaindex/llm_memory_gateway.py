"""LLM Memory Gateway - LlamaIndex with session-based memory (in-memory only)."""

import os
import sys
from typing import Dict, List, Tuple

CHAPTER_4_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "chapter_4"))
CHAPTER_4_LLAMAINDEX = os.path.join(CHAPTER_4_ROOT, "llamaindex")

sys.path.append(CHAPTER_4_ROOT)
sys.path.append(CHAPTER_4_LLAMAINDEX)

from llama_index.core.llms import ChatMessage

from llm_gateway import LlamaIndexLLMManager as Chapter4LlamaIndexManager
from utils import get_default_model, interactive_cli


class LlamaIndexLLMManager(Chapter4LlamaIndexManager):
    """Chapter 5 manager that reuses chapter 4 LlamaIndex client creation."""

    def __init__(self, memory_enabled: bool = True):
        self.memory_enabled = memory_enabled
        self.histories: Dict[Tuple[str, str], List[ChatMessage]] = {}
        super().__init__()
        self.framework = "LlamaIndex+Memory"

    def _get_history(self, provider: str, session_id: str) -> List[ChatMessage]:
        key = (provider, session_id)
        if key not in self.histories:
            self.histories[key] = []
        return self.histories[key]

    def ask_question(
        self,
        topic: str,
        provider: str = None,
        template: str = "{topic}",
        max_tokens: int = 1000,
        temperature: float = 0.7,
        session_id: str = "default",
    ) -> Dict:
        if not self.memory_enabled:
            return super().ask_question(topic, provider, template, max_tokens, temperature)

        prompt = template.format(topic=topic)
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
            client = self._create_client(provider, temperature=temperature, max_tokens=max_tokens)
            history = self._get_history(provider, session_id)
            messages = [*history, ChatMessage(role="user", content=prompt)]

            result = client.chat(messages)
            response_text = self._extract_text(result)

            history.append(ChatMessage(role="user", content=prompt))
            history.append(ChatMessage(role="assistant", content=response_text))

            return {
                "success": True,
                "provider": provider,
                "model": model,
                "prompt": prompt,
                "response": response_text,
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

    def get_history(self, provider: str, session_id: str = "default") -> Dict:
        turns = [
            {"role": str(msg.role), "content": msg.content}
            for msg in self._get_history(provider, session_id)
        ]
        return {
            "provider": provider,
            "session_id": session_id,
            "turns": turns,
            "count": len(turns),
        }

    def reset_memory(self, provider: str = None, session_id: str = None) -> Dict:
        removed = []

        if provider and session_id:
            key = (provider, session_id)
            self.histories.pop(key, None)
            removed.append(key)
        elif provider:
            for key in list(self.histories.keys()):
                if key[0] == provider:
                    self.histories.pop(key, None)
                    removed.append(key)
        elif session_id:
            for key in list(self.histories.keys()):
                if key[1] == session_id:
                    self.histories.pop(key, None)
                    removed.append(key)
        else:
            self.histories.clear()
            removed = ["ALL"]

        return {"status": "cleared", "removed_sessions": removed}


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "web":
        from web import run_web_server

        run_web_server(lambda: LlamaIndexLLMManager(memory_enabled=True))
    else:
        interactive_cli(LlamaIndexLLMManager(memory_enabled=True))


if __name__ == "__main__":
    main()
