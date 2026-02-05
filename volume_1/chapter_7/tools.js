// tools.js

import { marked } from 'marked';

/**
 * Convert Markdown to HTML
 * @param {string} text
 * @returns {string}
 */
export function formatMarkdownToHTML(text) {
    return marked(text || '');
}

/**
 * Get the current date and time in a specific timezone
 * @param {string} timezone
 * @returns {string}
 */
export function getDatetime(timezone = 'UTC') {
    try {
        return new Date().toLocaleString('en-US', { timeZone: timezone });
    } catch (e) {
        return `Error: ${e.message}`;
    }
}

/**
 * Dispatch to available tools
 * @param {string} action
 * @param {object} parameters
 * @returns {string}
 */
export function runTool(action, parameters = {}) {
    if (action === 'format_markdown_to_html') {
        return formatMarkdownToHTML(parameters.text || '');
    } else if (action === 'get_datetime') {
        return getDatetime(parameters.timezone || 'UTC');
    } else {
        return `Unknown action: ${action}`;
    }
}
