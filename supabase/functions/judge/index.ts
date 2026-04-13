import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const NEURAL_ENDPOINT = Deno.env.get("NEURAL_ENDPOINT")
const NEURAL_API_KEY = Deno.env.get("NEURAL_API_KEY")
const MODEL_A = Deno.env.get("NEURAL_MODEL_A") || "glm-5.1"
const MODEL_B = Deno.env.get("NEURAL_MODEL_B") || "gemma4"
const MODEL_C = Deno.env.get("NEURAL_MODEL_C") || "qwen3.5"
const MODEL_D = Deno.env.get("NEURAL_MODEL_D") || "phi4-mini"

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")
const GROQ_MODEL = Deno.env.get("GROQ_MODEL") || "llama-3.1-70b-versatile"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { room_id, force = false } = await req.json()
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    // 1. Fetch Room, Problem, Submissions and Player Count
    console.log(`[Judge] Initializing for Room: ${room_id}`);
    
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*, problems:problem_id(*)')
      .eq('id', room_id)
      .single()
    
    if (roomError) throw new Error(`Room lookup failed: ${roomError.message}`);

    if (room.status === 'results') {
      return new Response(JSON.stringify({ message: "Already judged" }), { status: 200, headers: corsHeaders })
    }

    const { data: players } = await supabase
      .from('players')
      .select('user_id')
      .eq('room_id', room_id)

    const { data: subs } = await supabase
      .from('submissions')
      .select('*')
      .eq('room_id', room_id)

    // 2. Fidelity Check
    const allSubmitted = subs.length >= players.length;
    if (!allSubmitted && !force) {
      return new Response(JSON.stringify({ status: "awaiting_peers", current: subs.length, total: players.length }), { status: 200, headers: corsHeaders })
    }

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ error: "No submissions to judge" }), { status: 400, headers: corsHeaders })
    }

    const prompt = `
You are a competitive programming judge. Rank these ${subs.length} submissions for: ${room.problems.title}.
Problem: ${room.problems.description}
Optimal: ${room.problems.optimal_approach}

Submissions:
${subs.map((s, i) => `[Player ${i+1}] (ID: ${s.user_id})\nCode:\n${s.code}`).join('\n\n')}

CRITICAL: Rank them RELATIVELY. Even if all are bad, someone must be Rank 1.
Return ONLY a JSON array of:
{ "user_id": "...", "rank": 1, "score": 85, "feedback": "...", "key_insight": "...", "complexity": "..." }
`

    // 2. Resilient Judging Loop
    const circuits = [
      { url: NEURAL_ENDPOINT, model: MODEL_A, key: NEURAL_API_KEY, name: "Ollama Primary" },
      { url: NEURAL_ENDPOINT, model: MODEL_B, key: NEURAL_API_KEY, name: "Ollama Secondary" },
      { url: "https://api.groq.com/openai/v1/chat/completions", model: GROQ_MODEL, key: GROQ_API_KEY, name: "Groq Fallback" }
    ]

    let rankings = null;
    let lastError = "";

    for (const circuit of circuits) {
      if (!circuit.url || !circuit.key) continue;

      try {
        const body = JSON.stringify({
          model: circuit.model,
          messages: [{ role: "user", content: prompt }],
          stream: false
        });

        const response = await fetch(circuit.url, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${circuit.key}`,
            "Content-Type": "application/json"
          },
          body
        });

        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`${circuit.name} failed (${response.status}): ${errBody.slice(0, 100)}`);
        }

        const aiResult = await response.json();
        const content = aiResult.choices?.[0]?.message?.content || aiResult.message?.content || aiResult;
        
        const parsed = typeof content === 'string' ? JSON.parse(content) : content;
        rankings = parsed.items || parsed;
        if (Array.isArray(rankings)) break; 

      } catch (err) {
        lastError = err.message;
        console.warn(`Circuit ${circuit.name} failed: ${lastError}. Retrying next...`);
        continue;
      }
    }

    if (!rankings) throw new Error(`All judging circuits failed. Last error: ${lastError}`);

    // 3. Save Rankings
    await supabase.from('rankings').insert(
      rankings.map((r: any) => ({
        room_id,
        user_id: r.user_id,
        rank: r.rank,
        score: r.score,
        feedback: r.feedback,
        key_insight: r.key_insight
      }))
    )

    // 4. Update Room Status
    await supabase.from('rooms').update({ status: 'results' }).eq('id', room_id)

    return new Response(JSON.stringify({ success: true, provider_used: rankings.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })

  } catch (err) {
    console.error(`[Judge Critical Failure] ${err.message}`);
    return new Response(JSON.stringify({ error: err.message, details: "Ritual evaluation failed. Please verify API keys and provider status." }), { status: 500, headers: corsHeaders })
  }
})
