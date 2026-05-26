import * as fs from "node:fs";
import * as path from "node:path";
import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  if (!deployer) {
    throw new Error("No deployer available. Set PRIVATE_KEY in .env.");
  }

  console.log(`Deploying BlackoutMessenger to ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);

  const Messenger = await ethers.getContractFactory("BlackoutMessenger");
  const messenger = await Messenger.deploy();
  await messenger.waitForDeployment();

  const address = await messenger.getAddress();
  const deployment = {
    network: network.name,
    chainId: network.config.chainId,
    contractName: "BlackoutMessenger",
    address,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  const outputDir = path.join(process.cwd(), "deployments");
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${network.name}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(deployment, null, 2)}\n`);

  console.log(`BlackoutMessenger deployed: ${address}`);
  console.log(`Deployment metadata written to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
