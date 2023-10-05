// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./Token.sol";
import "./Nft.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract FarmVestedController is Ownable {
    Token public token;
    Nft public nft;

    uint256 totalRewardPerBlock;
    uint256 startBlock;

    PoolInfo[] public poolInfo;

    mapping(uint256 => mapping(uint256 => NftInfo)) public nftsInfo;

    uint256 totalAllocatedPoints;

    struct PoolInfo {
        ERC20   lpToken;
        uint256 allocPoint;
        uint256 lastRewardBlock;
        uint256 accCakePerShare;
        uint256 unlockBlock;
    }

    struct NftInfo {
        uint256 amount;
        uint256 rewardDebt;
    }

    constructor(
        address _token,
        address _nft,
        uint256 _totalRewardPerBlock,
        uint256 _startBlock
    ) {
        token = Token(_token);
        nft = Nft(_nft);
        totalRewardPerBlock = _totalRewardPerBlock;
        startBlock = _startBlock;
    }

    function addPool(address pool, uint256 allocPoint, uint256 unlockBlock) external onlyOwner {
        uint256 lastRewardBlock = block.number > startBlock
            ? block.number
            : startBlock;

        totalAllocatedPoints += allocPoint;

        poolInfo.push(
            PoolInfo({
                lpToken: ERC20(pool),
                allocPoint: allocPoint,
                lastRewardBlock: lastRewardBlock,
                accCakePerShare: 0,
                unlockBlock: unlockBlock
            })
        );
    }

    function updatePool(
        uint256 _pid,
        uint256 _allocPoint,
        uint256 _unlockBlock,
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
        poolInfo[_pid].unlockBlock = _unlockBlock;
    }

    function mintAllPoolRewards() internal {
        for (uint256 i = 0; i < poolInfo.length; i++) {
            mintPoolRewards(i);
        }
    }

    function mintPoolRewards(uint256 poolId) internal {
        PoolInfo storage pool = poolInfo[poolId];

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
        require(amount > 0, "FarmController: amount must be greater than 0");

        PoolInfo storage pool = poolInfo[poolId];

        require(block.number <= pool.unlockBlock , "FarmController: pool is finished");
    
        mintPoolRewards(poolId);
        
        pool.lpToken.transferFrom(
            address(msg.sender),
            address(this),
            amount
        );

        uint256 nftId = nft.mint(msg.sender);
        
        nftsInfo[poolId][nftId] = NftInfo({
            amount: amount,
            rewardDebt: (amount * pool.accCakePerShare) / 1e12
        });

    }

    function withdraw(uint poolId, uint256 nftId) external {
        require(poolId < poolInfo.length, "FarmController: pool doesn't exist");
        PoolInfo storage pool = poolInfo[poolId];

        require(pool.unlockBlock <= block.number, "FarmController: pool is locked");

        mintPoolRewards(poolId);

        NftInfo storage nftInfo = nftsInfo[poolId][nftId];

        require(nftInfo.amount > 0, "FarmController: nft does not exist");
    

        uint256 pending = (nftInfo.amount * pool.accCakePerShare) /
                1e12 -
                nftInfo.rewardDebt;

        if (pending > 0) {
                safeTokenTransfer(msg.sender, pending);
        }
        
        nft.transferFrom(msg.sender, address(this), nftId);
        
        nft.burn(nftId);
        
        pool.lpToken.transfer(address(msg.sender), nftInfo.amount);
    }

    function safeTokenTransfer(address _to, uint256 _amount) internal {
        uint256 reptilBal = token.balanceOf(address(this));
        if (_amount > reptilBal) {
            token.transfer(_to, reptilBal);
        } else {
            token.transfer(_to, _amount);
        }
    }
}


