import { create } from 'zustand';
import { countPending, listOutbox, onOutboxChange } from '../api/outboxRepo';
import type { OutboxRow } from '../types';

interface OutboxState {
  rows: OutboxRow[];
  pending: number;
  refresh: () => void;
}

export const useOutboxStore = create<OutboxState>((set) => ({
  rows: [],
  pending: 0,
  refresh: () => set({ rows: listOutbox(), pending: countPending() }),
}));

onOutboxChange(() => {
  useOutboxStore.getState().refresh();
});
