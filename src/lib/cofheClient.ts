import { Encryptable, FheTypes } from "@cofhe/sdk";
import { chains as cofheChains } from "@cofhe/sdk/chains";
import { createCofheClient, createCofheConfig } from "@cofhe/sdk/web";
import initTfhe from "tfhe";
import tfheWasmUrl from "tfhe/tfhe_bg.wasm?url";
import { appChain } from "../config/chains";

type CofheChain = (typeof cofheChains)[keyof typeof cofheChains];

const knownCofheChains = cofheChains as Record<string, CofheChain | undefined>;

function resolveCofheChain(chainId: number) {
  if (chainId === 11155111) return knownCofheChains.sepolia;
  if (chainId === 421614) return knownCofheChains.arbitrumSepolia || knownCofheChains.arbSepolia;
  if (chainId === 84532) return knownCofheChains.baseSepolia;
  return knownCofheChains.baseSepolia || knownCofheChains.sepolia;
}

const cofheChain = resolveCofheChain(appChain.id);

if (!cofheChain) {
  throw new Error("Selected Fhenix chain is not available in @cofhe/sdk/chains.");
}

const config = createCofheConfig({
  supportedChains: [cofheChain],
  useWorkers: false,
});

export const cofheClient = createCofheClient(config);

let tfheWasmReady: Promise<void> | undefined;
let selfPermitReady: Promise<void> | undefined;

function ensureTfheWasm() {
  tfheWasmReady ??= initTfhe(tfheWasmUrl).then(() => undefined);
  return tfheWasmReady;
}

export async function connectCofhe(publicClient: unknown, walletClient: unknown) {
  await ensureTfheWasm();
  await cofheClient.connect(publicClient as never, walletClient as never);
  return cofheClient;
}

export async function ensureCofhePermit() {
  const activePermit = cofheClient.permits.getActivePermit(appChain.id);
  if (activePermit) return;

  selfPermitReady ??= cofheClient.permits
    .getOrCreateSelfPermit(appChain.id)
    .then(() => undefined)
    .finally(() => {
      selfPermitReady = undefined;
    });

  return selfPermitReady;
}

export async function encryptKeyParts(keyPartA: bigint, keyPartB: bigint) {
  await ensureTfheWasm();
  const [encryptedPartA, encryptedPartB] = await cofheClient
    .encryptInputs([Encryptable.uint128(keyPartA), Encryptable.uint128(keyPartB)])
    .setChainId(appChain.id)
    .execute();

  return [encryptedPartA, encryptedPartB] as const;
}

export async function decryptKeyPart(handle: bigint | string) {
  return cofheClient
    .decryptForView(handle, FheTypes.Uint128)
    .setChainId(appChain.id)
    .set404RetryTimeout(20_000)
    .execute();
}
