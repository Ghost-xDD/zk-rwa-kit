import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { 
  IdentityRegistry, 
  ZkOracle, 
  ComplianceModule, 
  RWAToken 
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Zk-RWA-Kit Contracts", function () {
  let identityRegistry: IdentityRegistry;
  let zkOracle: ZkOracle;
  let complianceModule: ComplianceModule;
  let rwaToken: RWAToken;

  let owner: SignerWithAddress;
  let relayer: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let nonEligibleUser: SignerWithAddress;

  const ELIGIBLE_CLAIM = ethers.keccak256(ethers.toUtf8Bytes("ELIGIBLE"));
  const CLAIM_VALUE = ethers.encodeBytes32String("true");
  const ORACLE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ORACLE_ROLE"));
  const AGENT_ROLE = ethers.keccak256(ethers.toUtf8Bytes("AGENT_ROLE"));

  beforeEach(async function () {
    [owner, relayer, user1, user2, nonEligibleUser] = await ethers.getSigners();

    // Deploy IdentityRegistry
    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    identityRegistry = await IdentityRegistry.deploy(owner.address);

    // Deploy ZkOracle
    const ZkOracle = await ethers.getContractFactory("ZkOracle");
    zkOracle = await ZkOracle.deploy(await identityRegistry.getAddress(), owner.address);

    // Grant ORACLE_ROLE to ZkOracle
    await identityRegistry.grantRole(ORACLE_ROLE, await zkOracle.getAddress());

    // Grant AGENT_ROLE to relayer
    await zkOracle.grantRole(AGENT_ROLE, relayer.address);

    // Deploy ComplianceModule
    const ComplianceModule = await ethers.getContractFactory("ComplianceModule");
    complianceModule = await ComplianceModule.deploy(await identityRegistry.getAddress());

    // Deploy RWAToken
    const RWAToken = await ethers.getContractFactory("RWAToken");
    rwaToken = await RWAToken.deploy(
      "RWA Demo Token",
      "RWAD",
      await complianceModule.getAddress(),
      owner.address
    );
  });

  describe("IdentityRegistry", function () {
    it("should not allow direct identity registration without ORACLE_ROLE", async function () {
      await expect(
        identityRegistry.connect(user1).registerIdentity(user1.address)
      ).to.be.reverted;
    });

    it("should not allow direct claim addition without ORACLE_ROLE", async function () {
      const expiry = Math.floor(Date.now() / 1000) + 86400;
      await expect(
        identityRegistry.connect(user1).addClaim(user1.address, ELIGIBLE_CLAIM, CLAIM_VALUE, expiry)
      ).to.be.reverted;
    });
  });

  describe("ZkOracle", function () {
    it("should reject claim submission from non-agent", async function () {
      const expiry = Math.floor(Date.now() / 1000) + 86400;
      await expect(
        zkOracle.connect(user1).submitClaim(
          user1.address,
          ELIGIBLE_CLAIM,
          CLAIM_VALUE,
          expiry,
          ethers.toUtf8Bytes("proof")
        )
      ).to.be.reverted;
    });

    it("should accept claim submission from agent (relayer)", async function () {
      const expiry = Math.floor(Date.now() / 1000) + 86400;
      
      await expect(
        zkOracle.connect(relayer).submitClaim(
          user1.address,
          ELIGIBLE_CLAIM,
          CLAIM_VALUE,
          expiry,
          ethers.toUtf8Bytes("proof")
        )
      ).to.emit(zkOracle, "ClaimSubmitted")
        .withArgs(user1.address, ELIGIBLE_CLAIM, CLAIM_VALUE, expiry);
    });

    it("should register identity when submitting first claim", async function () {
      const expiry = Math.floor(Date.now() / 1000) + 86400;
      
      expect(await identityRegistry.hasIdentity(user1.address)).to.be.false;
      
      await zkOracle.connect(relayer).submitClaim(
        user1.address,
        ELIGIBLE_CLAIM,
        CLAIM_VALUE,
        expiry,
        ethers.toUtf8Bytes("proof")
      );
      
      expect(await identityRegistry.hasIdentity(user1.address)).to.be.true;
    });

    it("should prevent proof replay", async function () {
      const expiry = Math.floor(Date.now() / 1000) + 86400;
      const proof = ethers.toUtf8Bytes("unique-proof");
      
      await zkOracle.connect(relayer).submitClaim(
        user1.address,
        ELIGIBLE_CLAIM,
        CLAIM_VALUE,
        expiry,
        proof
      );
      
      // Same exact proof should be rejected
      await expect(
        zkOracle.connect(relayer).submitClaim(
          user1.address,
          ELIGIBLE_CLAIM,
          CLAIM_VALUE,
          expiry,
          proof
        )
      ).to.be.revertedWith("Proof already used");
    });
  });

  describe("ComplianceModule", function () {
    it("should return false for non-eligible address", async function () {
      expect(await complianceModule.canTransfer(
        ethers.ZeroAddress,
        user1.address,
        1000
      )).to.be.false;
    });

    it("should return true for eligible address (minting)", async function () {
      const expiry = Math.floor(Date.now() / 1000) + 86400;
      await zkOracle.connect(relayer).submitClaim(
        user1.address,
        ELIGIBLE_CLAIM,
        CLAIM_VALUE,
        expiry,
        ethers.toUtf8Bytes("proof")
      );
      
      expect(await complianceModule.canTransfer(
        ethers.ZeroAddress,
        user1.address,
        1000
      )).to.be.true;
    });
  });

  describe("RWAToken", function () {
    it("should reject mint to non-eligible address", async function () {
      await expect(
        rwaToken.mint(nonEligibleUser.address, ethers.parseEther("100"))
      ).to.be.revertedWith("Recipient not eligible");
    });

    it("should allow mint after eligibility verified", async function () {
      const expiry = Math.floor(Date.now() / 1000) + 86400;
      await zkOracle.connect(relayer).submitClaim(
        user1.address,
        ELIGIBLE_CLAIM,
        CLAIM_VALUE,
        expiry,
        ethers.toUtf8Bytes("proof1")
      );

      await expect(rwaToken.mint(user1.address, ethers.parseEther("100")))
        .to.emit(rwaToken, "Transfer")
        .withArgs(ethers.ZeroAddress, user1.address, ethers.parseEther("100"));

      expect(await rwaToken.balanceOf(user1.address)).to.equal(ethers.parseEther("100"));
    });

    it("should reject transfer to non-eligible address", async function () {
      const expiry = Math.floor(Date.now() / 1000) + 86400;
      
      // Make user1 eligible and mint
      await zkOracle.connect(relayer).submitClaim(
        user1.address,
        ELIGIBLE_CLAIM,
        CLAIM_VALUE,
        expiry,
        ethers.toUtf8Bytes("proof1")
      );
      await rwaToken.mint(user1.address, ethers.parseEther("100"));

      // Transfer to non-eligible user should fail
      await expect(
        rwaToken.connect(user1).transfer(nonEligibleUser.address, ethers.parseEther("50"))
      ).to.be.revertedWith("Transfer not compliant");
    });

    it("should allow transfer between eligible addresses", async function () {
      const expiry = Math.floor(Date.now() / 1000) + 86400;

      // Make both users eligible
      await zkOracle.connect(relayer).submitClaim(
        user1.address,
        ELIGIBLE_CLAIM,
        CLAIM_VALUE,
        expiry,
        ethers.toUtf8Bytes("proof1")
      );
      await zkOracle.connect(relayer).submitClaim(
        user2.address,
        ELIGIBLE_CLAIM,
        CLAIM_VALUE,
        expiry,
        ethers.toUtf8Bytes("proof2")
      );

      // Mint to user1
      await rwaToken.mint(user1.address, ethers.parseEther("100"));

      // Transfer should succeed
      await expect(
        rwaToken.connect(user1).transfer(user2.address, ethers.parseEther("50"))
      ).to.emit(rwaToken, "Transfer")
        .withArgs(user1.address, user2.address, ethers.parseEther("50"));

      expect(await rwaToken.balanceOf(user1.address)).to.equal(ethers.parseEther("50"));
      expect(await rwaToken.balanceOf(user2.address)).to.equal(ethers.parseEther("50"));
    });

    it("should reject operations after claim expires", async function () {
      const expiry = Math.floor(Date.now() / 1000) + 60; // 60 seconds from now

      await zkOracle.connect(relayer).submitClaim(
        user1.address,
        ELIGIBLE_CLAIM,
        CLAIM_VALUE,
        expiry,
        ethers.toUtf8Bytes("proof1")
      );

      // Mint should work initially
      await rwaToken.mint(user1.address, ethers.parseEther("100"));

      // Fast forward past expiry
      await time.increase(120);

      // Minting to same user should now fail (claim expired)
      await expect(
        rwaToken.mint(user1.address, ethers.parseEther("50"))
      ).to.be.revertedWith("Recipient not eligible");
    });

    it("should only allow MINTER_ROLE to mint", async function () {
      const expiry = Math.floor(Date.now() / 1000) + 86400;
      await zkOracle.connect(relayer).submitClaim(
        user1.address,
        ELIGIBLE_CLAIM,
        CLAIM_VALUE,
        expiry,
        ethers.toUtf8Bytes("proof1")
      );

      await expect(
        rwaToken.connect(user1).mint(user1.address, ethers.parseEther("100"))
      ).to.be.reverted;
    });
  });
});
