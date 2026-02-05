"""
LLM Structured Gateway - LangChain with tool triggering via tools.py
"""

import sys
import os
import re
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'chapter_4')))

from utils import get_api_key, get_default_model, BaseLLMManager, interactive_cli
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from tools import run_tool


class LangChainLLMManager(BaseLLMManager):
    def __init__(self):
        super().__init__("LangChain+Structured")

    def _create_client(self, provider: str, temperature: float, max_tokens: int):
        if provider == "anthropic":
            return ChatAnthropic(
                anthropic_api_key=get_api_key(provider),
                model=get_default_model(provider),
                temperature=temperature,
                max_tokens=max_tokens
            )
        elif provider == "openai":
            return ChatOpenAI(
                openai_api_key=get_api_key(provider),
                model=get_default_model(provider),
                temperature=temperature,
                max_tokens=max_tokens
            )
        elif provider == "google":
            return ChatGoogleGenerativeAI(
                google_api_key=get_api_key(provider),
                model=get_default_model(provider),
                temperature=temperature,
                max_output_tokens=max_tokens
            )
        elif provider == "xai":
            return ChatOpenAI(
                openai_api_key=get_api_key(provider),
                openai_api_base="https://api.x.ai/v1",
                model=get_default_model(provider),
                temperature=temperature,
                max_tokens=max_tokens
            )
        else:
            raise ValueError(f"Unsupported provider: {provider}")

    def _test_provider(self, provider: str):
        self._create_client(provider, temperature=0.7, max_tokens=1000)

    def _extract_tool_request(self, text: str):
        match = re.search(r'TOOL:\s*(\w+)\s+with\s+(.*)', text)
        if not match:
            return None
        name = match.group(1)
        params = match.group(2)
        args = {}
        for part in params.split(','):
            if '=' in part:
                key, val = part.split('=', 1)
                args[key.strip()] = val.strip().strip("\"'")
        return name, args

    def ask_question(self, topic: str, provider: str = None,
                     template: str = "{topic}", max_tokens: int = 1000,
                     temperature: float = 0.7, session_id: str = "default") -> dict:

        prompt = template.format(topic=topic)
        available_providers = self.get_available_providers()
        if not provider or provider not in available_providers:
            if not available_providers:
                return {
                    "success": False,
                    "error": "No providers available",
                    "provider": "none",
                    "model": "none",
                    "prompt": prompt,
                    "response": None
                }
            provider = available_providers[0]

        model = get_default_model(provider)

        try:
            client = self._create_client(provider, temperature, max_tokens)
            messages = [
                SystemMessage(content="You are a helpful assistant. If a tool is needed, say: TOOL: <name> with key=value"),
                HumanMessage(content=prompt)
            ]
            result = client.invoke(messages)
            text = result.content

            tool_call = self._extract_tool_request(text)
            if tool_call:
                tool_name, tool_args = tool_call
                tool_output = run_tool(tool_name, tool_args)
                text += f"\n\n[TOOL OUTPUT]: {tool_output}"

            return {
                "success": True,
                "provider": provider,
                "model": model,
                "prompt": prompt,
                "response": text,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "session_id": session_id
            }

        except Exception as e:
            return {
                "success": False,
                "provider": provider,
                "model": model,
                "prompt": prompt,
                "error": str(e),
                "response": None,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "session_id": session_id
            }


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "web":
        from web import run_web_server
        run_web_server(lambda: LangChainLLMManager())
    else:
        manager = LangChainLLMManager()
        interactive_cli(manager)


if __name__ == "__main__":
    main()

