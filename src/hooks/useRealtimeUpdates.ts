import { useEffect } from "react";

export function useRealtimeUpdates(onEmailReceived: () => void) {
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(
        `${protocol}//${window.location.host}/api/notifications/stream`,
      );

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);
          if (data.type === "email_received") {
            onEmailReceived();
          }
        } catch {}
      };

      ws.onclose = () => {
        if (!stopped) {
          reconnectTimeout = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => ws?.close();
    }

    connect();

    return () => {
      stopped = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      ws?.close();
    };
  }, []);
}
