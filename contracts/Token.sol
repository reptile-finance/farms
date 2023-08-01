// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Token is ERC20, Ownable {
    uint256 public maxTotalSupply = 1e27;

    constructor() ERC20("Reptile Finance Token", "RFT") {}

    function _mint(address to, uint256 amount) internal override {
        uint256 newMaxSupply = totalSupply() + amount;
        require(
            newMaxSupply <= maxTotalSupply,
            "Token: Max Total Supply Reached"
        );

        super._mint(to, amount);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
