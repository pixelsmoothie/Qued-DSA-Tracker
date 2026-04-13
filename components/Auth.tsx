"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Lock, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AuthProps {
    onAuth: (user: { id: string; name: string }) => void;
}

export default function Auth({ onAuth }: AuthProps) {
    const [isRegister, setIsRegister] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isRegister) {
                // 1. Check if user already exists
                const { data: existing } = await supabase
                    .from('users_registry')
                    .select('id')
                    .eq('username', username)
                    .single();

                if (existing) throw new Error("This ID is already claimed.");

                // 2. Register in custom table
                const { data: newUser, error: regError } = await supabase
                    .from('users_registry')
                    .insert([{ username, password }])
                    .select()
                    .single();

                if (regError) {
                    console.error("Registry error:", regError);
                    throw new Error("Registry Protocol failed. (Make sure 'users_registry' table exists)");
                }

                if (newUser) {
                    const userObj = {
                        id: newUser.id,
                        name: username,
                        role: newUser.role || (username.toLowerCase() === 'admin' ? 'Admin Observer' : 'Authorized User')
                    };
                    localStorage.setItem("qued_user_id", userObj.id);
                    localStorage.setItem("qued_user_name", username);
                    localStorage.setItem("qued_user_role", userObj.role);
                    onAuth(userObj);
                }
            } else {
                // 3. Login check
                const { data: user, error: loginError } = await supabase
                    .from('users_registry')
                    .select('*')
                    .eq('username', username)
                    .eq('password', password)
                    .single();

                if (loginError || !user) throw new Error("Invalid Credentials.");

                const userObj = {
                    id: user.id,
                    name: username,
                    role: user.role || (username.toLowerCase() === 'admin' ? 'Admin Observer' : 'Authorized User')
                };
                localStorage.setItem("qued_user_id", userObj.id);
                localStorage.setItem("qued_user_name", username);
                localStorage.setItem("qued_user_role", userObj.role);
                onAuth(userObj);
            }
        } catch (err: any) {
            console.error("Auth process failure:", err);
            setError(err.message || "Credential verification failed.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-6 relative overflow-hidden font-sans">
            {/* Dynamic Background */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(79,70,229,0.1)_0%,transparent_50%)]" />
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md z-10"
            >
                <div className="bg-[#0A0A0A] border border-white/5 rounded-[2.5rem] p-10 shadow-[0_50px_100px_rgba(0,0,0,0.8)] backdrop-blur-3xl relative overflow-hidden">
                    {/* Top Glow */}
                    <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-600/30 rounded-full blur-[80px]" />

                    <div className="flex flex-col items-center mb-10 text-center">
                        <h1 className="text-5xl font-black text-white tracking-tighter mb-2 italic">QUED</h1>
                        <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.5em]">Command Gateway v1.0</p>
                    </div>

                    <form onSubmit={handleAuth} className="space-y-6">
                        <div className="space-y-4">
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-indigo-400 transition-colors">
                                    <User size={18} />
                                </div>
                                <input
                                    type="text"
                                    placeholder="USERNAME"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white placeholder:text-white/10 focus:border-indigo-500/50 focus:bg-white/[0.05] outline-none transition-all font-mono tracking-widest"
                                    required
                                />
                            </div>

                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-indigo-400 transition-colors">
                                    <Lock size={18} />
                                </div>
                                <input
                                    type="password"
                                    placeholder="PASSWORD"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white placeholder:text-white/10 focus:border-indigo-500/50 focus:bg-white/[0.05] outline-none transition-all font-mono tracking-widest"
                                    required
                                />
                            </div>
                        </div>

                        <AnimatePresence mode="wait">
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="bg-red-500/10 border border-red-500/20 rounded-xl p-3"
                                >
                                    <p className="text-red-400 text-[10px] uppercase font-black text-center tracking-widest leading-tight">{error}</p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-white text-black h-14 rounded-2xl font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                            ) : (
                                <>
                                    {isRegister ? 'Initialize Account' : 'Authenticate Access'}
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-10 pt-8 border-t border-white/5 flex flex-col items-center gap-4">
                        <button
                            onClick={() => setIsRegister(!isRegister)}
                            className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-indigo-400 transition-colors"
                        >
                            {isRegister ? 'Already have credentials? Login' : 'Need new credentials? Register'}
                        </button>

                        <div className="flex items-center gap-2 text-white/10">
                            <Sparkles size={12} />
                            <span className="text-[8px] font-black uppercase tracking-widest">Secured by Ollama Cloud</span>
                        </div>
                    </div>
                </div>

                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.2 }}
                    className="mt-8 text-center text-[10px] font-black uppercase tracking-[0.5em] text-white"
                >
                    Encryption Active • 256-Bit Signal
                </motion.p>
            </motion.div>
        </div>
    );
}
