import { create } from 'zustand';

interface ProfileState {
  onboardingCompleted: boolean | null;
  displayName: string | null;
  setOnboardingCompleted: (value: boolean) => void;
  setDisplayName: (name: string) => void;
  reset: () => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  onboardingCompleted: null,
  displayName: null,
  setOnboardingCompleted: (value) => set({ onboardingCompleted: value }),
  setDisplayName: (name) => set({ displayName: name }),
  reset: () => set({ onboardingCompleted: null, displayName: null }),
}));
