import {
  Address,
  Hex,
  PublicClient,
  decodeEventLog,
  getAddress,
  isAddressEqual,
} from "viem";
import { env } from "../config/env";
import { blackoutMessengerAbi } from "../contracts/blackoutMessengerAbi";
import { CachedMessage, ChainMessage } from "../types/messages";

const messageSentAbiItem = blackoutMessengerAbi.find(
  (item) => item.type === "event" && item.name === "MessageSent",
);
const LOG_CHUNK_SIZE = 1_900n;

if (!messageSentAbiItem) {
  throw new Error("MessageSent ABI item missing.");
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

export async function fetchMailboxMessages(
  publicClient: PublicClient,
  account: Address,
  peer?: Address,
): Promise<CachedMessage[]> {
  if (!env.hasContractAddress) return [];

  const latestBlock = await publicClient.getBlockNumber();
  const [incoming, outgoing] = await Promise.all([
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
  ]);

  const messagesById = new Map<string, CachedMessage>();
  [...incoming, ...outgoing]
    .map(decodeMessageLog)
    .filter((message) => {
      if (!peer) return true;
      return (
        isAddressEqual(message.sender, peer) ||
        isAddressEqual(message.recipient, peer)
      );
    })
    .forEach((message) => {
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
