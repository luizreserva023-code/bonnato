/**
 * LLM Adapter — troca de provedor sem alterar o restante do código.
 *
 * Para usar na Manus (padrão):
 *   LLM_PROVIDER=manus  (ou deixar em branco)
 *
 * Para usar OpenAI na sua VPS:
 *   LLM_PROVIDER=openai
 *   OPENAI_API_KEY=sk-...
 *   OPENAI_MODEL=gpt-4o-mini  (opcional, padrão: gpt-4o-mini)
 *
 * Para usar Groq na sua VPS (mais barato/rápido):
 *   LLM_PROVIDER=groq
 *   GROQ_API_KEY=gsk_...
 *   GROQ_MODEL=llama3-8b-8192  (opcional)
 *
 * Para usar Ollama local na VPS (gratuito):
 *   LLM_PROVIDER=ollama
 *   OLLAMA_BASE_URL=http://localhost:11434
 *   OLLAMA_MODEL=llama3  (opcional)
 */

export type LLMRole = "system" | "user" | "assistant";

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

export interface LLMOptions {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: "json_object" } | { type: "text" };
}

export interface LLMResponse {
  content: string;
  provider: string;
}

// ─── Manus built-in ──────────────────────────────────────────────────────────
async function callManus(options: LLMOptions): Promise<LLMResponse> {
  const { invokeLLM } = await import("../_core/llm");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await invokeLLM({
    messages: options.messages.map(m => ({ role: m.role, content: m.content })) as any,
    ...(options.responseFormat?.type === "json_object"
      ? { response_format: { type: "json_object" } }
      : {}),
  });
  const raw = res.choices?.[0]?.message?.content ?? "";
  const content = typeof raw === "string" ? raw : JSON.stringify(raw);
  return { content, provider: "manus" };
}

// ─── OpenAI ──────────────────────────────────────────────────────────────────
async function callOpenAI(options: LLMOptions): Promise<LLMResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada");
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const body: Record<string, unknown> = {
    model,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 1024,
  };
  if (options.responseFormat) body.response_format = options.responseFormat;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenAI error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return { content: data.choices[0].message.content, provider: "openai" };
}

// ─── Groq ─────────────────────────────────────────────────────────────────────
async function callGroq(options: LLMOptions): Promise<LLMResponse> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY não configurada");
  const model = process.env.GROQ_MODEL ?? "llama3-8b-8192";

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1024,
    }),
  });
  if (!res.ok) throw new Error(`Groq error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return { content: data.choices[0].message.content, provider: "groq" };
}

// ─── Ollama (local) ───────────────────────────────────────────────────────────
async function callOllama(options: LLMOptions): Promise<LLMResponse> {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL ?? "llama3";

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: options.messages, stream: false }),
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { message: { content: string } };
  return { content: data.message.content, provider: "ollama" };
}

// ─── Ponto de entrada único ───────────────────────────────────────────────────
export async function callLLM(options: LLMOptions): Promise<LLMResponse> {
  const provider = (process.env.LLM_PROVIDER ?? "manus").toLowerCase();

  switch (provider) {
    case "openai":
      return callOpenAI(options);
    case "groq":
      return callGroq(options);
    case "ollama":
      return callOllama(options);
    case "manus":
    default:
      return callManus(options);
  }
}
