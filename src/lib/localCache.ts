import { openDB, DBSchema } from "idb";
import { Address } from "viem";
import { CachedMessage } from "../types/messages";

const PUBLIC_PEER = "0x0000000000000000000000000000000000000000" as Address;

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

const dbPromise = openDB<BlackoutDb>("blackout-messenger", 2, {
  async upgrade(db, oldVersion, _newVersion, tx) {
    const messageStore =
      oldVersion < 1
        ? db.createObjectStore("messages", {
            keyPath: "localKey",
          })
        : tx.objectStore("messages");

    if (oldVersion < 1) {
      messageStore.createIndex("by-account-peer", ["account", "peer"]);
      messageStore.createIndex("by-account", "account");
    }

    if (oldVersion < 2) {
      const records = await messageStore.getAll();
      await Promise.all(
        records.map((record) => {
          const normalizedAccount = normalizeAddress(record.account);
          const normalizedPeer = normalizeAddress(record.peer);
          const normalizedLocalKey = `${normalizedAccount}:${record.id.toString()}`;

          const putRecord = messageStore.put({
            ...record,
            localKey: normalizedLocalKey,
            account: normalizedAccount,
            peer: normalizedPeer,
          });

          return record.localKey === normalizedLocalKey
            ? putRecord
            : Promise.all([messageStore.delete(record.localKey), putRecord]);
        }),
      );
    }
  },
});

function localKey(account: Address, message: CachedMessage) {
  return `${normalizeAddress(account)}:${message.id.toString()}`;
}

function peerFor(account: Address, message: CachedMessage) {
  if (message.isPublic) return PUBLIC_PEER;

  return (normalizeAddress(message.sender) === normalizeAddress(account)
    ? message.recipient
    : message.sender) as Address;
}

function normalizeAddress(address: Address) {
  return address.toLowerCase() as Address;
}

export async function saveMessages(account: Address, messages: CachedMessage[]) {
  const db = await dbPromise;
  const tx = db.transaction("messages", "readwrite");

  await Promise.all(
    messages.map((message) =>
      tx.store.put({
        ...message,
        localKey: localKey(account, message),
        account: normalizeAddress(account),
        peer: normalizeAddress(peerFor(account, message)),
      }),
    ),
  );
  await tx.done;
}

export async function getCachedMessages(account: Address, peer?: Address) {
  const db = await dbPromise;
  const normalizedAccount = normalizeAddress(account);
  const records = peer
    ? await db.getAllFromIndex("messages", "by-account-peer", [
        normalizedAccount,
        normalizeAddress(peer),
      ])
    : await db.getAllFromIndex("messages", "by-account", normalizedAccount);

  return records
    .map(({ localKey: _localKey, account: _account, peer: _peer, ...message }) => message)
    .sort((left, right) => Number(left.id - right.id));
}
