import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeProfile {
  bg: string;
  panel: string;
  hover: string;
  border: string;
  text: string;
  muted: string;
}

interface EditorStore {
  drafts: Record<string, string>;
  chatHistories: Record<string, any[]>;
  notes: Record<string, string>;
  accentColor: string;
  fontFamily: string;
  profilePic: string | null;
  theme: ThemeProfile;
  editorDynamicTheme: boolean;
  setDraft: (id: string, language: string, code: string) => void;
  getDraft: (id: string, language: string) => string | null;
  setChatHistory: (missionId: string, messages: any[]) => void;
  getChatHistory: (missionId: string) => any[] | null;
  setNotes: (missionId: string, content: string) => void;
  getNotes: (missionId: string) => string | null;
  setAccentColor: (color: string) => void;
  setFontFamily: (font: string) => void;
  setProfilePic: (pic: string | null) => void;
  setTheme: (theme: ThemeProfile) => void;
  setEditorDynamicTheme: (dynamic: boolean) => void;
  clearStore: () => void;
}

const initialState = {
  drafts: {},
  chatHistories: {},
  notes: {},
  accentColor: '#da7756',
  fontFamily: 'JetBrains Mono',
  profilePic: null,
  theme: {
    bg: '#1c1c1a',
    panel: '#272725',
    hover: '#353533',
    border: '#3b3b38',
    text: '#e6e4d9',
    muted: '#a3a198',
  },
  editorDynamicTheme: true,
};

export const useEditorStore = create<EditorStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      setDraft: (id, language, code) =>
        set((state) => ({
          drafts: { ...state.drafts, [`${id}-${language}`]: code }
        })),
      getDraft: (id, language) => get().drafts[`${id}-${language}`] || null,
      setChatHistory: (missionId, messages) =>
        set((state) => ({
          chatHistories: { ...state.chatHistories, [missionId]: messages }
        })),
      getChatHistory: (missionId) => get().chatHistories[missionId] || null,
      setNotes: (missionId, content) =>
        set((state) => ({
          notes: { ...state.notes, [missionId]: content }
        })),
      getNotes: (missionId) => get().notes[missionId] || null,
      setAccentColor: (color) => set({ accentColor: color }),
      setFontFamily: (font) => set({ fontFamily: font }),
      setProfilePic: (pic) => set({ profilePic: pic }),
      setTheme: (theme) => set({ theme }),
      setEditorDynamicTheme: (dynamic) => set({ editorDynamicTheme: dynamic }),
      clearStore: () => set(initialState),
    }),
    {
      name: 'mission-gateway-v1',
      storage: {
        getItem: (name) => {
          if (typeof window === 'undefined') return null;
          const userId = localStorage.getItem("qued_user_id") || "guest";
          const data = localStorage.getItem(`${name}-${userId}`);
          return data ? JSON.parse(data) : null;
        },
        setItem: (name, value) => {
          if (typeof window === 'undefined') return;
          const userId = localStorage.getItem("qued_user_id") || "guest";
          localStorage.setItem(`${name}-${userId}`, JSON.stringify(value));
        },
        removeItem: (name) => {
          if (typeof window === 'undefined') return;
          const userId = localStorage.getItem("qued_user_id") || "guest";
          localStorage.removeItem(`${name}-${userId}`);
        }
      }
    }
  )
);
