"""LLM Memory History Gateway - LangChain with persistent session memory."""

import os
import sys
from pathlib import Path
from typing import Dict

CHAPTER_4_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "chapter_4"))
sys.path.append(CHAPTER_4_ROOT)
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from langchain_community.chat_message_histories import FileChatMessageHistory

from llm_memory_gateway import LangChainLLMManager as InMemoryLangChainLLMManager
from utils import interactive_cli


class LangChainLLMManager(InMemoryLangChainLLMManager):
    """Persistent-memory variant that reuses the in-memory manager behavior."""

    def __init__(self, memory_enabled: bool = True):
        super().__init__(memory_enabled=memory_enabled)
        self.framework = "LangChain+History"

    def _session_file_path(self, provider: str, session_id: str) -> Path:
        sessions_dir = Path(__file__).resolve().parent / "sessions"
        sessions_dir.mkdir(parents=True, exist_ok=True)
        return sessions_dir / f"{provider}__{session_id}.json"

    def _get_history(self, provider: str, session_id: str) -> FileChatMessageHistory:
        key = (provider, session_id)
        if key not in self.histories:
            self.histories[key] = FileChatMessageHistory(file_path=str(self._session_file_path(provider, session_id)))
        return self.histories[key]

    def reset_memory(self, provider: str = None, session_id: str = None) -> Dict:
        result = super().reset_memory(provider=provider, session_id=session_id)

        if result["removed_sessions"] == ["ALL"]:
            for path in (Path(__file__).resolve().parent / "sessions").glob("*.json"):
                path.unlink(missing_ok=True)
            return result

        for key in result["removed_sessions"]:
            if isinstance(key, tuple):
                self._session_file_path(*key).unlink(missing_ok=True)

        return result


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "web":
        from web import run_web_server

        run_web_server(lambda: LangChainLLMManager(memory_enabled=True))
    else:
        interactive_cli(LangChainLLMManager(memory_enabled=True))


if __name__ == "__main__":
    main()
