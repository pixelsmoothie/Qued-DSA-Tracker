import { InterviewerPersona } from "../../lib/prompts";

export type Phase = "persona_select" | "intro" | "planning" | "coding" | "analysis" | "grading";
export type Message = { role: "assistant" | "user"; content: string };

export const PHASES_ORDERED: Phase[] = ["intro", "planning", "coding", "analysis", "grading"];

export const PHASE_LABELS: Record<Phase, string> = {
  persona_select: "Select",
  intro:          "Intro",
  planning:       "Plan",
  coding:         "Code",
  analysis:       "Review",
  grading:        "Grade",
};

export interface Model {
  id: string;
  label: string;
  vram: string;
}

export const AVAILABLE_MODELS: Model[] = [
  { id: "qwen3:8b",        label: "Qwen 3 (Balanced)",    vram: "8 GB" },
  { id: "qwen2.5-coder:3b",label: "Qwen 2.5 Coder (Fast)",vram: "4 GB" },
  { id: "gemma3:4b",       label: "Gemma 3 (Responsive)", vram: "4 GB" },
  { id: "deepseek-r1:8b",  label: "DeepSeek-R1 (Elite)",  vram: "10 GB" },
  { id: "phi3",            label: "Phi-3 (Mini)",         vram: "3 GB" },
];
