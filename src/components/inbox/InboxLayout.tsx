import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ConversationList } from "./ConversationList";
import { MessageThread } from "./MessageThread";
import { LeadSummaryPanel } from "./LeadSummaryPanel";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useInboxRealtime } from "@/hooks/omnichannel/useInboxRealtime";

export function InboxLayout() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const isMobile = useIsMobile();
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  const { realtimeConnected, threadRealtimeConnected } = useInboxRealtime({
    orgId,
    activeConversationId: activeId,
  });

  // Mobile: 1 painel por vez (lista OU thread)
  if (isMobile) {
    if (!activeId) {
      return (
        <div className="h-[calc(100vh-4rem)] p-2">
          <Card className="h-full overflow-hidden">
            <ConversationList
              activeId={activeId}
              onSelect={setActiveId}
              realtimeConnected={realtimeConnected}
            />
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
          <MessageThread
            conversationId={activeId}
            realtimeConnected={threadRealtimeConnected}
          />
        </Card>
      </div>
    );
  }

  // Desktop: 3 painéis (lista | thread | lead)
  return (
    <div className="h-[calc(100vh-4rem)] p-3 flex gap-3">
      <Card className="w-[320px] shrink-0 overflow-hidden">
        <ConversationList
          activeId={activeId}
          onSelect={setActiveId}
          realtimeConnected={realtimeConnected}
        />
      </Card>
      <Card className="flex-1 min-w-0 overflow-hidden">
        <MessageThread
          conversationId={activeId}
          realtimeConnected={threadRealtimeConnected}
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
