import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface DuelPlayer {
  user_id: string;
  display_name: string;
  status: 'idle' | 'coding' | 'submitted';
  days_elapsed?: number;
  progress_days?: number;
}

export interface DuelResult {
  user_id: string;
  rank: number;
  score: number;
  feedback: string;
  key_insight: string;
}

export class DuelOrchestrator {
  private channel: RealtimeChannel | null = null;
  private roomId: string | null = null;
  private userId: string;
  private userName: string;
  private daysElapsed: number = 0;

  public onPlayerJoined?: (players: DuelPlayer[]) => void;
  public onProblemDrop?: (problem: any) => void;
  public onResults?: (results: DuelResult[]) => void;
  public onOpponentProgress?: (userId: string, status: string) => void;

  constructor(userId: string, userName: string, daysElapsed: number = 0) {
    this.userId = userId;
    this.userName = userName;
    this.daysElapsed = daysElapsed;
  }

  async createRoom() {
    const neuralKey = Math.random().toString(36).substring(2, 8).toUpperCase();

    console.log("[Duel] Attempting room creation with key:", neuralKey);
    const { data: room, error } = await supabase
      .from('rooms')
      .insert([{ neural_key: neuralKey, status: 'lobby' }])
      .select('id, neural_key, status')
      .single();

    if (error) {
      console.error("[Duel] Room creation failed:", error);
      throw new Error(`Room Creation Error: ${error.message || "Unknown"}`);
    }
    console.log("[Duel] Room created successfully:", room);
    this.roomId = room.id;

    // 2. Join as first player
    await this.joinRoom(neuralKey);
    return neuralKey;
  }

  async joinRoom(neuralKey: string) {
    // 1. Find room
    const { data: room, error } = await supabase
      .from('rooms')
      .select('id, neural_key, status')
      .eq('neural_key', neuralKey)
      .single();

    if (error) {
      console.error("[Duel] Room fetch failed:", error);
      throw new Error(`Room Lookup Error: ${error.message || "Unknown"}`);
    }
    this.roomId = room.id;
    console.log("[Duel] Joining room:", neuralKey, "Room ID:", this.roomId);
    const { error: pError } = await supabase
      .from('players')
      .upsert(
        [{ room_id: this.roomId, user_id: this.userId, display_name: this.userName }]
      )
      .select('user_id');

    if (pError) {
      console.error("[Duel] Player join failed:", pError);
      throw new Error(`Player Join Error: ${pError.message || "Unknown"}`);
    }
    console.log("[Duel] Player joined successfully");

    // 3. Subscribe to Realtime Channel
    this.channel = supabase.channel(`room:${this.roomId}`, {
      config: {
        presence: {
          key: this.userId,
        },
      },
    });

    this.channel
      .on('presence', { event: 'sync' }, () => {
        this.syncPresence();
      })
      .on('presence', { event: 'join' }, () => {
        this.syncPresence();
      })
      .on('presence', { event: 'leave' }, () => {
        this.syncPresence();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'players', filter: `room_id=eq.${this.roomId}` }, () => {
        this.fetchPlayers();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'submissions', filter: `room_id=eq.${this.roomId}` }, (payload) => {
        this.onOpponentProgress?.(payload.new.user_id, 'submitted');
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${this.roomId}` }, (payload) => {
        if (payload.new.status === 'battle' && payload.new.problem_id) {
          this.fetchProblem(payload.new.problem_id);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rankings', filter: `room_id=eq.${this.roomId}` }, () => {
        this.fetchResults();
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await this.channel?.track({
            progress_days: this.daysElapsed,
            display_name: this.userName,
            online_at: new Date().toISOString(),
          });
        }
      });

    // Initial player list fetch
    this.fetchPlayers();

    return room;
  }

  async startDuel(problemId: string) {
    if (!this.roomId) return;
    const { error } = await supabase
      .from('rooms')
      .update({ status: 'battle', problem_id: problemId, started_at: new Date().toISOString() })
      .eq('id', this.roomId);
    if (error) throw error;
  }

  async submitCode(code: string, language: string) {
    if (!this.roomId) return;

    const { error } = await supabase
      .from('submissions')
      .insert([{
        room_id: this.roomId,
        user_id: this.userId,
        code,
        language
      }]);

    if (error) throw error;
  }

  async triggerJudge(force: boolean = false) {
    if (!this.roomId) return;

    const response = await fetch('https://mahgjriopzwcllmpisty.supabase.co/functions/v1/judge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ room_id: this.roomId, force })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || data.details || `Protocol Error ${response.status}`);
    }
    return data;
  }

  private async fetchPlayers() {
    const { data, error } = await supabase
      .from('players')
      .select('user_id, display_name')
      .eq('room_id', this.roomId);

    if (!error && data) {
      this.onPlayerJoined?.(data.map(p => ({ ...p, status: 'idle' })));
    }
  }

  private async fetchProblem(problemId: string) {
    const { data, error } = await supabase
      .from('problems')
      .select('*')
      .eq('id', problemId)
      .single();
    if (!error && data) {
      this.onProblemDrop?.(data);
    }
  }

  private async fetchResults() {
    const { data, error } = await supabase
      .from('rankings')
      .select('*')
      .eq('room_id', this.roomId)
      .order('rank', { ascending: true });
    if (!error && data) {
      this.onResults?.(data);
    }
  }

  cleanup() {
    this.channel?.unsubscribe();
  }

  private syncPresence() {
    if (!this.channel) return;
    const state = this.channel.presenceState();

    // Convert presence state to list of DuelPlayer
    const players: DuelPlayer[] = [];
    Object.keys(state).forEach((uid) => {
      const pList = state[uid];
      if (Array.isArray(pList) && pList.length > 0) {
        const p = pList[0] as any;
        players.push({
          user_id: uid,
          display_name: p.display_name || 'Guest',
          days_elapsed: p.progress_days || 0,
          status: 'idle'
        });
      }
    });

    if (players.length > 0) {
      this.onPlayerJoined?.(players);
    }
  }
}
