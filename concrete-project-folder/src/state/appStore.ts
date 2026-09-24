import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AppModule = 'beam' | 'column' | 'footing' | 'pilecap';

interface AppModuleState {
  module: AppModule;
  setModule: (module: AppModule) => void;
}

export const useAppModule = create<AppModuleState>()(
  persist((set) => ({ module: 'beam', setModule: (module) => set({ module }) }), { name: 'rc-wsd-module', version: 1 }),
);
