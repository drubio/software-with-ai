/**
 * LLM Memory Gateway - LangChain JS with session-based memory (in-memory only).
 */

import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { LangChainLLMManager as Chapter4LangChainManager } from '../../chapter_4/langchain/llm_gateway.js';
import { getDefaultModel, interactiveCli } from '../../chapter_4/utils.js';

class LangChainLLMManager extends Chapter4LangChainManager {
    constructor(memoryEnabled = true) {
        super();
        this.framework = 'LangChain+Memory JS';
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
        return history.map((turn) => (
            turn.role === 'ai'
                ? new AIMessage(turn.content)
                : new HumanMessage(turn.content)
        ));
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
            const messages = [
                ...this._historyToMessages(history),
                new HumanMessage(prompt),
            ];

            const result = await client.invoke(messages);
            const responseText = this._extractText(resolvedProvider, result);

            history.push({ role: 'human', content: prompt });
            history.push({ role: 'ai', content: responseText });

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
        await runWebServer(() => new LangChainLLMManager(true));
    } else {
        const manager = new LangChainLLMManager(true);
        await manager._checkProviders();
        await interactiveCli(manager);
    }
}

export { LangChainLLMManager };

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}
