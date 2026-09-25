import { useEffect, useState } from "react";
import { CloudOff, Wifi } from "lucide-react";
import { toast } from "sonner";

export function NetworkStatusBanner() {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [hasBeenOffline, setHasBeenOffline] = useState(false);

  useEffect(() => {
    const offline = () => {
      setOnline(false);
      setHasBeenOffline(true);
    };
    const onlineAgain = () => {
      setOnline(true);
      if (hasBeenOffline) toast.success("Conexão restabelecida.", { icon: <Wifi className="h-4 w-4" /> });
    };
    window.addEventListener("offline", offline);
    window.addEventListener("online", onlineAgain);
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", onlineAgain);
    };
  }, [hasBeenOffline]);

  if (online) return null;
  return (
    <div role="status" aria-live="polite" className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 bg-amber-950 px-4 py-2 text-center text-xs font-semibold text-amber-50 shadow-lg">
      <CloudOff className="h-4 w-4" />
      Sem conexão. Algumas alterações podem não ser sincronizadas.
    </div>
  );
}
