/**
 * LLM Memory Gateway - LlamaIndex JS with session-based memory (in-memory only).
 */

import { ChatMemoryBuffer, SimpleChatEngine } from 'llamaindex';
import { LlamaIndexLLMManager as Chapter4LlamaIndexManager } from '../../chapter_4/llamaindex/llm_gateway.js';
import { getDefaultModel, interactiveCli } from '../../chapter_4/utils.js';

class LlamaIndexLLMManager extends Chapter4LlamaIndexManager {
    constructor(memoryEnabled = true) {
        super();
        this.framework = 'LlamaIndex+Memory JS';
        this.memoryEnabled = memoryEnabled;
        this.memories = new Map(); // key: provider::sessionId => ChatMemoryBuffer
        this.chatEngines = new Map(); // key: provider::sessionId => SimpleChatEngine
    }

    _historyKey(provider, sessionId) {
        return `${provider}::${sessionId}`;
    }

    _getMemory(provider, sessionId) {
        const key = this._historyKey(provider, sessionId);
        if (!this.memories.has(key)) {
            this.memories.set(key, ChatMemoryBuffer.fromDefaults());
        }
        return this.memories.get(key);
    }

    _getChatEngine(provider, sessionId, temperature, maxTokens) {
        const key = this._historyKey(provider, sessionId);
        if (!this.chatEngines.has(key)) {
            const client = this._createClient(provider, temperature, maxTokens);
            const memory = this._getMemory(provider, sessionId);
            const engine = SimpleChatEngine.fromDefaults({ llm: client, memory });
            this.chatEngines.set(key, engine);
        }
        return this.chatEngines.get(key);
    }

    _memoryMessages(memory) {
        if (typeof memory.getAll === 'function') {
            return memory.getAll();
        }
        if (typeof memory.getMessages === 'function') {
            return memory.getMessages();
        }
        return Array.isArray(memory.chatHistory) ? memory.chatHistory : [];
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
            const chatEngine = this._getChatEngine(resolvedProvider, sessionId, temperature, maxTokens);
            const response = await chatEngine.chat(prompt);
            const responseText = response?.response ?? this._extractText(response);

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
        const turns = this._memoryMessages(this._getMemory(provider, sessionId)).map((message) => ({
            role: message.role ?? message?.message?.role,
            content: message.content ?? message?.message?.content,
        }));
        return { provider, sessionId, turns, count: turns.length };
    }

    resetMemory(provider = null, sessionId = null) {
        const removed = [];

        if (provider && sessionId) {
            const key = this._historyKey(provider, sessionId);
            this.memories.delete(key);
            this.chatEngines.delete(key);
            removed.push([provider, sessionId]);
        } else if (provider) {
            for (const key of Array.from(this.memories.keys())) {
                const [p, s] = key.split('::');
                if (p === provider) {
                    this.memories.delete(key);
                    this.chatEngines.delete(key);
                    removed.push([p, s]);
                }
            }
        } else if (sessionId) {
            for (const key of Array.from(this.memories.keys())) {
                const [p, s] = key.split('::');
                if (s === sessionId) {
                    this.memories.delete(key);
                    this.chatEngines.delete(key);
                    removed.push([p, s]);
                }
            }
        } else {
            this.memories.clear();
            this.chatEngines.clear();
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
