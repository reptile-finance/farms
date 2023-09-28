import { expect } from "chai";
import { ethers } from "hardhat";
import { FarmVestedController, MintableToken } from "../typechain";
import { Token } from "../typechain/contracts/Token";
import { Nft } from "../typechain/contracts/Nft";
import { getCurrentBlock, mineBlocks, mineToBlock } from "./utils";

describe("FarmVestedController", () => {
  let token: Token;
  let farmVestedController: FarmVestedController;
  let nft: Nft;
  const baseURI = "https://example.com/";
  const START_BLOCK = 1000;
  const TOTAL_REWARD_PER_BLOCK = 1e9;

  beforeEach(async () => {
    await ethers.provider.send("hardhat_reset");
    token = await ethers.getContractFactory("Token").then((cf) => cf.deploy());
    nft = await ethers.getContractFactory("Nft").then((cf) => cf.deploy(baseURI));

    const tokenAddress = await token.getAddress();
    const nftAddress = await nft.getAddress();

    farmVestedController = await ethers
      .getContractFactory("FarmVestedController")
      .then((cf) =>
        cf.deploy(tokenAddress, nftAddress, TOTAL_REWARD_PER_BLOCK, START_BLOCK)
      );

    await token.transferOwnership(farmVestedController.getAddress());
    await nft.transferOwnership(farmVestedController.getAddress());
  });

  describe("Pools Management", () => {
    it("Correctly initialises `addPool`", async () => {
      const vestedBlocks = 1;
      const ALLOC_POINT = 1;
      const mintableToken = await ethers
        .getContractFactory("MintableToken")
        .then((cf) => cf.deploy());
      const mintableTokenAddress = await mintableToken.getAddress();

      await farmVestedController.addPool(mintableTokenAddress, vestedBlocks, ALLOC_POINT);

      const poolInfo = await farmVestedController.poolInfo(0);

      expect(poolInfo.lastRewardBlock).eq(START_BLOCK);
      expect(poolInfo.lpToken).eq(mintableTokenAddress);
      expect(poolInfo.accCakePerShare).eq(0);
      expect(poolInfo.allocPoint).eq(ALLOC_POINT);
      expect(poolInfo.vestedBlocks).eq(vestedBlocks);
    });

    it("Correctly updates `updatePool (no rewards update)`", async () => {
      const ALLOC_POINT = 1;
      const vestedBlocks = 1;
      const mintableToken = await ethers
        .getContractFactory("MintableToken")
        .then((cf) => cf.deploy());
      const mintableTokenAddress = await mintableToken.getAddress();

      await farmVestedController.addPool(mintableTokenAddress, vestedBlocks, ALLOC_POINT);

      const NEW_ALLOC_POINT = 2;
      const NEW_VESTED_BLOCKS = 2;

      await farmVestedController.updatePool(0, NEW_ALLOC_POINT, NEW_VESTED_BLOCKS, false);

      const poolInfo = await farmVestedController.poolInfo(0);

      expect(poolInfo.allocPoint).eq(NEW_ALLOC_POINT);
      expect(poolInfo.vestedBlocks).eq(NEW_VESTED_BLOCKS);
    });
  });

  describe("Deposit", () => {

    let lpToken: MintableToken;
    let lpTokenAddress;
    const vestedBlocks = 1;
    beforeEach(async () => {
      const ALLOC_POINT = 1;

      lpToken = await ethers
        .getContractFactory("MintableToken")
        .then((cf) => cf.deploy());
      
      lpTokenAddress = await lpToken.getAddress();

      await farmVestedController.addPool(lpTokenAddress, vestedBlocks, ALLOC_POINT);


    });

    it("Fail if pool does not exist", async () => {
      await expect(farmVestedController.deposit(1, 1)).to.be.revertedWith("FarmController: pool doesn't exist");
    });

    it("Fail if amount to deposit is 0", async () => {
      await expect(farmVestedController.deposit(0, 0)).to.be.revertedWith("FarmController: amount must be greater than 0");
    })

    it("Fail if amount to deposit is greater than allowance", async () => {
      await expect(farmVestedController.deposit(0, 1)).to.be.revertedWith("ERC20: insufficient allowance");
    })

    it("deposit correctly and receive NFT", async () => {
      const accountAddress = (await ethers.getSigners())[0].address;

      await lpToken.mint(accountAddress, 100);

      await lpToken.approve(farmVestedController.getAddress(), 100);

      const currentBlock = await getCurrentBlock();
      const transaction = await farmVestedController.deposit(0, 100);

      expect(await nft.balanceOf(accountAddress)).to.be.equal(1);
      expect(await lpToken.balanceOf(accountAddress)).to.be.equal(0);
      expect(await lpToken.balanceOf(farmVestedController.getAddress())).to.be.equal(100);
      const nftId = await nft.latestTokenId();

      expect((await farmVestedController.nftsInfo(0, nftId)).rewardDebt).to.be.equal(0);
      expect((await farmVestedController.nftsInfo(0, nftId)).unlockBlock).to.be.equal(currentBlock + vestedBlocks + 1);
    });
  });

  describe("Withdraw", () => {
    let lpToken: MintableToken;
    let lpTokenAddress;
    const vestedBlocks = 10;
    beforeEach(async () => {
      const ALLOC_POINT = 1;

      lpToken = await ethers
        .getContractFactory("MintableToken")
        .then((cf) => cf.deploy());
      
      lpTokenAddress = await lpToken.getAddress();

      await farmVestedController.addPool(lpTokenAddress, ALLOC_POINT, vestedBlocks);

      await mineToBlock(START_BLOCK);
    });

    it("Fail if pool does not exist", async () => {
      await expect(farmVestedController.deposit(1, 1)).to.be.revertedWith("FarmController: pool doesn't exist");
    });

    it("Fails if NFT is locked", async () => {
      const accountAddress = (await ethers.getSigners())[0].address;

      await lpToken.mint(accountAddress, 100);

      await lpToken.approve(farmVestedController.getAddress(), 100);

      const currentBlock = await getCurrentBlock();
      await farmVestedController.deposit(0, 100);

      const nftId = await nft.latestTokenId();

      await mineToBlock(currentBlock + vestedBlocks - 2);

      await nft.approve(farmVestedController.getAddress(), nftId);
      await expect(farmVestedController.withdraw(0, nftId)).to.be.revertedWith("FarmController: nft is locked");
    });

    it("Withdraw correctly and burn NFT", async () => {

      const accountAddress = (await ethers.getSigners())[0].address;

      await lpToken.mint(accountAddress, 100);

      await lpToken.approve(farmVestedController.getAddress(), 100);

      const currentBlock = await getCurrentBlock();
      await farmVestedController.deposit(0, 100);

      const nftId = await nft.latestTokenId();

      await mineToBlock(currentBlock + vestedBlocks - 1);

      await nft.approve(farmVestedController.getAddress(), nftId);
      await farmVestedController.withdraw(0, nftId);

      expect(await nft.balanceOf(accountAddress)).to.be.equal(0);
      expect(await lpToken.balanceOf(accountAddress)).to.be.equal(100);
      expect(await lpToken.balanceOf(farmVestedController.getAddress())).to.be.equal(0);
      expect(await token.balanceOf(accountAddress)).to.be.equal(TOTAL_REWARD_PER_BLOCK * vestedBlocks);

      expect((await farmVestedController.nftsInfo(0, nftId)).rewardDebt).to.be.equal(0);
      expect((await farmVestedController.nftsInfo(0, nftId)).unlockBlock).to.be.equal(currentBlock + vestedBlocks + 1);
    });

  });
});
