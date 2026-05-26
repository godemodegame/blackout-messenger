import { openDB, DBSchema } from "idb";
import { Address } from "viem";
import { CachedMessage } from "../types/messages";

type BlackoutDb = DBSchema & {
  messages: {
    key: string;
    value: CachedMessage & {
      localKey: string;
      account: Address;
      peer: Address;
    };
    indexes: {
      "by-account-peer": [Address, Address];
      "by-account": Address;
    };
  };
};

const dbPromise = openDB<BlackoutDb>("blackout-messenger", 1, {
  upgrade(db) {
    const messageStore = db.createObjectStore("messages", {
      keyPath: "localKey",
    });
    messageStore.createIndex("by-account-peer", ["account", "peer"]);
    messageStore.createIndex("by-account", "account");
  },
});

function localKey(account: Address, message: CachedMessage) {
  return `${account.toLowerCase()}:${message.id.toString()}`;
}

function peerFor(account: Address, message: CachedMessage) {
  return (message.sender.toLowerCase() === account.toLowerCase()
    ? message.recipient
    : message.sender) as Address;
}

export async function saveMessages(account: Address, messages: CachedMessage[]) {
  const db = await dbPromise;
  const tx = db.transaction("messages", "readwrite");

  await Promise.all(
    messages.map((message) =>
      tx.store.put({
        ...message,
        localKey: localKey(account, message),
        account,
        peer: peerFor(account, message),
      }),
    ),
  );
  await tx.done;
}

export async function getCachedMessages(account: Address, peer?: Address) {
  const db = await dbPromise;
  const records = peer
    ? await db.getAllFromIndex("messages", "by-account-peer", [account, peer])
    : await db.getAllFromIndex("messages", "by-account", account);

  return records
    .map(({ localKey: _localKey, account: _account, peer: _peer, ...message }) => message)
    .sort((left, right) => Number(left.id - right.id));
}

export async function clearCachedMessages(account: Address) {
  const db = await dbPromise;
  const tx = db.transaction("messages", "readwrite");
  const keys = await tx.store.index("by-account").getAllKeys(account);
  await Promise.all(keys.map((key) => tx.store.delete(key)));
  await tx.done;
}
