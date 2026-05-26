import "dotenv/config";
import "@nomicfoundation/hardhat-toolbox";
import "@cofhe/hardhat-plugin";
import { HardhatUserConfig } from "hardhat/config";

const privateKey = process.env.PRIVATE_KEY;
const accounts = privateKey ? [privateKey] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    "eth-sepolia": {
      url: process.env.SEPOLIA_RPC_URL || "",
      chainId: 11155111,
      accounts,
    },
    "arb-sepolia": {
      url: process.env.ARBITRUM_SEPOLIA_RPC_URL || "",
      chainId: 421614,
      accounts,
    },
    "base-sepolia": {
      url: process.env.BASE_SEPOLIA_RPC_URL || "",
      chainId: 84532,
      accounts,
    },
  },
};

export default config;
