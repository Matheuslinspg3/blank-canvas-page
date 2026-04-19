import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ConversationList } from "./ConversationList";
import { MessageThread } from "./MessageThread";
import { LeadSummaryPanel } from "./LeadSummaryPanel";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export function InboxLayout() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const isMobile = useIsMobile();

  // Mobile: 1 painel por vez (lista OU thread)
  if (isMobile) {
    if (!activeId) {
      return (
        <div className="h-[calc(100vh-4rem)] p-2">
          <Card className="h-full overflow-hidden">
            <ConversationList activeId={activeId} onSelect={setActiveId} />
          </Card>
        </div>
      );
    }
    return (
      <div className="h-[calc(100vh-4rem)] p-2 flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => setActiveId(null)}
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Conversas
        </Button>
        <Card className="flex-1 overflow-hidden">
          <MessageThread conversationId={activeId} />
        </Card>
      </div>
    );
  }

  // Desktop: 3 painéis (lista | thread | lead) com fallback 2 painéis se estreito
  return (
    <div className="h-[calc(100vh-4rem)] p-3 flex gap-3">
      <Card className="w-[320px] shrink-0 overflow-hidden">
        <ConversationList activeId={activeId} onSelect={setActiveId} />
      </Card>
      <Card className="flex-1 min-w-0 overflow-hidden">
        <MessageThread
          conversationId={activeId}
          onToggleRightPanel={() => setShowRightPanel((v) => !v)}
          rightPanelOpen={showRightPanel}
        />
      </Card>
      {showRightPanel && (
        <Card className="w-[320px] shrink-0 overflow-hidden hidden xl:block">
          <LeadSummaryPanel conversationId={activeId} />
        </Card>
      )}
    </div>
  );
}
