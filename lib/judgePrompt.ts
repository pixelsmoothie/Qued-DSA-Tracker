interface Problem {
  title: string;
  description: string;
  optimal_approach: string;
}

interface Submission {
  user_id: string;
  code: string;
  language: string;
}

export function generateJudgePrompt(problem: Problem, submissions: Submission[]) {
  return `
You are a competitive programming judge. Your task is to evaluate and rank several code submissions for a specific DSA problem.

### PROBLEM DEFINITION
Title: ${problem.title}
Description: ${problem.description}
Optimal Approach: ${problem.optimal_approach}

### SUBMISSIONS TO EVALUATE
${submissions.map((s, i) => `
--- PLAYER ${i + 1} (User ID: ${s.user_id}) ---
Language: ${s.language}
Code:
${s.code}
` ).join('\n')}

### JUDGING CRITERIA
1. **Approach Quality (40%)**: Does the logic solve the problem correctly?
2. **Time Complexity (30%)**: Efficiency relative to the optimal approach.
3. **Space Complexity (15%)**: Memory efficiency.
4. **Code Clarity (15%)**: Readability and structure.

### CRITICAL INSTRUCTIONS
- **Relative Ranking**: Even if all submissions are suboptimal or technically incorrect, you MUST rank them relative to each other. The "least bad" solution should still receive Rank 1.
- **Fair Scoring**: Do not give everyone a low score just because they missed the optimal approach. Score them based on their relative performance.
- **Concise Feedback**: Provide exactly 2-3 sentences of feedback per player. Be professional and encouraging.

### OUTPUT FORMAT
Return ONLY a JSON array of objects with the following schema:
{
  "user_id": "string",
  "rank": number,
  "score": number, // out of 100
  "feedback": "string", // 2-3 sentences
  "key_insight": "string", // One brief sentence about what the user missed or got right
  "complexity": "string" // e.g. "O(n) time, O(1) space"
}

Ensure the output is a valid JSON array and nothing else.
`;
}
