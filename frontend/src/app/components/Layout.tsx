import { Outlet } from "react-router";
import { Sidebar } from "./Sidebar";
import { ProtocolTabs } from "./ProtocolTabs";
import { useProtocolTabsStore } from "../store/protocolTabsStore";

export function Layout() {
  const openProtocols = useProtocolTabsStore((state) => state.openProtocols);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {openProtocols.length > 0 && <ProtocolTabs />}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
