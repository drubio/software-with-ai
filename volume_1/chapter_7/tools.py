# tools.py

import markdown
from datetime import datetime
import pytz

def format_markdown_to_html(text: str) -> str:
    """Convert Markdown to HTML"""
    return markdown.markdown(text)

def get_datetime(timezone: str = "UTC") -> str:
    """Return the current datetime in the given timezone"""
    try:
        tz = pytz.timezone(timezone)
        now = datetime.now(tz)
        return now.strftime("%Y-%m-%d %H:%M:%S %Z")
    except Exception as e:
        return f"Error: {str(e)}"

def run_tool(action: str, parameters: dict) -> str:
    """Dispatch tool based on action name"""
    if action == "format_markdown_to_html":
        return format_markdown_to_html(parameters.get("text", ""))
    elif action == "get_datetime":
        return get_datetime(parameters.get("timezone", "UTC"))
    else:
        return f"Unknown action: {action}"
