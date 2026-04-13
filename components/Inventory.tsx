"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, BookOpen, FileText, Link, Trash2, Search,
  Archive, X, ExternalLink
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getInventory, addToInventory, deleteFromInventory } from "../lib/db";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { open } from '@tauri-apps/plugin-shell';

type InventoryItem = {
  id: number;
  type: "report" | "note" | "resource";
  title: string;
  content: string;
  metadata: string;
  created_at: string;
};

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "report" | "note" | "resource">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [newItem, setNewItem] = useState({ type: "note" as any, title: "", content: "", metadata_link: "" });

  const loadInventory = useCallback(async () => {
    const res = await getInventory(activeTab === "all" ? undefined : activeTab);
    setItems(res as InventoryItem[]);
  }, [activeTab]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const handleAdd = async () => {
    if (!newItem.title || !newItem.content) return;
    const meta = newItem.type === "resource" ? { link: newItem.metadata_link } : {};
    await addToInventory(newItem.type, newItem.title, newItem.content, meta);
    setIsAdding(false);
    setNewItem({ type: "note", title: "", content: "", metadata_link: "" });
    loadInventory();
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete this item from inventory?")) {
      await deleteFromInventory(id);
      if (selectedItem?.id === id) setSelectedItem(null);
      loadInventory();
    }
  };

  const filteredItems = items.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-claude-bg text-claude-text p-8 overflow-hidden">
      <div className="max-w-6xl w-full mx-auto flex flex-col h-full bg-claude-panel border border-claude-border rounded-[2.5rem] shadow-2xl overflow-hidden">

        {/* Header Section */}
        <header className="px-10 py-8 border-b border-claude-border bg-claude-hover/10 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-3">
              <Archive className="text-claude-accent" size={28} />
              Engineering Archive
            </h1>
            <p className="text-xs font-bold text-claude-muted uppercase tracking-[0.3em]">Knowledge base & Mission containers</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-claude-muted" size={14} />
              <input
                type="text"
                placeholder="Search archives..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-claude-bg/50 border border-claude-border/40 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-claude-accent transition-all w-64 font-mono"
              />
            </div>
            <button
              onClick={() => setIsAdding(true)}
              className="bg-claude-accent text-white px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg"
            >
              <Plus size={16} strokeWidth={3} /> Add New
            </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar / Tabs */}
          <aside className="w-64 border-r border-claude-border px-6 py-8 bg-claude-panel/30 flex flex-col gap-2 shrink-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-claude-muted/50 mb-4 px-2">Archive Filter</p>
            {([
              { id: "all", label: "All Items", icon: Archive },
              { id: "report", label: "Interview Reports", icon: FileText },
              { id: "note", label: "Engineering Notes", icon: BookOpen },
              { id: "resource", label: "Static Resources", icon: Link },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id
                  ? "bg-claude-accent/10 border border-claude-accent/20 text-claude-accent shadow-sm"
                  : "text-claude-muted hover:bg-claude-hover/50 hover:text-claude-text"
                  }`}
              >
                <tab.icon size={18} strokeWidth={activeTab === tab.id ? 2.5 : 1.5} />
                {tab.label}
              </button>
            ))}
          </aside>

          {/* Content Area */}
          <main className="flex-1 overflow-y-auto p-10 scrollbar-hide">
            {activeTab === "resource" && (
              <div className="mb-12">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-claude-accent mb-6 px-1">Promoted Intelligence Nodes</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { name: "Striver's A2Z", url: "https://takeuforward.org/strivers-a2z-dsa-course/strivers-a2z-dsa-course-sheet-2/", desc: "Master mission blueprint." },
                    { name: "LeetCode Hub", url: "https://leetcode.com/problemset/all/", desc: "Primary problem arena." },
                    { name: "CP Algorithms", url: "https://cp-algorithms.com/", desc: "Deep theoretical logic." },
                    { name: "GFG Archives", url: "https://www.geeksforgeeks.org/data-structures/", desc: "Classical documentation." },
                    { name: "Visualgo.net", url: "https://visualgo.net/", desc: "Visual data structures." },
                  ].map(link => (
                    <button
                      key={link.name}
                      onClick={() => open(link.url)}
                      className="flex flex-col gap-2 p-5 rounded-3xl bg-claude-accent/5 border-2 border-claude-accent/10 hover:border-claude-accent/30 text-left transition-all group relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between relative z-10">
                        <span className="text-xs font-black uppercase tracking-widest text-claude-accent">{link.name}</span>
                        <ExternalLink size={12} className="text-claude-accent opacity-40 group-hover:opacity-100 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </div>
                      <span className="text-[10px] font-medium text-claude-muted relative z-10">{link.desc}</span>
                      <div className="absolute inset-0 bg-gradient-to-br from-claude-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <AnimatePresence mode="wait">
              {filteredItems.length === 0 ? (activeTab !== "resource" && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="h-full flex flex-col items-center justify-center text-center opacity-40 py-20"
                >
                  <Archive size={64} className="mb-6 opacity-20" />
                  <p className="text-xl font-medium mb-1">No matches found in inventory</p>
                  <p className="text-sm">Initiate a mission or add notes to build your archive.</p>
                </motion.div>
              )) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
                  {filteredItems.map(item => (
                    <motion.div
                      layout
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className="group bg-claude-bg/30 border border-claude-border/40 rounded-3xl p-6 hover:border-claude-accent/30 transition-all cursor-pointer relative shadow-sm hover:shadow-md"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className={`p-2 rounded-xl border ${item.type === 'report' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                            item.type === 'note' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' :
                              'bg-green-500/10 border-green-500/20 text-green-400'
                            }`}>
                            {item.type === 'report' ? <FileText size={16} /> : item.type === 'note' ? <BookOpen size={16} /> : <Link size={16} />}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-40">{new Date(item.created_at).toLocaleDateString()}</span>
                        </div>
                        <button
                          onClick={(e) => handleDelete(item.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-500/10 rounded-lg text-red-400/60 hover:text-red-400 transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <h3 className="text-lg font-bold text-claude-text mb-2 line-clamp-1">{item.title}</h3>
                      <p className="text-sm text-claude-muted line-clamp-2 leading-relaxed font-sans">{item.content}</p>
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* Modal: View Item */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-8">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setSelectedItem(null)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-claude-panel border border-claude-border rounded-[3rem] w-full max-w-4xl max-h-[85vh] relative shadow-2xl flex flex-col overflow-hidden"
            >
              <header className="px-12 py-8 border-b border-claude-border flex items-center justify-between shrink-0 bg-claude-hover/5">
                <div className="flex items-center gap-4">
                  <span className={`p-2.5 rounded-2xl border ${selectedItem.type === 'report' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                    selectedItem.type === 'note' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' :
                      'bg-green-500/10 border-green-500/20 text-green-400'
                    }`}>
                    {selectedItem.type === 'report' ? <FileText size={20} /> : selectedItem.type === 'note' ? <BookOpen size={20} /> : <Link size={20} />}
                  </span>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">{selectedItem.title}</h2>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-claude-muted mt-1">Archived on {new Date(selectedItem.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedItem(null)} className="p-2 hover:bg-claude-hover rounded-full text-claude-muted hover:text-claude-text transition-all">
                  <X size={24} />
                </button>
              </header>
              <div className="flex-1 overflow-y-auto px-12 py-10 prose prose-invert max-w-none scrollbar-hide">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {selectedItem.content}
                </ReactMarkdown>

                {selectedItem.type === "resource" && selectedItem.metadata && (
                  <div className="mt-8 pt-8 border-t border-claude-border">
                    <p className="text-xs font-black uppercase tracking-widest text-claude-muted mb-4 text-center">Reference Link</p>
                    <button
                      onClick={() => {
                        try {
                          const meta = JSON.parse(selectedItem!.metadata);
                          if (meta.link) open(meta.link);
                        } catch (e) {
                          console.error("Failed to parse metadata", e);
                        }
                      }}
                      className="block w-full py-4 px-6 bg-claude-accent/10 border-2 border-claude-accent/20 rounded-2xl text-center text-claude-accent font-bold hover:bg-claude-accent/20 transition-all flex items-center justify-center gap-2"
                    >
                      Open Resource <ExternalLink size={18} />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Add Item */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-8">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setIsAdding(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-claude-panel border border-claude-border rounded-[2.5rem] w-full max-w-xl relative shadow-2xl overflow-hidden p-10"
            >
              <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
                <Plus className="text-claude-accent" size={24} strokeWidth={3} />
                New Entry Node
              </h2>
              <div className="space-y-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-claude-muted px-1">Entry Type</label>
                  <div className="flex gap-2">
                    {(['note', 'resource'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setNewItem({ ...newItem, type: t })}
                        className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all ${newItem.type === t
                          ? "bg-claude-accent border-claude-accent/30 text-white shadow-lg"
                          : "bg-claude-bg/50 border-claude-border/40 text-claude-muted hover:border-claude-muted"
                          }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-claude-muted px-1">Title</label>
                  <input
                    type="text"
                    value={newItem.title}
                    onChange={e => setNewItem({ ...newItem, title: e.target.value })}
                    placeholder="E.g. Bit Manipulation Cheat Sheet"
                    className="w-full bg-claude-bg/50 border border-claude-border/40 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-claude-accent transition-all font-mono"
                  />
                </div>
                {newItem.type === 'resource' && (
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-claude-muted px-1">Source Link</label>
                    <input
                      type="text"
                      value={newItem.metadata_link}
                      onChange={e => setNewItem({ ...newItem, metadata_link: e.target.value })}
                      placeholder="https://..."
                      className="w-full bg-claude-bg/50 border border-claude-border/40 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-claude-accent transition-all font-mono"
                    />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-claude-muted px-1">Content (Markdown)</label>
                  <textarea
                    value={newItem.content}
                    onChange={e => setNewItem({ ...newItem, content: e.target.value })}
                    placeholder="Enter notes or description..."
                    rows={6}
                    className="w-full bg-claude-bg/50 border border-claude-border/40 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-claude-accent transition-all font-mono resize-none"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => setIsAdding(false)}
                    className="flex-1 py-3 px-6 rounded-xl text-sm font-bold border border-claude-border hover:bg-claude-hover transition-all text-claude-muted"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAdd}
                    className="flex-[2] py-3 px-6 bg-claude-accent text-white rounded-xl text-sm font-black uppercase tracking-widest shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Save Node
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
