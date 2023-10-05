import { ethers } from "hardhat";

export const mineToBlock = async (targetBlockNumber: number) => {
  const currentBlockNumber = await ethers.provider.getBlockNumber();
  const blocksToMine = targetBlockNumber - currentBlockNumber;
  await mineBlocks(blocksToMine);
};

export const mineBlocks = (blocksToMine: number) =>
  ethers.provider.send("hardhat_mine", [`0x${blocksToMine.toString(16)}`]);

  export const getCurrentBlock = async () => {
    const currentBlock = await ethers.provider.getBlockNumber();
    return currentBlock;
  };
