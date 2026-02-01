/**
 * utils.js - Common utilities and configurations shared across all JavaScript frameworks
 * FIXED: Uses a shared readline interface to prevent stream closing issues.
 */

import 'dotenv/config';
import fs from 'fs';
import readline from 'readline';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '.env') });

export const PROVIDERS = {
    anthropic: { apiKeyEnv: 'ANTHROPIC_API_KEY', defaultModel: 'claude-sonnet-4-5', displayName: 'Anthropic Claude' },
    openai: { apiKeyEnv: 'OPENAI_API_KEY', defaultModel: 'gpt-5.2', displayName: 'OpenAI GPT' },
    google: { apiKeyEnv: 'GOOGLE_API_KEY', defaultModel: 'gemini-3-flash-preview', displayName: 'Google Gemini' },
    xai: { apiKeyEnv: 'XAI_API_KEY', defaultModel: 'grok-4', displayName: 'xAI Grok' }
};

export function getApiKey(provider) {
    return (provider in PROVIDERS) ? process.env[PROVIDERS[provider].apiKeyEnv] : null;
}

export function getDefaultModel(provider) {
    return PROVIDERS[provider]?.defaultModel || '';
}

export function getDisplayName(provider) {
    return PROVIDERS[provider]?.displayName || provider.charAt(0).toUpperCase() + provider.slice(1);
}

export function getAllProviders() {
    return Object.keys(PROVIDERS);
}

// Internal helper for shared readline
let sharedRl = null;
function getSharedAsk() {
    if (!sharedRl) {
        sharedRl = readline.createInterface({ input: process.stdin, output: process.stdout });
    }
    return (prompt) => new Promise((resolve) => sharedRl.question(prompt, resolve));
}

/**
 * Get temperature and max_tokens - matches utils.py sequence
 */
export async function getUserParameters(ask) {
    const tempInput = await ask('Temperature (0.0-2.0, default 0.7): ');
    let temperature = 0.7;
    if (tempInput.trim()) {
        const parsed = parseFloat(tempInput);
        temperature = !isNaN(parsed) ? Math.max(0.0, Math.min(2.0, parsed)) : 0.7;
    }

    const tokensInput = await ask('Max tokens (default 1000): ');
    let maxTokens = 1000;
    if (tokensInput.trim()) {
        const parsed = parseInt(tokensInput);
        maxTokens = !isNaN(parsed) ? Math.max(1, Math.min(4000, parsed)) : 1000;
    }

    return { temperature, maxTokens };
}

export function displayProviderResponse(provider, response, framework = '') {
    const providerDisplay = `${getDisplayName(provider)}${framework ? ` (${framework})` : ''} answered:`;
    console.log(`\n=== ${providerDisplay} ===`);
    if (response.success) {
        console.log(`[model: ${response.model || 'unknown'}, temp: ${response.temperature || 'N/A'}]`);
        console.log(response.response || 'No response');
    } else {
        console.log(`Error: ${response.error || 'Unknown error'}`);
    }
    console.log('='.repeat(60));
}

export async function getUserChoice(options, prompt, ask) {
    console.log(`\n${prompt}`);
    options.forEach((option, i) => console.log(`${i + 1}. ${option}`));
    while (true) {
        const answer = await ask(`Select an option (1-${options.length}): `);
        const choice = parseInt(answer) - 1;
        if (choice >= 0 && choice < options.length) return choice;
        console.log('Invalid selection. Please try again.');
    }
}

export function formatFilename(question, framework) {
    const safeQuestion = question.slice(0, 20).replace(/\s+/g, '_').replace(/[?!]/g, '');
    return `llm_responses_${framework}_${safeQuestion}.json`;
}

export function saveResponseToFile(response, filename) {
    fs.writeFileSync(filename, JSON.stringify(response, null, 2));
    console.log(`Response saved to ${filename}`);
}

/**
 * Base class for LLM framework managers
 */
