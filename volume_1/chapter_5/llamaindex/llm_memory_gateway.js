/**
 * LLM Memory Gateway - LlamaIndex JS with session-based memory (in-memory only).
 */

import { LlamaIndexLLMManager as Chapter4LlamaIndexManager } from '../../chapter_4/llamaindex/llm_gateway.js';
import { getDefaultModel, interactiveCli } from '../../chapter_4/utils.js';

class LlamaIndexLLMManager extends Chapter4LlamaIndexManager {
    constructor(memoryEnabled = true) {
        super();
        this.framework = 'LlamaIndex+Memory JS';
        this.memoryEnabled = memoryEnabled;
        this.histories = new Map(); // key: provider::sessionId => [{role, content}]
    }

    _historyKey(provider, sessionId) {
        return `${provider}::${sessionId}`;
    }

    _getHistory(provider, sessionId) {
        const key = this._historyKey(provider, sessionId);
        if (!this.histories.has(key)) {
            this.histories.set(key, []);
        }
        return this.histories.get(key);
    }

    _historyToMessages(history) {
        return history.map((turn) => ({ role: turn.role, content: turn.content }));
    }

    async askQuestion(topic, provider = null, template = '{topic}', maxTokens = 1000, temperature = 0.7, sessionId = 'default') {
        if (!this.memoryEnabled) {
            return super.askQuestion(topic, provider, template, maxTokens, temperature);
        }

        const prompt = template.replace('{topic}', topic);
        const resolvedProvider = this._resolveProvider(provider);

        if (!resolvedProvider) {
            return {
                success: false,
                error: 'No providers available',
                provider: 'none',
                model: 'none',
                prompt,
                response: null,
            };
        }

        const model = getDefaultModel(resolvedProvider);

        try {
            const client = this._createClient(resolvedProvider, temperature, maxTokens);
            const history = this._getHistory(resolvedProvider, sessionId);
            const response = await client.chat({
                messages: [
                    ...this._historyToMessages(history),
                    { role: 'user', content: prompt },
                ],
            });
            const responseText = this._extractText(response);

            history.push({ role: 'user', content: prompt });
            history.push({ role: 'assistant', content: responseText });

            return {
                success: true,
                provider: resolvedProvider,
                model,
                prompt,
                response: responseText,
                temperature,
                maxTokens,
                sessionId,
            };
        } catch (error) {
            return {
                success: false,
                provider: resolvedProvider,
                model,
                prompt,
                error: error.message,
                response: null,
                temperature,
                maxTokens,
                sessionId,
            };
        }
    }

    getHistory(provider, sessionId = 'default') {
        const turns = [...this._getHistory(provider, sessionId)];
        return { provider, sessionId, turns, count: turns.length };
    }

    resetMemory(provider = null, sessionId = null) {
        const removed = [];

        if (provider && sessionId) {
            const key = this._historyKey(provider, sessionId);
            this.histories.delete(key);
            removed.push([provider, sessionId]);
        } else if (provider) {
            for (const key of Array.from(this.histories.keys())) {
                const [p, s] = key.split('::');
                if (p === provider) {
                    this.histories.delete(key);
                    removed.push([p, s]);
                }
            }
        } else if (sessionId) {
            for (const key of Array.from(this.histories.keys())) {
                const [p, s] = key.split('::');
                if (s === sessionId) {
                    this.histories.delete(key);
                    removed.push([p, s]);
                }
            }
        } else {
            this.histories.clear();
            removed.push('ALL');
        }

        return { status: 'cleared', removedSessions: removed };
    }
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length > 0 && args[0] === 'web') {
        const { runWebServer } = await import('../../chapter_4/web.js');
        await runWebServer(() => new LlamaIndexLLMManager(true));
    } else {
        const manager = new LlamaIndexLLMManager(true);
        await manager._checkProviders();
        await interactiveCli(manager);
    }
}

export { LlamaIndexLLMManager };

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}
