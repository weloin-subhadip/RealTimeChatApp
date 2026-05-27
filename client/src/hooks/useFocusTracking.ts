import { useEffect } from "react";
import { emitFocus } from "../socket/socket";
import { useUnreadStore } from "../store/unreadStore";

/**
 * Reports the user's "focus" to the server: the active conversation when the
 * tab is visible, or none when it's hidden. Focusing a conversation also clears
 * its local unread badge. Re-runs on conversation change and tab show/hide.
 */
export function useFocusTracking(activeId: string | null): void {
  useEffect(() => {
    function apply() {
      const focused = document.hidden ? null : activeId;
      emitFocus(focused);
      if (focused) useUnreadStore.getState().reset(focused);
    }
    apply();
    document.addEventListener("visibilitychange", apply);
    return () => document.removeEventListener("visibilitychange", apply);
  }, [activeId]);
}