export class BaseLLMManager {
    constructor(frameworkName) {
        this.framework = frameworkName;
        this.initializationMessages = {};
    }

    async _checkProviders() {
        for (const provider of getAllProviders()) {
            if (getApiKey(provider)) {
                try {
                    await this._testProvider(provider);
                    this.initializationMessages[provider] = '✓ Initialized successfully';
                } catch (error) {
                    this.initializationMessages[provider] = `✗ Failed: ${error.message}`;
                }
            } else {
                this.initializationMessages[provider] = '✗ API key not found';
            }
        }
    }

    getAvailableProviders() {
        return Object.entries(this.initializationMessages)
            .filter(([_, status]) => status.startsWith('✓'))
            .map(([provider]) => provider);
    }

    displayInitializationStatus() {
        console.log(`\n=== ${this.framework} Framework - Provider Status ===`);
        for (const [provider, message] of Object.entries(this.initializationMessages)) {
            console.log(`${getDisplayName(provider)}: ${message}`);
        }
        console.log('='.repeat(50) + '\n');
    }

    async queryAllProviders(topic, template, maxTokens, temperature) {
        const available = this.getAvailableProviders();
        const responses = {};
        for (const provider of available) {
            console.log(`Querying ${getDisplayName(provider)}...`);
            responses[provider] = await this.askQuestion(topic, provider, template, maxTokens, temperature);
        }
        return { success: true, responses };
    }
}

/**
 * THE PERFECT INTERACTIVE CLI - Aligned with utils.py
 */
export async function interactiveCli(manager) {
    const ask = getSharedAsk();

    try {
        console.log('='.repeat(60));
        console.log(`LLM Gateway - ${manager.framework} Framework`);
        console.log('='.repeat(60));
        
        manager.displayInitializationStatus();
        const availableProviders = manager.getAvailableProviders();
        
        if (availableProviders.length === 0) {
            console.log('No providers available. Check your .env file.');
            sharedRl.close();
            return;
        }

        // 1. Get Parameters FIRST
        const { temperature, maxTokens } = await getUserParameters(ask);
        console.log(`\nUsing temperature: ${temperature}, max tokens: ${maxTokens}`);

        // 2. Mode Selection
        console.log(`\nAvailable: ${availableProviders.map(p => getDisplayName(p)).join(', ')}`);
        const mode = (await ask('Query ALL providers or select one? (all/one): ')).trim().toLowerCase();

        if (['all', 'a', ''].includes(mode)) {
            const question = await ask('Enter your question: ');
            const results = await manager.queryAllProviders(question, '{topic}', maxTokens, temperature);
            for (const [provider, res] of Object.entries(results.responses)) {
                displayProviderResponse(provider, res, manager.framework);
            }
            const save = (await ask('\nSave results? (y/n): ')).toLowerCase();
            if (save === 'y' || save === 'yes') {
                saveResponseToFile(results, formatFilename(question, manager.framework.toLowerCase()));
            }
        } else {
            const names = availableProviders.map(p => getDisplayName(p));
            const choice = await getUserChoice(names, "Select a provider:", ask);
            const provider = availableProviders[choice];

            console.log('\n' + '='.repeat(50));
            console.log(`${manager.framework.toUpperCase()} INTERACTIVE MODE - ${getDisplayName(provider).toUpperCase()}`);
            console.log('='.repeat(50));

            while (true) {
                const userInput = (await ask("\nAsk a question (or 'exit'): ")).trim();
                if (['exit', 'quit'].includes(userInput.toLowerCase())) break;
                if (!userInput) continue;

                const result = await manager.askQuestion(userInput, provider, '{topic}', maxTokens, temperature);
                displayProviderResponse(provider, result, manager.framework);
            }
        }
    } catch (error) {
        console.error('Fatal Error:', error);
    } finally {
        console.log(`\nThank you for using the ${manager.framework} LLM Gateway!`);
        if (sharedRl) sharedRl.close();
    }
}
