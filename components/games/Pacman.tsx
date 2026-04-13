"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Play, Trophy, AlertTriangle, Cpu } from "lucide-react";

const GRID_SIZE = 20;
const TILE_SIZE = 24;

export default function Pacman() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<"idle" | "playing" | "gameover">("idle");
  const [score, setScore] = useState(0);
  
  const stateRef = useRef({
    pac: { x: 1 * TILE_SIZE, y: 1 * TILE_SIZE, gridX: 1, gridY: 1, dirX: 0, dirY: 0, nextDirX: 0, nextDirY: 0 },
    ghosts: [
      { x: 18 * TILE_SIZE, y: 18 * TILE_SIZE, gridX: 18, gridY: 18, dirX: 0, dirY: 0, color: "#ff4b2b" },
      { x: 1 * TILE_SIZE, y: 18 * TILE_SIZE, gridX: 1, gridY: 18, dirX: 0, dirY: 0, color: "#ff416c" },
    ],
    map: (Array(GRID_SIZE).fill(0).map((_, y) => 
      Array(GRID_SIZE).fill(0).map((_, x) => 
        (x === 0 || x === GRID_SIZE - 1 || y === 0 || y === GRID_SIZE - 1 || (x % 4 === 0 && y % 4 === 0)) ? 1 : 2
      )
    )) as number[][],
    speed: 2,
  });

  const requestRef = useRef<number | null>(null);

  const resetGame = () => {
    stateRef.current.pac = { x: 1 * TILE_SIZE, y: 1 * TILE_SIZE, gridX: 1, gridY: 1, dirX: 0, dirY: 0, nextDirX: 0, nextDirY: 0 };
    setScore(0);
    stateRef.current.map = stateRef.current.map.map((row) => 
      row.map((cell) => cell === 0 || cell === 2 ? 2 : 1)
    );
  };

  const update = () => {
    const s = stateRef.current;
    const p = s.pac;

    // Movement Logic for Pacman
    if (p.x % TILE_SIZE === 0 && p.y % TILE_SIZE === 0) {
      p.gridX = Math.round(p.x / TILE_SIZE);
      p.gridY = Math.round(p.y / TILE_SIZE);

      // Bounds check for safety
      if (p.gridY >= 0 && p.gridY < s.map.length && s.map[p.gridY]) {
          // Eat pellet
          if (s.map[p.gridY][p.gridX] === 2) {
            s.map[p.gridY][p.gridX] = 0;
            setScore(v => v + 10);
          }

          // Turn if possible
          if (p.nextDirX !== 0 || p.nextDirY !== 0) {
            if (s.map[p.gridY + p.nextDirY]?.[p.gridX + p.nextDirX] !== 1) {
              p.dirX = p.nextDirX;
              p.dirY = p.nextDirY;
            }
          }

          // Stop at wall
          if (s.map[p.gridY + p.dirY]?.[p.gridX + p.dirX] === 1) {
            p.dirX = 0;
            p.dirY = 0;
          }
      } else {
          // Fail-safe reset if somehow out of bounds
          resetGame();
          return;
      }
    }

    p.x += p.dirX * s.speed;
    p.y += p.dirY * s.speed;

    // Ghost Movement
    s.ghosts.forEach(g => {
      if (g.x % TILE_SIZE === 0 && g.y % TILE_SIZE === 0) {
        g.gridX = Math.round(g.x / TILE_SIZE);
        g.gridY = Math.round(g.y / TILE_SIZE);

        const dirs = [{x:1, y:0}, {x:-1, y:0}, {x:0, y:1}, {x:0, y:-1}];
        
        // Prefer not going backwards unless it's the only option
        let valid = dirs.filter(d => s.map[g.gridY + d.y]?.[g.gridX + d.x] !== 1 && (d.x !== -g.dirX || d.y !== -g.dirY));
        
        if (valid.length === 0) {
          // Fallback: search all directions including backwards, but must not be a wall
          valid = dirs.filter(d => s.map[g.gridY + d.y]?.[g.gridX + d.x] !== 1);
        }

        const d = (valid.length > 0) ? valid[Math.floor(Math.random() * valid.length)] : { x: 0, y: 0 };
        g.dirX = d.x;
        g.dirY = d.y;
      }
      g.x += g.dirX * (s.speed * 0.75);
      g.y += g.dirY * (s.speed * 0.75);

      // Collision
      const dx = g.x - p.x;
      const dy = g.y - p.y;
      if (Math.abs(dx) < TILE_SIZE * 0.8 && Math.abs(dy) < TILE_SIZE * 0.8) {
        setGameState("gameover");
      }
    });

    if (score > 2000) setGameState("gameover");
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    const s = stateRef.current;
    ctx.clearRect(0, 0, 480, 480);

    // Map
    s.map.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell === 1) {
          ctx.fillStyle = "rgba(129, 140, 248, 0.15)";
          ctx.fillRect(x * TILE_SIZE + 2, y * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        } else if (cell === 2) {
          ctx.fillStyle = "rgba(255,255,255,0.4)";
          ctx.beginPath();
          ctx.arc(x * TILE_SIZE + TILE_SIZE/2, y * TILE_SIZE + TILE_SIZE/2, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    });

    // Neural Pacman
    ctx.fillStyle = "#ffde34";
    ctx.shadowBlur = 10; ctx.shadowColor = "#ffde34";
    ctx.beginPath();
    ctx.arc(s.pac.x + TILE_SIZE/2, s.pac.y + TILE_SIZE/2, TILE_SIZE/2 - 2, 0.2 * Math.PI, 1.8 * Math.PI);
    ctx.lineTo(s.pac.x + TILE_SIZE/2, s.pac.y + TILE_SIZE/2);
    ctx.fill();

    // Ghosts
    s.ghosts.forEach(g => {
      ctx.fillStyle = g.color;
      ctx.shadowColor = g.color;
      ctx.beginPath();
      ctx.arc(g.x + TILE_SIZE/2, g.y + TILE_SIZE/2 - 2, TILE_SIZE/2 - 2, Math.PI, 0);
      ctx.lineTo(g.x + TILE_SIZE - 2, g.y + TILE_SIZE - 2);
      ctx.lineTo(g.x + 2, g.y + TILE_SIZE - 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;
  };

  const loop = () => {
    if (gameState === "playing") {
      update();
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) draw(ctx);
      }
      requestRef.current = requestAnimationFrame(loop);
    }
  };

  useEffect(() => {
    if (gameState === "playing") {
      requestRef.current = requestAnimationFrame(loop);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (e.key === "ArrowUp") s.pac.nextDirX = 0, s.pac.nextDirY = -1;
      if (e.key === "ArrowDown") s.pac.nextDirX = 0, s.pac.nextDirY = 1;
      if (e.key === "ArrowLeft") s.pac.nextDirX = -1, s.pac.nextDirY = 0;
      if (e.key === "ArrowRight") s.pac.nextDirX = 1, s.pac.nextDirY = 0;
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl px-4">
      <div className="flex w-full justify-between items-center bg-white/5 border border-white/10 rounded-[2rem] p-6 px-10 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col items-center">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 mb-1">Packets Intercepted</span>
            <span className="text-4xl font-black font-mono text-white tracking-widest">{score.toString().padStart(5, '0')}</span>
        </div>
        <Cpu className="text-white/10" size={32} strokeWidth={1} />
      </div>

      <div className="relative group overflow-hidden rounded-[3rem] border border-white/20 shadow-[0_40px_80px_rgba(0,0,0,0.6)] bg-black/95 p-6">
        <canvas
          ref={canvasRef}
          width={480}
          height={480}
          className="rounded-2xl"
        />
        
        {gameState === "idle" && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-xl flex flex-col items-center justify-center p-12 text-center">
             <div className="w-16 h-16 rounded-full bg-yellow-400 text-black flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(255,222,52,0.4)]">
              <Play size={24} fill="currentColor" />
            </div>
            <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">Neural Runner</h3>
            <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-8 max-w-[280px]">Protocol: Intercept all data packets.</p>
            <button 
              onClick={() => { resetGame(); setGameState("playing"); }}
              className="bg-white text-black px-12 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:scale-105 active:scale-95 transition-all shadow-xl"
            >
              Initialize Node
            </button>
          </div>
        )}

        {gameState === "gameover" && (
           <div className="absolute inset-0 bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-center p-12 text-center">
            <AlertTriangle size={64} className="text-red-500 mb-6 drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]" />
            <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Stack Overflow</h3>
            <p className="text-white/40 text-[10px] font-black tracking-[0.3em] uppercase mt-2 mb-10">Data Leakage Detected: {score}</p>
            <button 
              onClick={() => { setScore(0); setGameState("idle"); }}
              className="flex items-center gap-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-10 py-5 rounded-3xl transition-all uppercase text-[10px] font-black tracking-widest"
            >
              <RefreshCw size={16} /> Re-Calculate
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-4 opacity-30 hover:opacity-100 transition-opacity">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50 bg-white/5 px-6 py-2.5 rounded-full border border-white/10">Arrow Keys: Navigate Neural Grid</span>
      </div>
    </div>
  );
}
