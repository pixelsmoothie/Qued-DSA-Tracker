import { Message } from "../components/interview/types";
import { invoke } from "@tauri-apps/api/core";

export type ApiProvider = "ollama" | "ollama_cloud" | "openrouter" | "groq";

interface CoreFetchOptions {
  apiProvider: ApiProvider;
  externalApiKey: string;
  externalModel: string;
  messages: { role: string; content: string }[];
  localModel?: string; // For Ollama
  baseUrl?: string; // For Ollama Cloud or custom endpoints
  onStatus?: (status: string, elapsed: number) => void;
  signal?: AbortSignal;
}

/**
 * Native bridge wrapper to bypass CORS and Tauri security scopes.
 */
async function nativeFetch(url: string, method: string, headers: Record<string, string>, body: string): Promise<string> {
  return await invoke("core_proxy_fetch", { url, method, headers, body });
}

/**
 * Centrally managed Process Core with Persistent Link guardrails.
 */
export async function streamCoreResponse({
  apiProvider,
  externalApiKey,
  externalModel,
  messages,
  localModel = "qwen3:8b",
  baseUrl,
  onStatus,
  signal
}: CoreFetchOptions): Promise<Response> {
  // 🚀 Native Proxy Implementation for all providers to ensure zero CORS/Permission issues.
  const startTime = Date.now();
  const GLOBAL_TIMEOUT = 180000; // 180s (Support for DeepSeek-R1 thinking)
  let lastErrorMsg = "";

  while (true) {
    const elapsed = Date.now() - startTime;
    if (elapsed > GLOBAL_TIMEOUT) {
      throw new Error(`Core Request Timed Out (${Math.floor(elapsed / 1000)}s): ${lastErrorMsg || "Gateway at capacity."}`);
    }

    let url = "";
    if (apiProvider === "ollama") url = "http://127.0.0.1:11434/api/chat";
    else if (apiProvider === "openrouter") url = "https://openrouter.ai/api/v1/chat/completions";
    else if (apiProvider === "groq") url = "https://api.groq.com/openai/v1/chat/completions";
    else if (apiProvider === "ollama_cloud") {
      const base = baseUrl?.trim() || "https://ollama.com/api";
      const cleanBase = base.replace(/\/$/, "");
      url = cleanBase.toLowerCase().endsWith("/chat") ? cleanBase : `${cleanBase}/chat`;
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${externalApiKey}`,
        "HTTP-Referer": "https://mission-control.v3",
        "X-Title": "Process Core V3.5"
      };

      const body = JSON.stringify({
        model: apiProvider === "ollama_cloud"
          ? (externalModel || localModel)
          : (apiProvider === "ollama" ? localModel : (externalModel || (apiProvider === "openrouter" ? "qwen/qwen-2.5-72b-instruct" : "llama-3.1-70b-versatile"))),
        temperature: 0.3,
        stream: false, // ⚠️ Native Proxy currently handles non-streaming for maximum reliability
        messages,
      });

      const responseText = await nativeFetch(url, "POST", headers, body);

      // We wrap the text in a standard Response-like object for the frontend to consume.
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(responseText));
          controller.close();
        }
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });

    } catch (err: any) {
      lastErrorMsg = err.toString();

      // If it's a 404 (Model not found), don't retry as it needs a manual fix
      if (lastErrorMsg.includes("404")) {
        throw new Error(`${apiProvider.toUpperCase()} Gateway Failure: ${lastErrorMsg}. [Endpoint: ${url}]`);
      }

      // Aggressive Retry Loop: Continue trying until successful for all other errors (500, timeouts, etc.)
      const sec = Math.floor((Date.now() - startTime) / 1000);
      onStatus?.(`Retrying after error: ${lastErrorMsg.slice(0, 50)}...`, sec);
      
      // Exponential backoff or simple delay
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }
  }
}
