"""LLM Memory History Gateway - LlamaIndex with persistent session memory."""

import os
import sys
from pathlib import Path
from typing import Dict

CHAPTER_4_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "chapter_4"))
sys.path.append(CHAPTER_4_ROOT)
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from llama_index.core.llms import ChatMessage

from llm_memory_gateway import LlamaIndexLLMManager as InMemoryLlamaIndexLLMManager
from utils import interactive_cli


class LlamaIndexLLMManager(InMemoryLlamaIndexLLMManager):
    """Persistent-memory variant that reuses the in-memory manager behavior."""

    def __init__(self, memory_enabled: bool = True):
        super().__init__(memory_enabled=memory_enabled)
        self.framework = "LlamaIndex+History"

    def _session_file_path(self, provider: str, session_id: str) -> Path:
        sessions_dir = Path(__file__).resolve().parent / "sessions"
        sessions_dir.mkdir(parents=True, exist_ok=True)
        return sessions_dir / f"{provider}__{session_id}.jsonl"

    def _get_history(self, provider: str, session_id: str):
        key = (provider, session_id)
        if key in self.histories:
            return self.histories[key]

        path = self._session_file_path(provider, session_id)
        messages = []
        if path.exists():
            for line in path.read_text(encoding="utf-8").splitlines():
                if not line.strip():
                    continue
                role, content = line.split("\t", 1)
                messages.append(ChatMessage(role=role, content=content.replace("<NL>", "\n")))

        self.histories[key] = messages
        return self.histories[key]

    def _persist_history(self, provider: str, session_id: str):
        path = self._session_file_path(provider, session_id)
        rows = []
        for msg in self._get_history(provider, session_id):
            rows.append(f"{msg.role}\t{str(msg.content).replace(chr(10), '<NL>')}")
        path.write_text("\n".join(rows), encoding="utf-8")

    def ask_question(self, *args, **kwargs):
        result = super().ask_question(*args, **kwargs)
        if result.get("success") and self.memory_enabled:
            self._persist_history(result["provider"], result.get("session_id", "default"))
        return result

    def reset_memory(self, provider: str = None, session_id: str = None) -> Dict:
        result = super().reset_memory(provider=provider, session_id=session_id)

        if result["removed_sessions"] == ["ALL"]:
            for path in (Path(__file__).resolve().parent / "sessions").glob("*.jsonl"):
                path.unlink(missing_ok=True)
            return result

        for key in result["removed_sessions"]:
            if isinstance(key, tuple):
                self._session_file_path(*key).unlink(missing_ok=True)

        return result


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "web":
        from web import run_web_server

        run_web_server(lambda: LlamaIndexLLMManager(memory_enabled=True))
    else:
        interactive_cli(LlamaIndexLLMManager(memory_enabled=True))


if __name__ == "__main__":
    main()
