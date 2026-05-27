import { Address, Hex } from "viem";

export type StickerId =
  | "alien"
  | "angel"
  | "brain-blowing"
  | "celebration"
  | "clown"
  | "cry"
  | "death"
  | "demon"
  | "fight"
  | "fries"
  | "gun"
  | "hi"
  | "hot"
  | "idk"
  | "laugh"
  | "logo"
  | "love"
  | "no"
  | "puke"
  | "shining"
  | "sky"
  | "thief"
  | "tired"
  | "yes";

export type GroupPayloadMeta = {
  id: string;
  name: string;
  members: Address[];
};

type MessagePayloadMeta = {
  group?: GroupPayloadMeta;
};

export type MessagePayload = MessagePayloadMeta &
  (
    | {
        version: 1;
        type: "text";
        text: string;
        stickerId?: never;
      }
    | {
        version: 1;
        type: "sticker";
        stickerId: StickerId;
        text?: never;
      }
    | {
        version: 1;
        type: "mixed";
        text: string;
        stickerId: StickerId;
      }
  );

export type ChainMessage = {
  id: bigint;
  sender: Address;
  recipient: Address;
  sentAt: number;
  keyPartA: Hex;
  keyPartB: Hex;
  encryptedBody: Hex;
  iv: Hex;
  bodyHash: Hex;
  txHash: Hex;
  blockNumber: bigint;
  isPublic?: boolean;
};

export type CachedMessage = ChainMessage & {
  decryptedAt?: number;
  payload?: MessagePayload;
  decryptError?: string;
};
