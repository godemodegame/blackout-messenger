import {
  Address,
  Hex,
  PublicClient,
  decodeEventLog,
  getAddress,
} from "viem";
import { env } from "../config/env";
import { blackoutMessengerAbi } from "../contracts/blackoutMessengerAbi";
import { CachedMessage, ChainMessage, MessagePayload } from "../types/messages";
import { hexToBytes } from "./bytes";

const messageSentAbiItem = blackoutMessengerAbi.find(
  (item) => item.type === "event" && item.name === "MessageSent",
);
const publicMessageSentAbiItem = blackoutMessengerAbi.find(
  (item) => item.type === "event" && item.name === "PublicMessageSent",
);
const LOG_CHUNK_SIZE = 1_900n;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;
const ZERO_HEX_32 = `0x${"0".repeat(64)}` as Hex;
const ZERO_IV = `0x${"0".repeat(24)}` as Hex;
const decoder = new TextDecoder();

if (!messageSentAbiItem || !publicMessageSentAbiItem) {
  throw new Error("Blackout message ABI item missing.");
}

type MessageSentArgs = {
  messageId: bigint;
  sender: Address;
  recipient: Address;
  sentAt: bigint;
  keyPartA: Hex;
  keyPartB: Hex;
  encryptedBody: Hex;
  iv: Hex;
  bodyHash: Hex;
};

type PublicMessageSentArgs = {
  messageId: bigint;
  sender: Address;
  sentAt: bigint;
  body: Hex;
  bodyHash: Hex;
};

function decodeMessageLog(log: Awaited<ReturnType<PublicClient["getLogs"]>>[number]): ChainMessage {
  const decoded = decodeEventLog({
    abi: blackoutMessengerAbi,
    data: log.data,
    topics: log.topics,
  });
  const args = decoded.args as unknown as MessageSentArgs;

  return {
    id: args.messageId,
    sender: getAddress(args.sender),
    recipient: getAddress(args.recipient),
    sentAt: Number(args.sentAt),
    keyPartA: args.keyPartA,
    keyPartB: args.keyPartB,
    encryptedBody: args.encryptedBody,
    iv: args.iv,
    bodyHash: args.bodyHash,
    txHash: log.transactionHash!,
    blockNumber: log.blockNumber!,
  };
}

function decodePublicMessageLog(
  log: Awaited<ReturnType<PublicClient["getLogs"]>>[number],
): CachedMessage {
  const decoded = decodeEventLog({
    abi: blackoutMessengerAbi,
    data: log.data,
    topics: log.topics,
  });
  const args = decoded.args as unknown as PublicMessageSentArgs;

  return {
    id: args.messageId,
    sender: getAddress(args.sender),
    recipient: ZERO_ADDRESS,
    sentAt: Number(args.sentAt),
    keyPartA: ZERO_HEX_32,
    keyPartB: ZERO_HEX_32,
    encryptedBody: args.body,
    iv: ZERO_IV,
    bodyHash: args.bodyHash,
    txHash: log.transactionHash!,
    blockNumber: log.blockNumber!,
    isPublic: true,
    payload: parsePublicPayload(args.body),
    decryptedAt: Number(args.sentAt) * 1000,
  };
}

function parsePublicPayload(body: Hex): MessagePayload {
  const text = decoder.decode(hexToBytes(body));

  try {
    const parsed = JSON.parse(text) as MessagePayload;
    if (parsed.version === 1 && parsed.type) return parsed;
  } catch {
    // Fall through to displaying the raw plaintext from older or external clients.
  }

  return {
    version: 1,
    type: "text",
    text,
  };
}

export async function fetchMailboxMessages(
  publicClient: PublicClient,
  account: Address,
  peer?: Address,
): Promise<CachedMessage[]> {
  if (!env.hasContractAddress) return [];

  const latestBlock = await publicClient.getBlockNumber();
  const [incoming, outgoing, publicMessages] = peer
    ? await Promise.all([
        getMessageLogs(publicClient, latestBlock, {
          address: env.contractAddress,
          event: messageSentAbiItem,
          args: {
            sender: peer,
            recipient: account,
          },
        }),
        getMessageLogs(publicClient, latestBlock, {
          address: env.contractAddress,
          event: messageSentAbiItem,
          args: {
            sender: account,
            recipient: peer,
          },
        }),
        Promise.resolve([]),
      ])
    : await Promise.all([
        getMessageLogs(publicClient, latestBlock, {
          address: env.contractAddress,
          event: messageSentAbiItem,
          args: {
            recipient: account,
          },
        }),
        getMessageLogs(publicClient, latestBlock, {
          address: env.contractAddress,
          event: messageSentAbiItem,
          args: {
            sender: account,
          },
        }),
        getMessageLogs(publicClient, latestBlock, {
          address: env.contractAddress,
          event: publicMessageSentAbiItem,
        }),
      ]);

  const messagesById = new Map<string, CachedMessage>();
  [...incoming, ...outgoing]
    .map(decodeMessageLog)
    .forEach((message) => {
      messagesById.set(message.id.toString(), message);
    });
  publicMessages.map(decodePublicMessageLog).forEach((message) => {
    messagesById.set(message.id.toString(), message);
  });

  return [...messagesById.values()].sort((left, right) => Number(left.id - right.id));
}

type MessageLogFilter = Omit<
  Parameters<PublicClient["getLogs"]>[0],
  "fromBlock" | "toBlock"
>;

async function getMessageLogs(
  publicClient: PublicClient,
  latestBlock: bigint,
  filter: MessageLogFilter,
) {
  const logs: Awaited<ReturnType<PublicClient["getLogs"]>> = [];
  let fromBlock = env.deployBlock;

  while (fromBlock <= latestBlock) {
    const toBlock =
      fromBlock + LOG_CHUNK_SIZE > latestBlock
        ? latestBlock
        : fromBlock + LOG_CHUNK_SIZE;
    const chunk = await publicClient.getLogs({
      ...filter,
      fromBlock,
      toBlock,
    });

    logs.push(...chunk);
    fromBlock = toBlock + 1n;
  }

  return logs;
}
