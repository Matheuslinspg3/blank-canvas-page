import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[9999] bg-destructive text-destructive-foreground text-center py-2 text-sm flex items-center justify-center gap-2 shadow-md animate-in slide-in-from-top-2">
      <WifiOff className="h-4 w-4" />
      Sem conexão — suas alterações serão salvas quando reconectar
    </div>
  );
}
