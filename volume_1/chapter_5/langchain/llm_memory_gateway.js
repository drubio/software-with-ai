/**
 * LLM Memory Gateway - LangChain JS with session-based memory (in-memory only).
 */

import { InMemoryChatMessageHistory } from '@langchain/core/chat_history';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { RunnableWithMessageHistory } from '@langchain/core/runnables';
import { LangChainLLMManager as Chapter4LangChainManager } from '../../chapter_4/langchain/llm_gateway.js';
import { getDefaultModel, interactiveCli } from '../../chapter_4/utils.js';

class LangChainLLMManager extends Chapter4LangChainManager {
    constructor(memoryEnabled = true) {
        super();
        this.framework = 'LangChain+Memory JS';
        this.memoryEnabled = memoryEnabled;
        this.histories = new Map(); // key: provider::sessionId => ChatMessageHistory
        this.chains = new Map(); // key: provider::sessionId => RunnableWithMessageHistory
    }

    _historyKey(provider, sessionId) {
        return `${provider}::${sessionId}`;
    }

    _getHistory(provider, sessionId) {
        const key = this._historyKey(provider, sessionId);
        if (!this.histories.has(key)) {
            this.histories.set(key, new InMemoryChatMessageHistory());
        }
        return this.histories.get(key);
    }

    _getChain(provider, sessionId, temperature, maxTokens) {
        const key = this._historyKey(provider, sessionId);
        if (!this.chains.has(key)) {
            const client = this._createClient(provider, temperature, maxTokens);
            const prompt = ChatPromptTemplate.fromMessages([
                new MessagesPlaceholder('history'),
                ['human', '{input}'],
            ]);
            const chain = new RunnableWithMessageHistory({
                runnable: prompt.pipe(client),
                getMessageHistory: (sessionKey) => this._getHistory(provider, sessionKey ?? sessionId),
                inputMessagesKey: 'input',
                historyMessagesKey: 'history',
            });
            this.chains.set(key, chain);
        }
        return this.chains.get(key);
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
            const chain = this._getChain(resolvedProvider, sessionId, temperature, maxTokens);
            const result = await chain.invoke(
                { input: prompt },
                { configurable: { sessionId } },
            );
            const responseText = this._extractText(resolvedProvider, result);

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
        const turns = this._getHistory(provider, sessionId).messages.map((message) => ({
            role: message._getType?.() ?? message.getType?.() ?? message.type,
            content: message.content,
        }));
        return { provider, sessionId, turns, count: turns.length };
    }

    resetMemory(provider = null, sessionId = null) {
        const removed = [];

        if (provider && sessionId) {
            const key = this._historyKey(provider, sessionId);
            this.histories.delete(key);
            this.chains.delete(key);
            removed.push([provider, sessionId]);
        } else if (provider) {
            for (const key of Array.from(this.histories.keys())) {
                const [p, s] = key.split('::');
                if (p === provider) {
                    this.histories.delete(key);
                    this.chains.delete(key);
                    removed.push([p, s]);
                }
            }
        } else if (sessionId) {
            for (const key of Array.from(this.histories.keys())) {
                const [p, s] = key.split('::');
                if (s === sessionId) {
                    this.histories.delete(key);
                    this.chains.delete(key);
                    removed.push([p, s]);
                }
            }
        } else {
            this.histories.clear();
            this.chains.clear();
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
