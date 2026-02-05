/**
 * Chapter 7 tool utilities (JavaScript).
 *
 * Mirrors tools.py so contracts are portable across Python/JS and frameworks.
 */

import { marked } from 'marked';

export const TOOL_DEFINITIONS = [
    {
        name: 'format_markdown_to_html',
        description: 'Convert markdown text into HTML.',
        parameters: { text: 'string - markdown content' },
    },
    {
        name: 'get_datetime',
        description: 'Get the current datetime in a timezone (e.g. UTC, Europe/Madrid).',
        parameters: { timezone: 'string - IANA timezone' },
    },
];

export function formatMarkdownToHTML(text) {
    return marked(String(text || ''));
}

export function getDatetime(timezone = 'UTC') {
    try {
        return new Date().toLocaleString('en-US', { timeZone: String(timezone || 'UTC') });
    } catch (error) {
        return `Error: ${error.message}`;
    }
}

const TOOL_HANDLERS = {
    format_markdown_to_html: (parameters = {}) => formatMarkdownToHTML(parameters.text || ''),
    get_datetime: (parameters = {}) => getDatetime(parameters.timezone || 'UTC'),
};

export function listTools() {
    return TOOL_DEFINITIONS;
}

export function runTool(action, parameters = {}) {
    const handler = TOOL_HANDLERS[action];
    if (!handler) {
        return `Unknown action: ${action}`;
    }

    return handler(parameters || {});
}

export function buildToolsPrompt() {
    return TOOL_DEFINITIONS.map((tool) => {
        const params = Object.entries(tool.parameters)
            .map(([key, value]) => `${key} (${value})`)
            .join(', ');
        return `- ${tool.name}: ${tool.description} Params: ${params}`;
    }).join('\n');
}
