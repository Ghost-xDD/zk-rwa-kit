import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("=".repeat(60));
  console.log("Zk-RWA-Kit Contract Deployment");
  console.log("=".repeat(60));
  console.log(`Network: ${network.name} (chainId: ${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
  console.log("=".repeat(60));

  // 1. Deploy IdentityRegistry
  console.log("\n1. Deploying IdentityRegistry...");
  const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
  const identityRegistry = await IdentityRegistry.deploy(deployer.address);
  await identityRegistry.waitForDeployment();
  const identityRegistryAddress = await identityRegistry.getAddress();
  console.log(`   IdentityRegistry deployed to: ${identityRegistryAddress}`);

  // 2. Deploy ZkOracle
  console.log("\n2. Deploying ZkOracle...");
  const ZkOracle = await ethers.getContractFactory("ZkOracle");
  const zkOracle = await ZkOracle.deploy(identityRegistryAddress, deployer.address);
  await zkOracle.waitForDeployment();
  const zkOracleAddress = await zkOracle.getAddress();
  console.log(`   ZkOracle deployed to: ${zkOracleAddress}`);

  // 3. Grant ORACLE_ROLE to ZkOracle on IdentityRegistry
  console.log("\n3. Granting ORACLE_ROLE to ZkOracle...");
  const ORACLE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ORACLE_ROLE"));
  const grantOracleTx = await identityRegistry.grantRole(ORACLE_ROLE, zkOracleAddress);
  await grantOracleTx.wait();
  console.log(`   ORACLE_ROLE granted to: ${zkOracleAddress}`);

  // 4. Grant AGENT_ROLE to relayer on ZkOracle
  console.log("\n4. Granting AGENT_ROLE to relayer...");
  const AGENT_ROLE = ethers.keccak256(ethers.toUtf8Bytes("AGENT_ROLE"));
  const relayerAddress = process.env.RELAYER_ADDRESS || deployer.address;
  const grantAgentTx = await zkOracle.grantRole(AGENT_ROLE, relayerAddress);
  await grantAgentTx.wait();
  console.log(`   AGENT_ROLE granted to: ${relayerAddress}`);

  // 5. Deploy ComplianceModule
  console.log("\n5. Deploying ComplianceModule...");
  const ComplianceModule = await ethers.getContractFactory("ComplianceModule");
  const complianceModule = await ComplianceModule.deploy(identityRegistryAddress);
  await complianceModule.waitForDeployment();
  const complianceModuleAddress = await complianceModule.getAddress();
  console.log(`   ComplianceModule deployed to: ${complianceModuleAddress}`);

  // 6. Deploy RWAToken
  console.log("\n6. Deploying RWAToken...");
  const RWAToken = await ethers.getContractFactory("RWAToken");
  const rwaToken = await RWAToken.deploy(
    "RWA Demo Token",
    "RWAD",
    complianceModuleAddress,
    deployer.address
  );
  await rwaToken.waitForDeployment();
  const rwaTokenAddress = await rwaToken.getAddress();
  console.log(`   RWAToken deployed to: ${rwaTokenAddress}`);

  // Save deployment addresses
  const addresses = {
    identityRegistry: identityRegistryAddress,
    zkOracle: zkOracleAddress,
    complianceModule: complianceModuleAddress,
    rwaToken: rwaTokenAddress,
    deployer: deployer.address,
    relayer: relayerAddress,
    chainId: network.chainId.toString(),
    network: network.name || "unknown",
    deployedAt: new Date().toISOString(),
  };

  // Ensure deployments directory exists
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  // Save to network-specific file
  const filename = network.chainId === 5003n ? "mantle-sepolia.json" : `${network.name || network.chainId}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(addresses, null, 2));
  console.log(`\n✅ Deployment addresses saved to: ${filepath}`);

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log(`IdentityRegistry: ${identityRegistryAddress}`);
  console.log(`ZkOracle:         ${zkOracleAddress}`);
  console.log(`ComplianceModule: ${complianceModuleAddress}`);
  console.log(`RWAToken:         ${rwaTokenAddress}`);
  console.log("=".repeat(60));

  // Print .env updates
  console.log("\n📝 Add these to your .env file:");
  console.log(`ZK_ORACLE_ADDRESS=${zkOracleAddress}`);
  console.log(`IDENTITY_REGISTRY_ADDRESS=${identityRegistryAddress}`);
  console.log(`COMPLIANCE_MODULE_ADDRESS=${complianceModuleAddress}`);
  console.log(`RWA_TOKEN_ADDRESS=${rwaTokenAddress}`);

  return addresses;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
