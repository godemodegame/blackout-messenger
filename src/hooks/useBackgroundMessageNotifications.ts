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

export function useDocumentHidden() {
  const [isHidden, setIsHidden] = useState(() => document.visibilityState !== "visible");

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsHidden(document.visibilityState !== "visible");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
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
  const initializedRef = useRef(false);
  const lastRefreshCountRef = useRef(0);
  const seenIncomingIdsRef = useRef<Set<string>>(new Set());
  const onOpenPeerRef = useRef(onOpenPeer);

  useEffect(() => {
    onOpenPeerRef.current = onOpenPeer;
  }, [onOpenPeer]);

  useEffect(() => {
    initializedRef.current = false;
    lastRefreshCountRef.current = 0;
    seenIncomingIdsRef.current = new Set();
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

  useEffect(() => {
    if (!enabled || !account || refreshCount <= 0) return;
    if (lastRefreshCountRef.current === refreshCount) return;

    lastRefreshCountRef.current = refreshCount;

    const incomingMessages = messages.filter(
      (message) =>
        isAddressEqual(message.recipient, account) && !isAddressEqual(message.sender, account),
    );
    const incomingIds = new Set(incomingMessages.map((message) => message.id.toString()));

    if (!initializedRef.current) {
      initializedRef.current = true;
      seenIncomingIdsRef.current = incomingIds;
      return;
    }

    const newMessages = incomingMessages.filter(
      (message) => !seenIncomingIdsRef.current.has(message.id.toString()),
    );
    seenIncomingIdsRef.current = incomingIds;

    if (
      !newMessages.length ||
      permission !== "granted" ||
      document.visibilityState === "visible"
    ) {
      return;
    }

    showMessageNotification(newMessages, onOpenPeerRef.current);
  }, [account, enabled, messages, permission, refreshCount]);

  return {
    permission,
    requestPermission,
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
