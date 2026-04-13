import { invoke } from "@tauri-apps/api/core";

// Remote Action Layer (Client-Safe)

export async function fetchLeetcodeTemplate(leetcodeUrl: string, langSlug: string) {
  try {
    if (!leetcodeUrl) return null;
    // Extract problem slug from URL
    // e.g., https://leetcode.com/problems/pascals-triangle/
    const match = leetcodeUrl.match(/problems\/([^\/]+)/);
    if (!match) return null;
    const titleSlug = match[1];

    const query = `
      query questionEditorData($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          codeSnippets {
            lang
            langSlug
            code
          }
        }
      }
    `;

    // 🚀 Native Proxy Bridge: Bypasses CORS and User-Agent restrictions
    const responseText = await invoke<string>("core_proxy_fetch", {
      url: "https://leetcode.com/graphql",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Referer": "https://leetcode.com",
      },
      body: JSON.stringify({
        query,
        variables: { titleSlug }
      })
    });

    const data = JSON.parse(responseText);
    const snippets = data.data?.question?.codeSnippets;
    if (!snippets) return null;

    // Leetcode uses 'python3' for modern python
    const querySlug = langSlug === "python" ? "python3" : langSlug;
    const snippet = snippets.find((s: any) => s.langSlug === querySlug);
    return snippet ? snippet.code : null;
  } catch (err) {
    console.error("Failed to fetch Leetcode template via proxy:", err);
    return null;
  }
}

export async function executeCode(language: string, code: string) {
  try {
    const WANDBOX_LANG_MAP: Record<string, string> = {
      cpp: "gcc-head",
      java: "openjdk-jdk-22+36",
      python: "cpython-3.14.0",
      javascript: "nodejs-20.17.0",
      typescript: "typescript-5.6.2",
      rust: "rust-1.82.0",
    };

    const targetCompiler = WANDBOX_LANG_MAP[language] || "gcc-head";

    const responseText = await invoke<string>("core_proxy_fetch", {
      url: "https://wandbox.org/api/compile.json",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        compiler: targetCompiler,
        code: code,
        save: false
      })
    });

    const data = JSON.parse(responseText);

    // Wandbox returns program_message containing both stdout and stderr
    if (data.status !== "0" && !data.program_message) {
      return { error: data.compiler_error || data.program_error || "Compilation/Execution Failed" };
    }

    return { output: data.program_message || data.compiler_message || "Code compiled successfully with no output." };
  } catch (err: any) {
    console.error("Failed to execute code:", err);
    return { error: err.message || "Failed to reach execution server" };
  }
}
