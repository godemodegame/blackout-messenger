import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TASK_MANAGER_ADDRESS } from "@cofhe/sdk";
import { useActiveWallet, useSendTransaction } from "@privy-io/react-auth";
import {
  Address,
  Hex,
  PublicClient,
  WalletClient,
  encodeFunctionData,
  isAddress,
  isAddressEqual,
  keccak256,
  stringToHex,
} from "viem";
import { usePublicClient, useWalletClient } from "wagmi";
import { appChain } from "../config/chains";
import { env } from "../config/env";
import { blackoutMessengerAbi } from "../contracts/blackoutMessengerAbi";
import { fetchMailboxMessages } from "../lib/chainMessages";
import {
  decryptKeyPart,
  encryptKeyParts,
  ensureCofhePermit,
  type CofhePermit,
} from "../lib/cofheClient";
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
type SendTransaction = ReturnType<typeof useSendTransaction>["sendTransaction"];
type ActiveWallet = ReturnType<typeof useActiveWallet>["wallet"];
type MailboxOptions = {
  publicOnly?: boolean;
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

export function useMailbox(
  account?: Address,
  peer?: Address,
  cofheReady = false,
  options: MailboxOptions = {},
) {
  const publicClient = usePublicClient({ chainId: appChain.id });
  const { data: walletClient } = useWalletClient({ chainId: appChain.id });
  const { wallet: activeWallet } = useActiveWallet();
  const { sendTransaction } = useSendTransaction();
  const [messages, setMessages] = useState<CachedMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendState, setSendState] = useState<SendState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const sendingRef = useRef(false);
  const publicOnly = options.publicOnly ?? false;

  const activePeer = useMemo(() => {
    if (!peer || !isAddress(peer)) return undefined;
    return peer as Address;
  }, [peer]);

  const loadCached = useCallback(async () => {
    if (!account) return;
    const cached = await getCachedMessages(account, activePeer);
    setMessages(publicOnly ? cached.filter((message) => message.isPublic) : cached);
  }, [account, activePeer, publicOnly]);

  const refresh = useCallback(async () => {
    if (!account || !publicClient) return;
    setLoading(true);
    setError(null);

    try {
      const chainMessages = await fetchMailboxMessages(
        publicClient,
        account,
        activePeer,
        publicOnly,
      );
      const cached = await getCachedMessages(account, activePeer);
      const cachedMessages = publicOnly
        ? cached.filter((message) => message.isPublic)
        : cached;
      const cachedById = new Map(
        cachedMessages.map((message) => [message.id.toString(), message]),
      );
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
  }, [account, activePeer, publicClient, publicOnly]);

  const decryptMessage = useCallback(
    async (messageId: bigint) => {
      if (!account || !cofheReady || !publicClient) return;
      const target = messages.find((message) => message.id === messageId);
      if (!target) return;

      try {
        const clearedMessages = messages.map((message) =>
          message.id === messageId ? { ...message, decryptError: undefined } : message,
        );
        setMessages(clearedMessages);
        await saveMessages(account, clearedMessages);
        const permitAccount = walletClient?.account?.address;
        const permit = await ensureCofhePermit(permitAccount);
        await ensureDecryptorAllowed({
          account,
          decryptor: permit.issuer as Address,
          handles: [target.keyPartA, target.keyPartB],
          publicClient,
          sendTransaction,
          walletClient,
          activeWallet,
        });
        const [keyPartA, keyPartB] = await Promise.all([
          decryptKeyPartWithRetry(target.keyPartA, permit),
          decryptKeyPartWithRetry(target.keyPartB, permit),
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
    [
      account,
      activeWallet,
      cofheReady,
      messages,
      publicClient,
      sendTransaction,
      walletClient,
    ],
  );

  const sendMessage = useCallback(
    async (recipient: Address, payload: MessagePayload) => {
      if (sendingRef.current) {
        throw new Error("A send is already preparing. Wait for the wallet prompt.");
      }
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
      sendingRef.current = true;

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
        const { hash: txHash } = await sendTransactionWithSponsorFallback(
          sendTransaction,
          {
            to: env.contractAddress,
            data,
            chainId: appChain.id,
          },
          account,
          walletClient,
          activeWallet,
        );

        setSendState("confirming");
        await publicClient.waitForTransactionReceipt({ hash: txHash });
        setSendState("done");
        await refresh();
      } catch (sendError) {
        setSendState("error");
        const message =
          sendError instanceof Error ? formatSendError(sendError.message) : "Send failed.";
        setError(message);
        throw new Error(message);
      } finally {
        sendingRef.current = false;
      }
    },
    [
      account,
      cofheReady,
      publicClient,
      refresh,
      sendTransaction,
      walletClient,
      activeWallet,
    ],
  );

  const sendPublicMessage = useCallback(
    async (payload: MessagePayload) => {
      if (sendingRef.current) {
        throw new Error("A send is already preparing. Wait for the wallet prompt.");
      }
      if (!account || !publicClient) {
        throw new Error("Connect before sending.");
      }
      if (!env.hasContractAddress) {
        throw new Error("Set VITE_BLACKOUT_CONTRACT_ADDRESS first.");
      }

      setSendState("submitting");
      setError(null);
      sendingRef.current = true;

      try {
        const body = stringToHex(JSON.stringify(payload));
        const data = encodeFunctionData({
          abi: blackoutMessengerAbi,
          functionName: "sendPublicMessage",
          args: [body, keccak256(body)],
        });
        const { hash: txHash } = await sendTransactionWithSponsorFallback(
          sendTransaction,
          {
            to: env.contractAddress,
            data,
            chainId: appChain.id,
          },
          account,
          walletClient,
          activeWallet,
        );

        setSendState("confirming");
        await publicClient.waitForTransactionReceipt({ hash: txHash });
        setSendState("done");
        await refresh();
      } catch (sendError) {
        setSendState("error");
        const message =
          sendError instanceof Error ? formatSendError(sendError.message) : "Send failed.";
        setError(message);
        throw new Error(message);
      } finally {
        sendingRef.current = false;
      }
    },
    [account, publicClient, refresh, sendTransaction, walletClient, activeWallet],
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
    sendPublicMessage,
    decryptMessage,
  };
}

async function ensureDecryptorAllowed({
  account,
  decryptor,
  handles,
  publicClient,
  sendTransaction,
  walletClient,
  activeWallet,
}: {
  account: Address;
  decryptor: Address;
  handles: [Hex, Hex];
  publicClient: PublicClient;
  sendTransaction: SendTransaction;
  walletClient?: WalletClient;
  activeWallet?: ActiveWallet;
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
    const { hash } = await sendTransactionWithSponsorFallback(
      sendTransaction,
      {
        to: TASK_MANAGER_ADDRESS,
        data,
        chainId: appChain.id,
      },
      account,
      walletClient,
      activeWallet,
    );

    await publicClient.waitForTransactionReceipt({ hash });
  }
}

async function sendTransactionWithSponsorFallback(
  sendTransaction: SendTransaction,
  request: Parameters<SendTransaction>[0],
  account: Address,
  walletClient?: WalletClient,
  activeWallet?: ActiveWallet,
) {
  if (!isEmbeddedWalletForAccount(activeWallet, account)) {
    return sendWithConnectedWalletClient(walletClient, request, account);
  }

  try {
    return await sendTransaction(request, {
      address: account,
      sponsor: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("Cannot sponsor transactions for externally connected wallet")) {
      throw error;
    }

    return sendTransaction(request, {
      address: account,
    });
  }
}

async function sendWithConnectedWalletClient(
  walletClient: WalletClient | undefined,
  request: Parameters<SendTransaction>[0],
  account: Address,
) {
  if (!walletClient?.account) {
    throw new Error("Connected wallet is not ready yet. Reconnect MetaMask and try again.");
  }
  if (!isAddressEqual(walletClient.account.address, account)) {
    throw new Error("Connected wallet does not match the selected account.");
  }
  if (!request.to || !isAddress(request.to)) {
    throw new Error("Transaction target is not a valid address.");
  }

  const hash = await walletClient.sendTransaction({
    account: walletClient.account,
    chain: appChain,
    to: request.to,
    data: request.data as Hex | undefined,
    value: request.value === undefined ? undefined : BigInt(request.value),
  });

  return { hash };
}

function isEmbeddedWalletForAccount(activeWallet: ActiveWallet | undefined, account: Address) {
  return (
    activeWallet?.type === "ethereum" &&
    isAddressEqual(activeWallet.address as Address, account) &&
    (activeWallet.connectorType === "embedded" ||
      activeWallet.connectorType === "embedded_imported")
  );
}

function formatDecryptError(message: string) {
  if (message.includes("sealOutput request failed: HTTP 500")) {
    return "Fhenix could not seal this key yet after a few retries. Try decrypt again shortly. (HTTP 500)";
  }

  return message;
}

async function decryptKeyPartWithRetry(handle: bigint | string, permit?: CofhePermit) {
  const retryDelays = [1_500, 3_000, 5_000];
  let lastError: unknown;

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      return await decryptKeyPart(handle, permit);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);

      if (!isRetryableSealError(message) || attempt === retryDelays.length) {
        throw error;
      }

      await wait(retryDelays[attempt]);
    }
  }

  throw lastError;
}

function isRetryableSealError(message: string) {
  return message.includes("sealOutput request failed: HTTP 500");
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function formatSendError(message: string) {
  if (message.includes("ZK proof verification failed") && message.includes("Failed to fetch")) {
    return "Fhenix ZK verifier could not be reached. Check connection and try sending again.";
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
