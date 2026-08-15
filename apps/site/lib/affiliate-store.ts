import { create } from "zustand";

type AuthFlow = "signIn" | "signUp";

interface AffiliateAuthStore {
  flow: AuthFlow;
  setFlow: (flow: AuthFlow) => void;
  isSubmitting: boolean;
  setIsSubmitting: (v: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useAffiliateAuth = create<AffiliateAuthStore>((set) => ({
  flow: "signUp",
  setFlow: (flow) => set({ flow, error: null }),
  isSubmitting: false,
  setIsSubmitting: (isSubmitting) => set({ isSubmitting }),
  error: null,
  setError: (error) => set({ error }),
  reset: () => set({ flow: "signUp", isSubmitting: false, error: null }),
}));

interface CodeCustomizeStore {
  isEditing: boolean;
  setIsEditing: (v: boolean) => void;
  customCode: string;
  setCustomCode: (code: string) => void;
  error: string | null;
  setError: (error: string | null) => void;
}

export const useCodeCustomize = create<CodeCustomizeStore>((set) => ({
  isEditing: false,
  setIsEditing: (isEditing) => set({ isEditing, error: null }),
  customCode: "",
  setCustomCode: (customCode) => set({ customCode }),
  error: null,
  setError: (error) => set({ error }),
}));
