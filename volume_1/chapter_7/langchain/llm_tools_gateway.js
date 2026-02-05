/**
 * LLM Tools Gateway - LangChain JS (Chapter 7).
 *
 * Chapter flow: 4 (providers) -> 5 (memory) -> 6 (structured) -> 7 (tools).
 */

import { LangChainLLMManager as Chapter6LangChainManager } from '../../chapter_6/langchain/llm_structured_gateway.js';
import { interactiveCli, getDefaultModel } from '../../chapter_4/utils.js';
import { buildToolsPrompt, runTool } from '../tools.js';

const TOOLS_TEMPLATE = `You are a helpful assistant with access to external tools.

Available tools:
{tools}

For every response, return strict JSON with this shape:
{
  "tool_call": null OR {"name": "tool_name", "arguments": {"arg": "value"}},
  "final_answer": "string"
}

Rules:
- If no tool is needed, set tool_call to null.
- If a tool is needed, set tool_call and keep final_answer short (what you expect to answer after tool execution).
- Return JSON only.

User topic: {topic}`;

const FOLLOW_UP_TEMPLATE = `You already requested a tool and now have the result.

Original user topic: {topic}
Tool call: {tool_call}
Tool output: {tool_output}

Return strict JSON:
{
  "tool_call": null,
  "final_answer": "final response for the user"
}`;

class LangChainLLMManager extends Chapter6LangChainManager {
    constructor(memoryEnabled = true) {
        super(memoryEnabled);
        this.framework = 'LangChain+Tools JS';
    }

    _extractJsonObject(raw) {
        let text = String(raw || '').trim();
        if (text.startsWith('```json')) text = text.slice(7);
        if (text.startsWith('```')) text = text.slice(3);
        if (text.endsWith('```')) text = text.slice(0, -3);
        text = text.trim();

        try {
            return JSON.parse(text);
        } catch {
            const match = text.match(/\{[\s\S]*\}/);
            if (!match) throw new Error('No JSON object found in model response');
            return JSON.parse(match[0]);
        }
    }

    async _invokeJsonStep(provider, prompt, temperature, maxTokens) {
        const client = this._createClient(provider, temperature, maxTokens);
        const result = await client.invoke(this._buildMessages(prompt));
        const text = this._extractText(provider, result);
        return this._extractJsonObject(text);
    }

    async askQuestion(topic, provider = null, template = TOOLS_TEMPLATE, maxTokens = 1000, temperature = 0.2, sessionId = 'default') {
        const prompt = template.replace('{topic}', topic).replace('{tools}', buildToolsPrompt());
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
            const firstStep = await this._invokeJsonStep(resolvedProvider, prompt, temperature, maxTokens);
            const toolCall = firstStep.tool_call;
            let finalAnswer = String(firstStep.final_answer || '').trim();
            let toolOutput = null;

            if (toolCall && typeof toolCall === 'object' && toolCall.name) {
                const toolName = String(toolCall.name);
                const toolArgs = toolCall.arguments && typeof toolCall.arguments === 'object' ? toolCall.arguments : {};
                toolOutput = runTool(toolName, toolArgs);

                const followUpPrompt = FOLLOW_UP_TEMPLATE
                    .replace('{topic}', topic)
                    .replace('{tool_call}', JSON.stringify(toolCall))
                    .replace('{tool_output}', String(toolOutput));

                const secondStep = await this._invokeJsonStep(resolvedProvider, followUpPrompt, temperature, maxTokens);
                finalAnswer = String(secondStep.final_answer || finalAnswer).trim() || finalAnswer;
            }

            return {
                success: true,
                provider: resolvedProvider,
                model,
                prompt,
                response: {
                    tool_call: toolCall ?? null,
                    tool_output: toolOutput,
                    final_answer: finalAnswer,
                },
                rawAnswer: finalAnswer,
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
