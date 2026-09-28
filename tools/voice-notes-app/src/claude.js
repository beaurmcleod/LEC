// Writing the reply to a lead, with Claude. The API key lives in Setup, never in the code.
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-opus-5-5';
// CLAUDE_API lets tests point the app at a local stand-in.
const baseURL = globalThis.process?.env?.CLAUDE_API || undefined;

const client = (key) => new Anthropic({ apiKey: String(key || '').trim(), baseURL, maxRetries: 2 });

function plainError(e) {
  if (e instanceof Anthropic.AuthenticationError) return "Claude didn't accept the API key. Make one at console.anthropic.com and paste it in Setup.";
  if (e instanceof Anthropic.RateLimitError) return 'Claude is busy right now (rate limit). It will try again on the next check.';
  if (e instanceof Anthropic.APIConnectionError) return "Couldn't reach Claude. Check the internet connection.";
  if (e instanceof Anthropic.APIError) return `Claude said: ${e.message}`;
  return e.message;
}

// One structured answer: { intent, reply, why }. Uses the server-side fallback so a safety decline on the
// main model is answered by another model instead of failing the reply.
export async function draftReply(key, prompt) {
  const c = client(key);
  const req = {
    model: MODEL,
    max_tokens: 2000,
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }],
    output_config: { effort: 'high', format: { type: 'json_schema', schema: prompt.schema } },
  };
  let res;
  try {
    try {
      res = await c.beta.messages.create({ ...req, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
    } catch (e) {
      // A proxy or an older deployment that doesn't know the fallback field: ask again without it.
      if (!(e instanceof Anthropic.BadRequestError)) throw e;
      res = await c.messages.create(req);
    }
  } catch (e) {
    throw new Error(plainError(e));
  }
  if (res.stop_reason === 'refusal') throw new Error('Claude declined to write this reply. Write it by hand.');
  const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  let out;
  try {
    out = JSON.parse(text);
  } catch {
    throw new Error("Claude's answer wasn't in the expected shape. Try again.");
  }
  if (!['yes', 'no', 'question', 'unclear'].includes(out.intent) || typeof out.reply !== 'string') throw new Error("Claude's answer wasn't in the expected shape. Try again.");
  return { intent: out.intent, reply: out.reply.trim(), why: String(out.why || ''), model: res.model };
}

// Setup's Test button: a tiny request that proves the key works.
export async function testClaude(key) {
  try {
    const res = await client(key).messages.create({ model: MODEL, max_tokens: 50, messages: [{ role: 'user', content: 'Reply with the single word: ready' }] });
    return { model: res.model };
  } catch (e) {
    throw new Error(plainError(e));
  }
}
