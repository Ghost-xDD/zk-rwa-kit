/**
 * @zk-rwa-kit/contracts
 * 
 * Smart contracts for privacy-preserving RWA compliance on Mantle
 */

// Export ABIs
export { default as IdentityRegistryABI } from "../artifacts/contracts/IdentityRegistry.sol/IdentityRegistry.json";
export { default as ZkOracleABI } from "../artifacts/contracts/ZkOracle.sol/ZkOracle.json";
export { default as ComplianceModuleABI } from "../artifacts/contracts/ComplianceModule.sol/ComplianceModule.json";
export { default as RWATokenABI } from "../artifacts/contracts/RWAToken.sol/RWAToken.json";

// Export interfaces
export { default as IIdentityRegistryABI } from "../artifacts/contracts/interfaces/IIdentityRegistry.sol/IIdentityRegistry.json";
export { default as IZkOracleABI } from "../artifacts/contracts/interfaces/IZkOracle.sol/IZkOracle.json";
export { default as IComplianceABI } from "../artifacts/contracts/interfaces/ICompliance.sol/ICompliance.json";

// Export typechain types
export * from "../typechain-types";

// Claim type constants
export const CLAIM_TYPES = {
  ELIGIBLE: "0x" + Buffer.from("ELIGIBLE").toString("hex").padEnd(64, "0"),
  ACCREDITED: "0x" + Buffer.from("ACCREDITED").toString("hex").padEnd(64, "0"),
  KYC_VERIFIED: "0x" + Buffer.from("KYC_VERIFIED").toString("hex").padEnd(64, "0"),
} as const;

// Network configurations
export const NETWORKS = {
  mantleSepolia: {
    chainId: 5003,
    name: "Mantle Sepolia",
    rpcUrl: "https://rpc.sepolia.mantle.xyz",
    explorer: "https://sepolia.mantlescan.xyz",
  },
  hardhat: {
    chainId: 31337,
    name: "Hardhat",
    rpcUrl: "http://127.0.0.1:8545",
    explorer: "",
  },
} as const;

// Helper to load deployed addresses
export function getDeployedAddresses(network: "mantle-sepolia" | "hardhat" = "mantle-sepolia") {
  try {
    // Dynamic import at runtime
    const addresses = require(`../deployments/${network}.json`);
    return addresses as {
      identityRegistry: string;
      zkOracle: string;
      complianceModule: string;
      rwaToken: string;
      deployer: string;
      relayer: string;
      chainId: string;
      network: string;
      deployedAt: string;
    };
  } catch {
    throw new Error(`No deployment found for network: ${network}. Run 'pnpm deploy' first.`);
  }
}
