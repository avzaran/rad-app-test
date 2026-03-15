import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { OpenProtocol } from "../types/models";

type ProtocolTabsStore = {
  openProtocols: OpenProtocol[];
  activeProtocolId: string | null;
  openProtocol: (protocol: OpenProtocol) => void;
  closeProtocol: (id: string) => void;
  setActiveProtocol: (id: string | null) => void;
  clear: () => void;
};

export const useProtocolTabsStore = create<ProtocolTabsStore>()(
  persist(
    (set) => ({
      openProtocols: [],
      activeProtocolId: null,
      openProtocol: (protocol) =>
        set((state) => {
          const existing = state.openProtocols.find((item) => item.id === protocol.id);
          if (existing) {
            return { activeProtocolId: protocol.id };
          }
          return {
            openProtocols: [...state.openProtocols, protocol],
            activeProtocolId: protocol.id,
          };
        }),
      closeProtocol: (id) =>
        set((state) => {
          const nextTabs = state.openProtocols.filter((item) => item.id !== id);
          return {
            openProtocols: nextTabs,
            activeProtocolId:
              state.activeProtocolId === id
                ? nextTabs.length > 0
                  ? nextTabs[nextTabs.length - 1].id
                  : null
                : state.activeProtocolId,
          };
        }),
      setActiveProtocol: (id) => set({ activeProtocolId: id }),
      clear: () => set({ openProtocols: [], activeProtocolId: null }),
    }),
    {
      name: "radassist-tabs",
    }
  )
);
