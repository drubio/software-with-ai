"""LLM Memory History Gateway - LlamaIndex with persistent session memory."""

import os
import sys
from pathlib import Path
from typing import Dict

CHAPTER_4_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "chapter_4"))
sys.path.append(CHAPTER_4_ROOT)
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from llama_index.core.memory import ChatMemoryBuffer
from llama_index.core.storage.chat_store import SimpleChatStore

from llm_memory_gateway import LlamaIndexLLMManager as InMemoryLlamaIndexLLMManager
from utils import interactive_cli


class LlamaIndexLLMManager(InMemoryLlamaIndexLLMManager):
    """Persistent-memory variant that reuses the in-memory manager behavior."""

    def __init__(self, memory_enabled: bool = True):
        super().__init__(memory_enabled=memory_enabled)
        self.framework = "LlamaIndex+History"
        self.chat_stores: Dict[tuple, SimpleChatStore] = {}

    def _session_file_path(self, provider: str, session_id: str) -> Path:
        sessions_dir = Path(__file__).resolve().parent / "sessions"
        sessions_dir.mkdir(parents=True, exist_ok=True)
        return sessions_dir / f"{provider}__{session_id}.json"

    def _session_store_key(self, provider: str, session_id: str) -> str:
        return f"{provider}__{session_id}"

    def _get_chat_store(self, provider: str, session_id: str) -> SimpleChatStore:
        key = (provider, session_id)
        if key in self.chat_stores:
            return self.chat_stores[key]

        path = self._session_file_path(provider, session_id)
        if path.exists():
            chat_store = SimpleChatStore.from_persist_path(str(path))
        else:
            chat_store = SimpleChatStore()
        self.chat_stores[key] = chat_store
        return chat_store

    def _get_memory(self, provider: str, session_id: str) -> ChatMemoryBuffer:
        key = (provider, session_id)
        if key not in self.memories:
            chat_store = self._get_chat_store(provider, session_id)
            self.memories[key] = ChatMemoryBuffer.from_defaults(
                chat_store=chat_store,
                chat_store_key=self._session_store_key(provider, session_id),
            )
        return self.memories[key]

    def _persist_memory(self, provider: str, session_id: str):
        chat_store = self._get_chat_store(provider, session_id)
        chat_store.persist(persist_path=str(self._session_file_path(provider, session_id)))

    def ask_question(self, *args, **kwargs):
        result = super().ask_question(*args, **kwargs)
        if result.get("success") and self.memory_enabled:
            self._persist_memory(result["provider"], result.get("session_id", "default"))
        return result

    def reset_memory(self, provider: str = None, session_id: str = None) -> Dict:
        result = super().reset_memory(provider=provider, session_id=session_id)

        if result["removed_sessions"] == ["ALL"]:
            self.chat_stores.clear()
            for path in (Path(__file__).resolve().parent / "sessions").glob("*.json"):
                path.unlink(missing_ok=True)
            return result

        for key in result["removed_sessions"]:
            if isinstance(key, tuple):
                self._session_file_path(*key).unlink(missing_ok=True)
                self.chat_stores.pop(key, None)

        return result


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "web":
        from web import run_web_server

        run_web_server(lambda: LlamaIndexLLMManager(memory_enabled=True))
    else:
        interactive_cli(LlamaIndexLLMManager(memory_enabled=True))


if __name__ == "__main__":
    main()
