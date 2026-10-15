'use client';

import { createContext, useContext } from 'react';

export type QuickKind = 'task' | 'followup' | 'note' | 'interrupt' | 'project';

export interface UIApi {
  openTask: (id: string) => void;
  quickAdd: (kind: QuickKind) => void;
  editProject: (id: string) => void;
  editBlock: (id: string) => void;
}

export const UICtx = createContext<UIApi | null>(null);
export const useUI = () => {
  const v = useContext(UICtx);
  if (!v) throw new Error('useUI must be used inside the app shell');
  return v;
};
