import { useCallback, useEffect, useState } from "react";
import { supabase, type LobbyMessageRow } from "../lib/supabase";
import type { MessagePayload, CachedMessage } from "../types/messages";
import { Address } from "viem";

export type PublicLobbyMessage = CachedMessage & {
  sender: Address;
  payload: MessagePayload;
};

type UsePublicLobbyResult = {
  messages: PublicLobbyMessage[];
  loading: boolean;
  error: string | null;
  sendMessage: (payload: MessagePayload) => Promise<void>;
  sending: boolean;
  refresh: () => Promise<void>;
};

const TABLE = "lobby_messages";

function rowToMessage(row: LobbyMessageRow): PublicLobbyMessage {
  return {
    id: BigInt(0), // not on-chain
    sender: row.sender as Address,
    recipient: "0x0000000000000000000000000000000000000000" as Address,
    sentAt: Math.floor(new Date(row.created_at).getTime() / 1000),
    keyPartA: "0x",
    keyPartB: "0x",
    encryptedBody: "0x",
    iv: "0x",
    bodyHash: "0x",
    txHash: "0x",
    blockNumber: BigInt(0),
    isPublic: true,
    payload: row.payload as MessagePayload,
    decryptedAt: Date.now(),
  };
}

export function usePublicLobby(account?: Address): UsePublicLobbyResult {
  const [messages, setMessages] = useState<PublicLobbyMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from(TABLE)
      .select("id, sender, payload, created_at")
      .order("created_at", { ascending: true })
      .limit(500);

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    const mapped = (data ?? []).map(rowToMessage);
    setMessages(mapped);
    setLoading(false);
  }, []);

  // Initial load
  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("lobby-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: TABLE,
        },
        (payload) => {
          const newRow = payload.new as LobbyMessageRow;
          const newMsg = rowToMessage(newRow);

          setMessages((prev) => {
            // avoid duplicates
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // connected
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const sendMessage = useCallback(
    async (payload: MessagePayload) => {
      if (!account) {
        throw new Error("Connect a wallet first.");
      }

      setSending(true);
      setError(null);

      try {
        const { error: insertError } = await supabase.from(TABLE).insert({
          sender: account.toLowerCase(),
          payload,
        });

        if (insertError) {
          throw new Error(insertError.message);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to send.";
        setError(message);
        throw err;
      } finally {
        setSending(false);
      }
    },
    [account],
  );

  const refresh = useCallback(async () => {
    await loadMessages();
  }, [loadMessages]);

  return {
    messages,
    loading,
    error,
    sendMessage,
    sending,
    refresh,
  };
}
