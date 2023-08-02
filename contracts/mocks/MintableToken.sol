// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MintableToken is ERC20 {
    constructor() ERC20("MTN", "MTN") {}

    function mint(address to, uint256 amount) external {
        super._mint(to, amount);
    }
}
