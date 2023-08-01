// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./Token.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FarmController is Ownable {
    Token public token;
    uint256 totalRewardPerBlock;
    uint256 startBlock;

    PoolInfo[] public poolInfo;

    mapping(address => UserInfo) public usersInfo;

    uint256 totalAllocatedPoints;

    struct PoolInfo {
        ERC20 lpToken;
        uint256 allocPoint;
        uint256 lastRewardBlock;
        uint256 accCakePerShare;
    }

    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
    }

    constructor(
        address _token,
        uint256 _totalRewardPerBlock,
        uint256 _startBlock
    ) {
        token = Token(_token);
        totalRewardPerBlock = _totalRewardPerBlock;
        startBlock = _startBlock;
    }

    function addPool(address pool, uint256 allocPoint) external onlyOwner {
        uint256 lastRewardBlock = block.number > startBlock
            ? block.number
            : startBlock;

        totalAllocatedPoints += allocPoint;

        poolInfo.push(
            PoolInfo({
                lpToken: ERC20(pool),
                allocPoint: allocPoint,
                lastRewardBlock: lastRewardBlock,
                accCakePerShare: 0
            })
        );
    }

    function updatePool(
        uint256 _pid,
        uint256 _allocPoint,
        bool _withUpdate
    ) external onlyOwner {
        if (_withUpdate) {
            mintAllPoolRewards();
        }

        uint256 prevAllocatedPoints = poolInfo[_pid].allocPoint;

        totalAllocatedPoints =
            totalAllocatedPoints +
            _allocPoint -
            prevAllocatedPoints;

        poolInfo[_pid].allocPoint = _allocPoint;
    }

    function mintAllPoolRewards() internal {
        for (uint256 i = 0; i < poolInfo.length; i++) {
            mintPoolRewards(i);
        }
    }

    function mintPoolRewards(uint256 poolId) internal {
        PoolInfo memory pool = poolInfo[poolId];

        // If accrueable period haven't been reached
        if (block.number <= pool.lastRewardBlock) return;

        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (lpSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }

        uint256 totalAccrueableBlocks = block.number - pool.lastRewardBlock;

        uint256 accruedRewards = (pool.allocPoint *
            totalAccrueableBlocks *
            totalRewardPerBlock) / (totalAllocatedPoints);

        token.mint(address(this), accruedRewards);

        pool.accCakePerShare += (accruedRewards * 1e12) / lpSupply;
        pool.lastRewardBlock = block.number;
    }

    function deposit(uint poolId, uint256 amount) external {
        require(poolId < poolInfo.length, "FarmController: pool doesn't exist");
        PoolInfo memory pool = poolInfo[poolId];

        mintPoolRewards(poolId);

        UserInfo memory user = usersInfo[msg.sender];

        if (user.amount > 0) {
            uint256 pending = (user.amount * pool.accCakePerShare) /
                1e12 -
                user.rewardDebt;
            if (pending > 0) {
                safeTokenTransfer(msg.sender, pending);
            }
        }

        if (amount > 0) {
            pool.lpToken.transferFrom(
                address(msg.sender),
                address(this),
                amount
            );
            user.amount += amount;
        }

        user.rewardDebt = (user.amount * pool.accCakePerShare) / 1e12;
    }

    function withdraw(uint poolId, uint256 amount) external {
        require(poolId < poolInfo.length, "FarmController: pool doesn't exist");
        PoolInfo memory pool = poolInfo[poolId];

        mintPoolRewards(poolId);

        UserInfo memory user = usersInfo[msg.sender];

        if (user.amount > 0) {
            uint256 pending = (user.amount * pool.accCakePerShare) /
                1e12 -
                user.rewardDebt;
            if (pending > 0) {
                safeTokenTransfer(msg.sender, pending);
            }
        }

        if (amount > 0) {
            pool.lpToken.transferFrom(
                address(this),
                address(msg.sender),
                amount
            );
            user.amount += amount;
        }

        user.rewardDebt = (user.amount * pool.accCakePerShare) / 1e12;
    }

    function safeTokenTransfer(address _to, uint256 _amount) internal {
        uint256 cakeBal = token.balanceOf(address(this));
        if (_amount > cakeBal) {
            token.transfer(_to, cakeBal);
        } else {
            token.transfer(_to, _amount);
        }
    }
}
