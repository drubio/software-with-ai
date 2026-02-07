/**
 * LLM Memory History Gateway - LangChain JS with persistent session memory.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { FileChatMessageHistory } from '@langchain/community/stores/message/file';
import { LangChainLLMManager as InMemoryLangChainLLMManager } from './llm_memory_gateway.js';
import { interactiveCli } from '../../chapter_4/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LangChainLLMManager extends InMemoryLangChainLLMManager {
    constructor(memoryEnabled = true) {
        super(memoryEnabled);
        this.framework = 'LangChain+History JS';
    }

    _sessionFilePath(provider, sessionId) {
        const sessionsDir = path.join(__dirname, 'sessions');
        fs.mkdirSync(sessionsDir, { recursive: true });
        return path.join(sessionsDir, `${provider}__${sessionId}.json`);
    }

    _getHistory(provider, sessionId) {
        const key = this._historyKey(provider, sessionId);
        if (!this.histories.has(key)) {
            const filePath = this._sessionFilePath(provider, sessionId);
            this.histories.set(key, new FileChatMessageHistory({ filePath }));
        }
        return this.histories.get(key);
    }

    resetMemory(provider = null, sessionId = null) {
        const result = super.resetMemory(provider, sessionId);
        const sessionsDir = path.join(__dirname, 'sessions');

        if (result.removedSessions.length === 1 && result.removedSessions[0] === 'ALL') {
            if (fs.existsSync(sessionsDir)) {
                for (const file of fs.readdirSync(sessionsDir)) {
                    if (file.endsWith('.json')) {
                        fs.unlinkSync(path.join(sessionsDir, file));
                    }
                }
            }
            return result;
        }

        for (const key of result.removedSessions) {
            if (Array.isArray(key) && key.length === 2) {
                const [p, s] = key;
                const file = this._sessionFilePath(p, s);
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                }
            }
        }

        return result;
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
