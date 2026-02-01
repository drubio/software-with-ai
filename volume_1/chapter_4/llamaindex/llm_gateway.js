/**
 * LLM Tester - LlamaIndex JavaScript Framework Implementation
 * Aligned with the Python LlamaIndex implementation.
 */

import { Anthropic } from '@llamaindex/anthropic';
import { OpenAI } from '@llamaindex/openai';
import { Gemini } from '@llamaindex/google';

import { 
    getApiKey, 
    getDefaultModel, 
    BaseLLMManager, 
    interactiveCli 
} from '../utils.js';

class LlamaIndexLLMManager extends BaseLLMManager {
    constructor() {
        super('LlamaIndex JS');
    }

    async _testProvider(provider) {
        // Test LlamaIndex provider initialization
        await this._createClient(provider, 0.7, 1000);
    }

    _createClient(provider, temperature, maxTokens) {
        const apiKey = getApiKey(provider);
        const model = getDefaultModel(provider);

        if (provider === 'anthropic') {
            return new Anthropic({
                apiKey: apiKey,
                model: model,
                temperature: temperature,
                maxTokens: maxTokens
            });
        }
        
        else if (provider === 'openai') {
            return new OpenAI({
                apiKey: apiKey,
                model: model,
                temperature: temperature,
                maxCompletionTokens: maxTokens
            });
        }

        else if (provider === 'xai') {
            // Equivalent to OpenAILike in Python LlamaIndex
            return new OpenAI({
                apiKey: apiKey,
                model: model,
                temperature: temperature,
                maxTokens: maxTokens,
                // Override base URL for xAI Grok
                baseURL: "https://api.x.ai/v1"
            });
        }
        
        else if (provider === 'google') {
            return new Gemini({
                apiKey: apiKey,
                model: model,
                temperature: temperature,
                maxTokens: maxTokens
            });
        }
        
        throw new Error(`Provider ${provider} not supported`);
    }

    async askQuestion(topic, provider = null, template = '{topic}', maxTokens = 1000, temperature = 0.7) {
        const available = this.getAvailableProviders();
        if (!provider && available.length > 0) provider = available[0];
        if (!provider) return { success: false, error: 'No provider' };

        const client = this._createClient(provider, temperature, maxTokens);
        const prompt = template.replace('{topic}', topic);
        const model = getDefaultModel(provider);

        try {
            // LlamaIndex chat logic: matches Python's client.chat([ChatMessage(...)])
            const response = await client.chat({
                messages: [
                    { role: 'user', content: prompt }
                ]
            });

	    // Robust extraction logic
	    let resultText = "";
	    const content = response.message.content;

	    if (typeof content === 'string') {
		resultText = content;
	    } else if (Array.isArray(content)) {
		// Join all text parts if there are multiple, or just take the first
		resultText = content
		    .filter(block => block.type === 'text')
		    .map(block => block.text)
		    .join('\n');
	    } else {
		// Fallback for unexpected shapes
		resultText = content.toString();
	    }

            return {
                success: true,
                provider: provider,
                model: model,
                prompt: prompt,
                response: resultText,
                temperature: temperature,
                maxTokens: maxTokens
            };
            
        } catch (error) {
            return {
                success: false,
                provider: provider,
                model: model,
                prompt: prompt,
                error: error.message,
                response: null,
                temperature: temperature,
                maxTokens: maxTokens
            };
        }
    }
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length > 0 && args[0] === 'web') {
        try {
            const { runWebServer } = await import('./web.js');
            await runWebServer(LlamaIndexLLMManager);
        } catch (error) {
            console.error('Error: web.js not found or Express not installed.');
            process.exit(1);
        }
    } else {
        const manager = new LlamaIndexLLMManager();
        await manager._checkProviders();
        await interactiveCli(manager);
    }
}

export { LlamaIndexLLMManager };

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}
