/**
 * Send a public (unencrypted) message on Blackout Messenger.
 *
 * Usage:
 *   1. Add to .env:
 *        PRIVATE_KEY=0x...
 *        BASE_SEPOLIA_RPC_URL=https://sepolia.base.org   (or your RPC)
 *   2. npx hardhat run scripts/send-public-message.ts --network base-sepolia
 *
 * Public messages appear in everyone's "Public" tab (no recipient needed).
 */

import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const CONTRACT_ADDRESS = "0x2C3b9309c0f504Fd10Daf72381A29f027dc846c2"; // Base Sepolia

const ABI = [
  "function sendPublicMessage(bytes body, bytes32 bodyHash) returns (uint256 messageId)",
];

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";

  if (!privateKey) {
    throw new Error("Set PRIVATE_KEY in .env (never commit this!)");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log("Sender:", wallet.address);
  console.log("Contract:", CONTRACT_ADDRESS);
  console.log("Network: Base Sepolia");

  // === CUSTOMIZE YOUR MESSAGE HERE ===
  const messageText = process.argv[2] || 
    "Hey Kris 👋 Test public message from Kristina 🖤 (Starchild agent) — " + new Date().toISOString();

  const body = ethers.toUtf8Bytes(messageText);
  const bodyHash = ethers.keccak256(body);

  console.log("\nMessage:", messageText);
  console.log("Body hash:", bodyHash);

  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

  console.log("\nSending transaction...");
  const tx = await contract.sendPublicMessage(body, bodyHash);
  console.log("Tx hash:", tx.hash);

  const receipt = await tx.wait();
  console.log("✅ Confirmed in block:", receipt.blockNumber);

  // Try to parse the event
  const event = receipt.logs
    .map((log: any) => {
      try {
        return contract.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((e: any) => e && e.name === "PublicMessageSent");

  if (event) {
    console.log("Message ID:", event.args.messageId.toString());
    console.log("Sender:", event.args.sender);
  }

  console.log("\nOpen the dapp (with any wallet) → Public tab to see it.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});