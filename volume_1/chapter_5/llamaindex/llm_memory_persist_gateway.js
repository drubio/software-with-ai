/**
 * LLM Memory History Gateway - LlamaIndex JS with persistent session memory.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { ChatMemoryBuffer, SimpleChatStore } from 'llamaindex';
import { LlamaIndexLLMManager as InMemoryLlamaIndexLLMManager } from './llm_memory_gateway.js';
import { interactiveCli } from '../../chapter_4/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LlamaIndexLLMManager extends InMemoryLlamaIndexLLMManager {
    constructor(memoryEnabled = true) {
        super(memoryEnabled);
        this.framework = 'LlamaIndex+History JS';
        this.chatStores = new Map();
    }

    _sessionFilePath(provider, sessionId) {
        const sessionsDir = path.join(__dirname, 'sessions');
        fs.mkdirSync(sessionsDir, { recursive: true });
        return path.join(sessionsDir, `${provider}__${sessionId}.json`);
    }

    _sessionStoreKey(provider, sessionId) {
        return `${provider}__${sessionId}`;
    }

    _getChatStore(provider, sessionId) {
        const key = this._historyKey(provider, sessionId);
        if (!this.chatStores.has(key)) {
            const filePath = this._sessionFilePath(provider, sessionId);
            const store = fs.existsSync(filePath)
                ? SimpleChatStore.fromPersistPath(filePath)
                : new SimpleChatStore();
            this.chatStores.set(key, store);
        }
        return this.chatStores.get(key);
    }

    _getMemory(provider, sessionId) {
        const key = this._historyKey(provider, sessionId);
        if (!this.memories.has(key)) {
            const chatStore = this._getChatStore(provider, sessionId);
            const memory = ChatMemoryBuffer.fromDefaults({
                chatStore,
                chatStoreKey: this._sessionStoreKey(provider, sessionId),
            });
            this.memories.set(key, memory);
        }
        return this.memories.get(key);
    }

    _persistMemory(provider, sessionId) {
        const chatStore = this._getChatStore(provider, sessionId);
        chatStore.persist(this._sessionFilePath(provider, sessionId));
    }

    async askQuestion(topic, provider = null, template = '{topic}', maxTokens = 1000, temperature = 0.7, sessionId = 'default') {
        const result = await super.askQuestion(topic, provider, template, maxTokens, temperature, sessionId);
        if (result.success && this.memoryEnabled) {
            this._persistMemory(result.provider, result.sessionId || 'default');
        }
        return result;
    }

    resetMemory(provider = null, sessionId = null) {
        const result = super.resetMemory(provider, sessionId);
        const sessionsDir = path.join(__dirname, 'sessions');

        if (result.removedSessions.length === 1 && result.removedSessions[0] === 'ALL') {
            this.chatStores.clear();
            if (fs.existsSync(sessionsDir)) {
                for (const fileName of fs.readdirSync(sessionsDir)) {
                    if (fileName.endsWith('.json')) {
                        fs.unlinkSync(path.join(sessionsDir, fileName));
                    }
                }
            }
            return result;
        }

        for (const key of result.removedSessions) {
            if (Array.isArray(key)) {
                const filePath = this._sessionFilePath(key[0], key[1]);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
                this.chatStores.delete(this._historyKey(key[0], key[1]));
            }
        }

        return result;
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
