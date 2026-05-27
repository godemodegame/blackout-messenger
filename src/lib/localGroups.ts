import { Address, getAddress, isAddress, isAddressEqual } from "viem";

export type GroupChat = {
  id: string;
  name: string;
  members: Address[];
  createdAt: number;
  updatedAt: number;
};

function storageKey(account: Address) {
  return `blackout-groups:${account.toLowerCase()}`;
}

export function getLocalGroups(account?: Address): GroupChat[] {
  if (!account) return [];

  try {
    const raw = window.localStorage.getItem(storageKey(account));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GroupChat[];

    return parsed
      .map((group) => ({
        ...group,
        members: normalizeMembers(account, group.members),
      }))
      .filter((group) => group.id && group.name && group.members.length);
  } catch {
    return [];
  }
}

export function saveLocalGroups(account: Address, groups: GroupChat[]) {
  window.localStorage.setItem(storageKey(account), JSON.stringify(groups));
}

export function createLocalGroup(account: Address, name: string, members: Address[]): GroupChat {
  const now = Date.now();

  return {
    id: `${account.toLowerCase()}:${now}:${Math.random().toString(36).slice(2, 10)}`,
    name: name.trim() || "New group",
    members: normalizeMembers(account, members),
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeMembers(account: Address, members: Address[]) {
  const normalized: Address[] = [];

  members.forEach((member) => {
    if (!isAddress(member) || isAddressEqual(account, member)) return;

    const address = getAddress(member);
    if (!normalized.some((existing) => isAddressEqual(existing, address))) {
      normalized.push(address);
    }
  });

  return normalized;
}

