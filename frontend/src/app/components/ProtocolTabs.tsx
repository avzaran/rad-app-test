import { X } from "lucide-react";
import { useNavigate } from "react-router";
import { useProtocolTabsStore } from "../store/protocolTabsStore";
import { cn } from "./ui/utils";
import { Button } from "./ui/button";

export function ProtocolTabs() {
  const navigate = useNavigate();
  const openProtocols = useProtocolTabsStore((state) => state.openProtocols);
  const activeProtocolId = useProtocolTabsStore((state) => state.activeProtocolId);
  const setActiveProtocol = useProtocolTabsStore((state) => state.setActiveProtocol);
  const closeProtocol = useProtocolTabsStore((state) => state.closeProtocol);

  if (openProtocols.length === 0) return null;

  return (
    <div className="flex items-center gap-1 border-b border-border bg-card px-4">
      {openProtocols.map((protocol) => (
        <div
          key={protocol.id}
          className={cn(
            "group flex items-center gap-2 border-b-2 px-4 py-2.5 transition-colors",
            activeProtocolId === protocol.id
              ? "border-primary bg-accent/50"
              : "border-transparent hover:bg-accent/30"
          )}
        >
          <button
            onClick={() => {
              setActiveProtocol(protocol.id);
              navigate(`/protocols/${protocol.id}`);
            }}
            className="flex-1 text-left text-sm font-medium"
          >
            {protocol.patient.name}
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              closeProtocol(protocol.id);
              if (activeProtocolId === protocol.id) {
                navigate("/protocols");
              }
            }}
            className="h-5 w-5 p-0 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}
