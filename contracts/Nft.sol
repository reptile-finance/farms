// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Nft is ERC721, Ownable {
    using Strings for uint256;
    uint256 public latestTokenId;
    string public baseURI;

    constructor(string memory _baseURI) ERC721("Reptile Vested NFT", "RVN") {
        latestTokenId = 0;
        baseURI = _baseURI;
    }

    function mint(address to) public onlyOwner returns (uint256) {
        latestTokenId++;
        _mint(to, latestTokenId);
        return latestTokenId;
    }

    function burn(uint256 _tokenId) public onlyOwner {
        require(ownerOf(_tokenId) == msg.sender, "Nft: caller is not the token owner");
        _burn(_tokenId);
    }


    function setBaseURI(string memory _baseURI) public onlyOwner {
        baseURI = _baseURI;
    }

    function tokenURI(uint256 _tokenId) public view override returns (string memory) {
        return string(abi.encodePacked(baseURI, _tokenId.toString()));
    }
}

