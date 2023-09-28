import { expect } from "chai";
import { ethers } from "hardhat";
import { Nft } from "../typechain";

describe("Nft", () => {
  const baseURI = "https://example.com/";
  let nft: Nft;

  beforeEach(async () => {
    const NftFactory = await ethers.getContractFactory("Nft");
    nft = await NftFactory.deploy(baseURI);
    await nft.waitForDeployment();
  });

  it("should mint a new NFT", async () => {
    const address = "0x0000000000000000000000000000000000000001";
    const lastTokenId = await nft.latestTokenId();
    const tokenId = await nft.mint(address);
    expect(await nft.balanceOf(address)).to.equal(1);
    expect(await nft.ownerOf(lastTokenId + BigInt(1))).to.equal(address);
  });

  it("fails if caller to mint is not owner", async () => {
    const [_, notOwner] = await ethers.getSigners();
    await expect(nft.connect(notOwner).mint("0x0000000000000000000000000000000000000001")).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
  });

  it("should burn a token", async () => {
    const [owner] = await ethers.getSigners();
    await nft.mint(owner.address);
    const tokenId = await nft.latestTokenId();

    await nft.burn(tokenId);
    await expect(nft.ownerOf(tokenId)).to.be.revertedWith(
      "ERC721: invalid token ID"
    );
  });

  it("fails if caller to burn is not owner", async () => {
    const address = "0x0000000000000000000000000000000000000001";
    await nft.mint(address);
    const tokenId = await nft.latestTokenId();
    const [_, notOwner] = await ethers.getSigners();
    await expect(nft.connect(notOwner).burn(tokenId)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
  });

  it("should return correct URI for a token", async () => {
    await nft.mint("0x0000000000000000000000000000000000000001");
    const tokenId = await nft.latestTokenId();
    expect(await nft.tokenURI(tokenId)).to.equal(await nft.baseURI() + tokenId.toString());
  });

  it("should set a new baseUri function", async () => {
    const newBaseURI = "https://newexample.com/";
    await nft.setBaseURI(newBaseURI);
    expect(await nft.baseURI()).to.equal(newBaseURI);
  });

  it("fails if caller to setBaseURI is not owner ", async () => {
    const [_, notOwner] = await ethers.getSigners();
    await expect(nft.connect(notOwner).setBaseURI("https://newexample.com/")).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
  });


});


