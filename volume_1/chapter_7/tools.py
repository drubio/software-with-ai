"""Chapter 7 tool utilities (Python).

The structure is intentionally simple so the same tool contracts can be reused in:
- plain Python scripts,
- LangChain/LlamaIndex gateways,
- JavaScript ports.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Callable, Dict, List

import markdown
import pytz


@dataclass(frozen=True)
class ToolDefinition:
    """Serializable metadata that can be shared with prompt templates."""

    name: str
    description: str
    parameters: Dict[str, str]


ToolHandler = Callable[[Dict[str, Any]], str]


def format_markdown_to_html(text: str) -> str:
    """Convert Markdown text to HTML."""
    return markdown.markdown(text or "")


def get_datetime(timezone: str = "UTC") -> str:
    """Return current datetime in the requested timezone."""
    try:
        tz = pytz.timezone(timezone)
        now = datetime.now(tz)
        return now.strftime("%Y-%m-%d %H:%M:%S %Z")
    except Exception as exc:
        return f"Error: {exc}"


def _tool_format_markdown(parameters: Dict[str, Any]) -> str:
    return format_markdown_to_html(str(parameters.get("text", "")))


def _tool_get_datetime(parameters: Dict[str, Any]) -> str:
    return get_datetime(str(parameters.get("timezone", "UTC")))


TOOL_DEFINITIONS: List[ToolDefinition] = [
    ToolDefinition(
        name="format_markdown_to_html",
        description="Convert markdown text into HTML.",
        parameters={"text": "string - markdown content"},
    ),
    ToolDefinition(
        name="get_datetime",
        description="Get the current datetime in a timezone (e.g. UTC, Europe/Madrid).",
        parameters={"timezone": "string - IANA timezone"},
    ),
]


TOOL_HANDLERS: Dict[str, ToolHandler] = {
    "format_markdown_to_html": _tool_format_markdown,
    "get_datetime": _tool_get_datetime,
}


def list_tools() -> List[ToolDefinition]:
    """Return tool metadata for prompt-building and docs."""
    return TOOL_DEFINITIONS


def run_tool(action: str, parameters: Dict[str, Any] | None = None) -> str:
    """Dispatch to available tools by name."""
    handler = TOOL_HANDLERS.get(action)
    if not handler:
        return f"Unknown action: {action}"

    return handler(parameters or {})


def build_tools_prompt() -> str:
    """Human-readable tool spec used in gateway system prompts."""
    lines: List[str] = []
    for tool in TOOL_DEFINITIONS:
        params = ", ".join([f"{k} ({v})" for k, v in tool.parameters.items()])
        lines.append(f"- {tool.name}: {tool.description} Params: {params}")
    return "\n".join(lines)
