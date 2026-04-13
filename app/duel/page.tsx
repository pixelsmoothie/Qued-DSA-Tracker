"use client";

import CombatArena from "../../components/CombatArena";

export default function DuelPage() {
  // In a real scenario, we'd get the user info from a global state or auth
  const userId = "user_" + Math.random().toString(36).substring(2, 7);
  const userName = "QuedCombatant";

  return (
    <div className="flex h-screen bg-claude-bg text-claude-text">
      <CombatArena userId={userId} userName={userName} />
    </div>
  );
}
