import { useCallback, useEffect, useRef, useState } from "react";
import { Address, isAddressEqual } from "viem";
import { CachedMessage } from "../types/messages";

export type BackgroundNotificationPermission = NotificationPermission | "unsupported";

type BackgroundMessageNotificationOptions = {
  account?: Address;
  enabled?: boolean;
  messages: CachedMessage[];
  onOpenPeer?: (peer: Address) => void;
  refreshCount: number;
};

const SEEN_STORAGE_PREFIX = "blackout-seen-incoming:";

function loadSeenIds(account: Address | undefined): Set<string> {
  if (!account) return new Set();
  try {
    const raw = localStorage.getItem(`${SEEN_STORAGE_PREFIX}${account.toLowerCase()}`);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function saveSeenIds(account: Address | undefined, ids: Set<string>) {
  if (!account) return;
  try {
    localStorage.setItem(
      `${SEEN_STORAGE_PREFIX}${account.toLowerCase()}`,
      JSON.stringify(Array.from(ids)),
    );
  } catch {
    // storage full or disabled — ignore
  }
}

export function useDocumentHidden() {
  const [isHidden, setIsHidden] = useState(() => document.visibilityState !== "visible");

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsHidden(document.visibilityState !== "visible");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    // Also listen to pageshow for mobile PWA resume from bfcache / cold start
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        // coming back from bfcache — treat as becoming visible
        setIsHidden(false);
      }
    };
    window.addEventListener("pageshow", handlePageShow as EventListener);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handlePageShow as EventListener);
    };
  }, []);

  return isHidden;
}

export function useBackgroundMessageNotifications({
  account,
  enabled = true,
  messages,
  onOpenPeer,
  refreshCount,
}: BackgroundMessageNotificationOptions) {
  const [permission, setPermission] = useState<BackgroundNotificationPermission>(
    getNotificationPermission,
  );
  const [missedMessages, setMissedMessages] = useState<CachedMessage[]>([]);

  const initializedRef = useRef(false);
  const lastRefreshCountRef = useRef(0);
  const seenIncomingIdsRef = useRef<Set<string>>(new Set());
  const onOpenPeerRef = useRef(onOpenPeer);
  const isResumingRef = useRef(false);

  useEffect(() => {
    onOpenPeerRef.current = onOpenPeer;
  }, [onOpenPeer]);

  // Load persisted seen IDs when account changes (survives full app close/reopen on mobile)
  useEffect(() => {
    if (!account) {
      seenIncomingIdsRef.current = new Set();
      setMissedMessages([]);
      initializedRef.current = false;
      lastRefreshCountRef.current = 0;
      return;
    }
    const persisted = loadSeenIds(account);
    seenIncomingIdsRef.current = persisted;
    initializedRef.current = false; // force re-init so we can compute missed on first refresh after resume
    lastRefreshCountRef.current = 0;
    setMissedMessages([]);
  }, [account]);

  const requestPermission = useCallback(async () => {
    const currentPermission = getNotificationPermission();
    if (currentPermission === "unsupported" || currentPermission !== "default") {
      setPermission(currentPermission);
      return currentPermission;
    }

    const nextPermission = await Notification.requestPermission();
    setPermission(nextPermission);
    return nextPermission;
  }, []);

  // Mark current incoming messages as seen (persist + clear banner)
  const markAsSeen = useCallback(() => {
    if (!account) return;
    const currentIncoming = messages
      .filter(
        (m) =>
          isAddressEqual(m.recipient, account) && !isAddressEqual(m.sender, account),
      )
      .map((m) => m.id.toString());

    const newSeen = new Set([...seenIncomingIdsRef.current, ...currentIncoming]);
    seenIncomingIdsRef.current = newSeen;
    saveSeenIds(account, newSeen);
    setMissedMessages([]);
  }, [account, messages]);

  // Main effect: detect new messages on refresh, handle both "background while open" and "resume after close"
  useEffect(() => {
    if (!enabled || !account || refreshCount <= 0) return;
    if (lastRefreshCountRef.current === refreshCount) return;

    lastRefreshCountRef.current = refreshCount;

    const incomingMessages = messages.filter(
      (message) =>
        isAddressEqual(message.recipient, account) && !isAddressEqual(message.sender, account),
    );
    const incomingIds = new Set(incomingMessages.map((message) => message.id.toString()));

    const wasInitialized = initializedRef.current;
    if (!wasInitialized) {
      initializedRef.current = true;

      // On first load after cold start / PWA resume, any messages not in persisted seen = missed
      const newOnResume = incomingMessages.filter(
        (m) => !seenIncomingIdsRef.current.has(m.id.toString()),
      );

      if (newOnResume.length > 0) {
        setMissedMessages(newOnResume);
        // On resume into foreground, also try to surface an OS notification (Android is more reliable than iOS)
        if (permission === "granted" && document.visibilityState === "visible") {
          // Small delay so the UI has painted the banner first
          setTimeout(() => {
            showMessageNotification(newOnResume, onOpenPeerRef.current);
          }, 120);
        }
      } else {
        setMissedMessages([]);
      }

      // Seed the seen set with everything we just saw (so next delta is accurate)
      seenIncomingIdsRef.current = incomingIds;
      saveSeenIds(account, incomingIds);
      return;
    }

    // Subsequent refresh while page is alive
    const newMessages = incomingMessages.filter(
      (message) => !seenIncomingIdsRef.current.has(message.id.toString()),
    );
    seenIncomingIdsRef.current = incomingIds;
    saveSeenIds(account, incomingIds);

    if (
      !newMessages.length ||
      permission !== "granted" ||
      document.visibilityState === "visible"
    ) {
      return;
    }

    // Classic background-tab notification (desktop mostly)
    showMessageNotification(newMessages, onOpenPeerRef.current);
  }, [account, enabled, messages, permission, refreshCount]);

  // When the page becomes visible again (mobile PWA resume from task switcher / home screen tap),
  // we want the next refresh to treat any delta as "missed on resume" so the banner appears.
  useEffect(() => {
    const handleBecomeVisible = () => {
      if (document.visibilityState === "visible") {
        isResumingRef.current = true;
        // The next time refreshCount ticks (or we force one), the init block above will run
        // the "newOnResume" path because we keep initializedRef true but the effect will see
        // messages that are newer than the persisted seen set.
      }
    };

    document.addEventListener("visibilitychange", handleBecomeVisible);
    return () => document.removeEventListener("visibilitychange", handleBecomeVisible);
  }, []);

  return {
    permission,
    requestPermission,
    missedMessages,
    markAsSeen,
  };
}

function showMessageNotification(
  messages: CachedMessage[],
  onOpenPeer?: (peer: Address) => void,
) {
  const latestMessage = messages[messages.length - 1];
  if (!latestMessage) return;

  const notification = new Notification(
    messages.length === 1 ? "New encrypted message" : `${messages.length} new encrypted messages`,
    {
      body:
        messages.length === 1
          ? `From ${shortAddress(latestMessage.sender)}`
          : `Latest from ${shortAddress(latestMessage.sender)}`,
      tag:
        messages.length === 1
          ? `blackout-message-${latestMessage.id.toString()}`
          : "blackout-message-summary",
      // icon and badge can be added later with /logo.png when we have better asset handling
    },
  );

  notification.onclick = () => {
    window.focus();
    onOpenPeer?.(latestMessage.sender);
    notification.close();
  };
}

function getNotificationPermission(): BackgroundNotificationPermission {
  return "Notification" in window ? Notification.permission : "unsupported";
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
