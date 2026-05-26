import { useCallback, useEffect, useMemo, useState } from "react";
import { TASK_MANAGER_ADDRESS } from "@cofhe/sdk";
import { useSendTransaction } from "@privy-io/react-auth";
import {
  Address,
  Hex,
  PublicClient,
  encodeFunctionData,
  isAddress,
  isAddressEqual,
} from "viem";
import { usePublicClient, useWalletClient } from "wagmi";
import { appChain } from "../config/chains";
import { env } from "../config/env";
import { blackoutMessengerAbi } from "../contracts/blackoutMessengerAbi";
import { fetchMailboxMessages } from "../lib/chainMessages";
import { decryptKeyPart, encryptKeyParts, ensureCofhePermit } from "../lib/cofheClient";
import { decryptPayload, encryptPayload } from "../lib/messageCrypto";
import { getCachedMessages, saveMessages } from "../lib/localCache";
import { CachedMessage, MessagePayload } from "../types/messages";

export type SendState = "idle" | "encrypting" | "submitting" | "confirming" | "done" | "error";

type ContractEncryptedInput = {
  ctHash: bigint;
  securityZone: number;
  utype: number;
  signature: `0x${string}`;
};

const cofheTaskManagerAbi = [
  {
    type: "function",
    name: "allow",
    stateMutability: "nonpayable",
    inputs: [
      { name: "ctHash", type: "uint256" },
      { name: "account", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "isAllowed",
    stateMutability: "view",
    inputs: [
      { name: "ctHash", type: "uint256" },
      { name: "account", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export function useMailbox(account?: Address, peer?: Address, cofheReady = false) {
  const publicClient = usePublicClient({ chainId: appChain.id });
  const { data: walletClient } = useWalletClient({ chainId: appChain.id });
  const { sendTransaction } = useSendTransaction();
  const [messages, setMessages] = useState<CachedMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendState, setSendState] = useState<SendState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  const activePeer = useMemo(() => {
    if (!peer || !isAddress(peer)) return undefined;
    return peer as Address;
  }, [peer]);

  const loadCached = useCallback(async () => {
    if (!account) return;
    const cached = await getCachedMessages(account, activePeer);
    setMessages(cached);
  }, [account, activePeer]);

  const refresh = useCallback(async () => {
    if (!account || !publicClient) return;
    setLoading(true);
    setError(null);

    try {
      const chainMessages = await fetchMailboxMessages(publicClient, account, activePeer);
      const cached = await getCachedMessages(account, activePeer);
      const cachedById = new Map(cached.map((message) => [message.id.toString(), message]));
      const merged = chainMessages.map((message) => ({
        ...message,
        ...cachedById.get(message.id.toString()),
      }));

      await saveMessages(account, merged);
      setMessages(merged);
      setRefreshCount((count) => count + 1);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error ? refreshError.message : "Could not read mailbox.",
      );
    } finally {
      setLoading(false);
    }
  }, [account, activePeer, publicClient]);

  const decryptMessage = useCallback(
    async (messageId: bigint) => {
      if (!account || !cofheReady || !publicClient) return;
      const target = messages.find((message) => message.id === messageId);
      if (!target) return;

      try {
        const permitAccount = walletClient?.account?.address;
        const permit = await ensureCofhePermit(permitAccount);
        await ensureDecryptorAllowed({
          account,
          decryptor: permit.issuer as Address,
          handles: [target.keyPartA, target.keyPartB],
          publicClient,
          sendTransaction,
        });
        const [keyPartA, keyPartB] = await Promise.all([
          decryptKeyPart(target.keyPartA, permit),
          decryptKeyPart(target.keyPartB, permit),
        ]);
        const payload = await decryptPayload(
          target.encryptedBody,
          target.iv,
          keyPartA as bigint,
          keyPartB as bigint,
        );
        const updated = messages.map((message) =>
          message.id === messageId
            ? {
                ...message,
                payload,
                decryptedAt: Date.now(),
                decryptError: undefined,
              }
            : message,
        );

        setMessages(updated);
        await saveMessages(account, updated);
      } catch (decryptError) {
        const updated = messages.map((message) =>
          message.id === messageId
            ? {
                ...message,
                decryptError:
                  decryptError instanceof Error
                    ? formatDecryptError(decryptError.message)
                    : "Could not decrypt message.",
              }
            : message,
        );
        setMessages(updated);
        await saveMessages(account, updated);
      }
    },
    [account, cofheReady, messages, publicClient, sendTransaction, walletClient?.account.address],
  );

  const sendMessage = useCallback(
    async (recipient: Address, payload: MessagePayload) => {
      if (!account || !publicClient) {
        throw new Error("Connect before sending.");
      }
      if (!env.hasContractAddress) {
        throw new Error("Set VITE_BLACKOUT_CONTRACT_ADDRESS first.");
      }
      if (!cofheReady) {
        throw new Error("Fhenix client is not ready yet.");
      }
      if (isAddressEqual(account, recipient)) {
        throw new Error("Choose a different recipient address.");
      }

      setSendState("encrypting");
      setError(null);

      try {
        const encryptedPayload = await encryptPayload(payload);
        const [encryptedPartA, encryptedPartB] = await encryptKeyParts(
          encryptedPayload.keyPartA,
          encryptedPayload.keyPartB,
        );

        setSendState("submitting");

        const data = encodeFunctionData({
          abi: blackoutMessengerAbi,
          functionName: "sendMessage",
          args: [
            recipient,
            asContractInput(encryptedPartA),
            asContractInput(encryptedPartB),
            encryptedPayload.encryptedBody,
            encryptedPayload.iv,
            encryptedPayload.bodyHash,
          ],
        });
        const { hash: txHash } = await sendTransaction(
          {
            to: env.contractAddress,
            data,
            chainId: appChain.id,
          },
          {
            address: account,
            sponsor: true,
          },
        );

        setSendState("confirming");
        await publicClient.waitForTransactionReceipt({ hash: txHash });
        setSendState("done");
        await refresh();
      } catch (sendError) {
        setSendState("error");
        const message = sendError instanceof Error ? sendError.message : "Send failed.";
        setError(message);
        throw new Error(message);
      }
    },
    [
      account,
      cofheReady,
      publicClient,
      refresh,
      sendTransaction,
    ],
  );

  useEffect(() => {
    void loadCached();
  }, [loadCached]);

  return {
    messages,
    loading,
    error,
    sendState,
    refreshCount,
    refresh,
    sendMessage,
    decryptMessage,
  };
}

async function ensureDecryptorAllowed({
  account,
  decryptor,
  handles,
  publicClient,
  sendTransaction,
}: {
  account: Address;
  decryptor: Address;
  handles: [Hex, Hex];
  publicClient: PublicClient;
  sendTransaction: ReturnType<typeof useSendTransaction>["sendTransaction"];
}) {
  if (isAddressEqual(account, decryptor)) return;

  for (const handle of handles) {
    const isAllowed = await publicClient.readContract({
      address: TASK_MANAGER_ADDRESS,
      abi: cofheTaskManagerAbi,
      functionName: "isAllowed",
      args: [BigInt(handle), decryptor],
    });

    if (isAllowed) continue;

    const data = encodeFunctionData({
      abi: cofheTaskManagerAbi,
      functionName: "allow",
      args: [BigInt(handle), decryptor],
    });
    const { hash } = await sendTransaction(
      {
        to: TASK_MANAGER_ADDRESS,
        data,
        chainId: appChain.id,
      },
      {
        address: account,
        sponsor: true,
      },
    );

    await publicClient.waitForTransactionReceipt({ hash });
  }
}

function formatDecryptError(message: string) {
  if (message.includes("sealOutput request failed: HTTP 500")) {
    return "Fhenix could not seal this key yet. Retry decrypt in a few seconds. (HTTP 500)";
  }

  return message;
}

function asContractInput(input: {
  ctHash: bigint;
  securityZone: number;
  utype: number;
  signature: string;
}): ContractEncryptedInput {
  return {
    ...input,
    signature: input.signature as `0x${string}`,
  };
}
