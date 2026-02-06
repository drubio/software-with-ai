/** Streaming helpers for chapter web APIs. */

export function normalizeResponseText(payload) {
    if (payload == null) return '';
    if (typeof payload === 'string') return payload;

    if (typeof payload === 'object') {
        for (const key of ['answer', 'final_answer', 'distilled', 'summary']) {
            const value = payload[key];
            if (typeof value === 'string' && value.trim()) return value;
        }
        return JSON.stringify(payload);
    }

    return String(payload);
}

export function chunkText(text, chunkSize = 28) {
    const clean = text || '';
    if (!clean) return [''];

    const chunks = [];
    for (let index = 0; index < clean.length; index += chunkSize) {
        chunks.push(clean.slice(index, index + chunkSize));
    }
    return chunks;
}
