import { expect } from "chai";
import { ethers } from "hardhat";
import { Token } from "../typechain";

describe("Token", () => {
  let token: Token;

  beforeEach(async () => {
    token = await ethers.getContractFactory("Token").then((cf) => cf.deploy());
  });

  it("Mint fail if not owner", async () => {
    const signer = await ethers.getSigners().then((_) => _[1]);
    await expect(
      token.connect(signer).mint(signer.address, BigInt(2) * BigInt(2))
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("Minting more than `maxTotalSupply` is rejected", async () => {
    const wallet = await ethers.getSigners().then((_) => _[0]);
    const maxTotalSupply = await token.maxTotalSupply();
    await expect(
      token.mint(wallet.address, maxTotalSupply.valueOf() * BigInt(2))
    ).to.be.rejectedWith("Token: Max Total Supply Reached");
  });

  it("Minting more than `maxTotalSupply` is rejected when was minted before", async () => {
    const wallet = await ethers.getSigners().then((_) => _[0]);
    const maxTotalSupply = await token.maxTotalSupply();
    await token.mint(wallet.address, maxTotalSupply.valueOf());
    await expect(
      token.mint(wallet.address, maxTotalSupply.valueOf())
    ).to.be.rejectedWith("Token: Max Total Supply Reached");
  });
});
