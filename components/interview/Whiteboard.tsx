"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Pencil, RotateCcw, Trash2, Sparkles } from "lucide-react";

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  width: number;
}

export default function Whiteboard({ color }: { color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);

  const redraw = useCallback(() => {
    const context = contextRef.current;
    if (!context || !canvasRef.current) return;
    
    context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    // Safety check for empty strokes
    const allStrokes = [...strokes];
    if (currentStroke.length > 1) {
      allStrokes.push({ points: currentStroke, color, width: 2.5 });
    }

    allStrokes.forEach(stroke => {
      if (!stroke.points || stroke.points.length < 2) return;
      context.beginPath();
      context.strokeStyle = stroke.color || color;
      context.lineWidth = stroke.width || 2.5;
      context.lineCap = "round";
      context.lineJoin = "round";
      
      context.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        context.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      context.stroke();
    });
  }, [strokes, currentStroke, color]);

  useEffect(() => {
    const initCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      
      // Prevent crash if container is not yet rendered
      if (rect.width === 0 || rect.height === 0) return;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      const context = canvas.getContext("2d");
      if (!context) return;
      
      context.scale(dpr, dpr);
      contextRef.current = context;
      redraw();
    };

    // Initial load
    const timeout = setTimeout(initCanvas, 50);
    
    window.addEventListener("resize", initCanvas);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("resize", initCanvas);
    };
  }, [redraw]);

  useEffect(() => { redraw(); }, [redraw]);

  const getCoord = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e && e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
    }
    
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const { x, y } = getCoord(e);
    setIsDrawing(true);
    setCurrentStroke([{ x, y }]);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getCoord(e);
    setCurrentStroke(prev => [...prev, { x, y }]);
  };

  const stopDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentStroke.length > 1) {
      setStrokes(prev => [...prev, { points: [...currentStroke], color, width: 2.5 }]);
    }
    setCurrentStroke([]);
  };

  const clear = () => {
    setStrokes([]);
    setCurrentStroke([]);
  };

  const undo = () => {
    setStrokes(prev => prev.slice(0, -1));
  };

  return (
    <div className="h-full flex flex-col gap-3 selection:bg-none select-none">
      <div className="flex items-center justify-between px-2 shrink-0">
        <div className="flex items-center gap-1.5 p-1 bg-black/20 rounded-xl border border-white/5">
          <div className="p-2 rounded-lg bg-white/10 text-white"><Pencil size={14} /></div>
          <button onClick={undo} className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-all"><RotateCcw size={14} /></button>
          <button onClick={clear} className="p-2 rounded-lg hover:bg-white/5 text-red-400/50 hover:text-red-400 transition-all"><Trash2 size={14} /></button>
        </div>
        <div className="text-[9px] font-black uppercase text-claude-muted/40 tracking-[0.2em] px-3">
          Neural Drawing Layer
        </div>
      </div>
      
      <div className="flex-1 bg-black/40 border border-white/5 rounded-2xl relative overflow-hidden cursor-crosshair touch-none">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-full block"
        />
        {strokes.length === 0 && currentStroke.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
            <div className="text-center">
              <Sparkles size={48} className="mx-auto mb-4 text-white" />
              <p className="text-xs font-black uppercase tracking-[0.4em] text-white">Algorithm Sketchpad</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
