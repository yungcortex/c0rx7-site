import { create } from "zustand";
import { supabase, type Session, type User } from "@net/supabase";

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  init: () => Promise<void>;
  setSession: (s: Session | null) => void;
}

export const useAuth = create<AuthState>((set) => ({
  session: null,
  user: null,
  loading: true,
  setSession: (session) => set({ session, user: session?.user ?? null }),
  init: async () => {
    if (!supabase) {
      set({ loading: false });
      return;
    }
    const { data } = await supabase.auth.getSession();
    set({ session: data.session, user: data.session?.user ?? null, loading: false });
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null });
    });
  },
}));
