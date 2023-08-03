import { expect } from "chai";
import { ethers } from "hardhat";
import { FarmController } from "../typechain";
import { Token } from "../typechain/contracts/Token";
import { mineBlocks, mineToBlock } from "./utils";

describe("FarmController", () => {
  let token: Token;
  let farmController: FarmController;
  const START_BLOCK = 1000;
  const TOTAL_REWARD_PER_BLOCK = 1e9;

  beforeEach(async () => {
    await ethers.provider.send("hardhat_reset");
    token = await ethers.getContractFactory("Token").then((cf) => cf.deploy());
    const tokenAddress = await token.getAddress();

    farmController = await ethers
      .getContractFactory("FarmController")
      .then((cf) =>
        cf.deploy(tokenAddress, TOTAL_REWARD_PER_BLOCK, START_BLOCK)
      );
  });

  describe("Pools Management", () => {
    it("Correctly initialises `addPool`", async () => {
      const ALLOC_POINT = 1;
      const mintableToken = await ethers
        .getContractFactory("MintableToken")
        .then((cf) => cf.deploy());
      const mintableTokenAddress = await mintableToken.getAddress();

      await farmController.addPool(mintableTokenAddress, ALLOC_POINT);

      const poolInfo = await farmController.poolInfo(0);

      expect(poolInfo.lastRewardBlock).eq(START_BLOCK);
      expect(poolInfo.lpToken).eq(mintableTokenAddress);
      expect(poolInfo.accCakePerShare).eq(0);
      expect(poolInfo.allocPoint).eq(ALLOC_POINT);
    });

    it("Correctly updates `updatePool (no rewards update)`", async () => {
      const ALLOC_POINT = 1;
      const mintableToken = await ethers
        .getContractFactory("MintableToken")
        .then((cf) => cf.deploy());
      const mintableTokenAddress = await mintableToken.getAddress();

      await farmController.addPool(mintableTokenAddress, ALLOC_POINT);

      const NEW_ALLOC_POINT = 2;

      await farmController.updatePool(0, NEW_ALLOC_POINT, false);

      const poolInfo = await farmController.poolInfo(0);

      expect(poolInfo.allocPoint).eq(NEW_ALLOC_POINT);
    });
  });

  describe("Pools Rewards Accruing", () => {
    it("Single pool with one staker generating rewards", async () => {
      const ALLOC_POINT = 1;
      const TOTAL_REWARD_PER_BLOCK = BigInt(1e9);
      const [signer] = await ethers.getSigners();
      const lpToken = await ethers
        .getContractFactory("Token")
        .then((cf) => cf.deploy());

      lpToken.mint(await signer.getAddress(), 1);

      await token.transferOwnership(farmController.getAddress());

      await lpToken.approve(await farmController.getAddress(), 1);

      await farmController.addPool(lpToken.getAddress(), ALLOC_POINT);

      await mineToBlock(START_BLOCK);

      await farmController.deposit(0, 1);
      await farmController.withdraw(0, 1);

      expect(await token.balanceOf(signer.address)).to.be.equal(
        TOTAL_REWARD_PER_BLOCK
      );
    });

    it("Two pools with different `allocPoints` with one staker generating rewards", async () => {
      const ALLOC_POINT = 1;
      const TOTAL_REWARD_PER_BLOCK = BigInt(1e9);
      const [signer] = await ethers.getSigners();
      const lpToken1 = await ethers
        .getContractFactory("Token")
        .then((cf) => cf.deploy());
      const lpToken2 = await ethers
        .getContractFactory("Token")
        .then((cf) => cf.deploy());

      lpToken1.mint(await signer.getAddress(), 1);
      lpToken2.mint(await signer.getAddress(), 1);

      await token.transferOwnership(farmController.getAddress());

      await lpToken1.approve(await farmController.getAddress(), 1);
      await lpToken2.approve(await farmController.getAddress(), 1);

      await farmController.addPool(lpToken1.getAddress(), ALLOC_POINT);
      await farmController.addPool(lpToken2.getAddress(), ALLOC_POINT);

      await mineToBlock(START_BLOCK);

      await farmController.deposit(0, 1);
      await farmController.deposit(1, 1);
      await farmController.withdraw(0, 1);
      await farmController.withdraw(1, 1);

      expect(await token.balanceOf(signer.address)).to.be.equal(
        2n * TOTAL_REWARD_PER_BLOCK
      );
    });
  });

  describe("Users Rewards Accruing", () => {
    it("Single pool with multiple stakers generating rewards", async () => {
      const ALLOC_POINT = 1;
      const TOTAL_REWARD_PER_BLOCK = BigInt(1e9);
      const signers = await (await ethers.getSigners()).slice(0, 3);
      const lpToken = await ethers
        .getContractFactory("MintableToken")
        .then((cf) => cf.deploy());

      await Promise.all(
        signers.map((signer, i) =>
          lpToken.connect(signer).mint(signer.address, i + 1)
        )
      );

      await token.transferOwnership(farmController.getAddress());

      await Promise.all(
        signers.map((signer, i) =>
          lpToken.connect(signer).approve(farmController.getAddress(), i + 1)
        )
      );

      await farmController.addPool(lpToken.getAddress(), ALLOC_POINT);

      await mineToBlock(START_BLOCK);

      await Promise.all(
        signers.map((signer, i) =>
          farmController.connect(signer).deposit(0, i + 1)
        )
      );
      await Promise.all(
        signers.map((signer, i) =>
          farmController.connect(signer).withdraw(0, i + 1)
        )
      );

      // Magic numbers are correct
      expect(await token.balanceOf(signers[0])).equal(1499999999n);
      expect(await token.balanceOf(signers[1])).equal(1399999999n);
      expect(await token.balanceOf(signers[2])).equal(2100000000n);
      // Magic numbers are correct
    });
  });
});
