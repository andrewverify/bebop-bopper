// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import {Owned} from "solmate/src/auth/Owned.sol";
import {SafeTransferLib} from "solmate/src/utils/SafeTransferLib.sol";
import {ERC20} from "solmate/src/tokens/ERC20.sol";
import {WETH} from "solmate/src/tokens/WETH.sol";
import {IReactorCallback} from "../interfaces/IReactorCallback.sol";
import {IReactor} from "../interfaces/IReactor.sol";
import {CurrencyLibrary} from "../lib/CurrencyLibrary.sol";
import {ResolvedOrder, SignedOrder} from "../base/ReactorStructs.sol";
import {ISwapRouter02} from "../external/ISwapRouter02.sol";
import {IBebopSettlement, Single, MakerSignature} from "../interfaces/IBebopSettlement.sol";
import "hardhat/console.sol";
import {IERC1271} from "permit2/src/interfaces/IERC1271.sol";


/// @notice A fill contract that uses SwapRouter02 to execute trades
contract BebopExecutor is IReactorCallback, Owned, IERC1271 {
    using SafeTransferLib for ERC20;
    using CurrencyLibrary for address;

    /// @notice thrown if reactorCallback is called with a non-whitelisted filler
    error CallerNotWhitelisted();
    /// @notice thrown if reactorCallback is called by an address other than the reactor
    error MsgSenderNotReactor();

    address private immutable whitelistedCaller;
    IReactor private immutable reactor;
    WETH private immutable weth;

    modifier onlyWhitelistedCaller() {
        if (msg.sender != whitelistedCaller) {
            revert CallerNotWhitelisted();
        }
        _;
    }

    modifier onlyReactor() {
        if (msg.sender != address(reactor)) {
            revert MsgSenderNotReactor();
        }
        _;
    }
    

    constructor(address _whitelistedCaller, IReactor _reactor, address _owner)
        Owned(_owner)
    {
        whitelistedCaller = _whitelistedCaller;
        reactor = _reactor;
        weth = WETH(payable(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2));
    }
     function isValidSignature(
    bytes32 _hash,
    bytes calldata _signature
  ) external view returns (bytes4) {
      return 0x1626ba7e;
   
  }

    /// @notice assume that we already have all output tokens
    function execute(SignedOrder calldata order, bytes calldata callbackData) external onlyWhitelistedCaller {
        reactor.executeWithCallback(order, callbackData);
    }

    /// @notice assume that we already have all output tokens
    function executeBatch(SignedOrder[] calldata orders, bytes calldata callbackData) external onlyWhitelistedCaller {
        reactor.executeBatchWithCallback(orders, callbackData);
    }

    /// @notice fill UniswapX orders using Bebop PMM
    /// @param callbackData It has the below encoded:
    /// address[] memory tokensToApproveForSwapRouter02: Max approve these tokens to swapRouter02
    /// address[] memory tokensToApproveForReactor: Max approve these tokens to reactor
    /// bytes[] memory multicallData: Pass into swapRouter02.multicall()
    function reactorCallback(ResolvedOrder[] calldata, bytes calldata callbackData) external onlyReactor {
        (
            Single memory singleOrder,
            MakerSignature memory makerSignature,
            uint256 filledTakerAmount


        ) = abi.decode(callbackData, (Single, MakerSignature,uint256));

        console.logBytes(makerSignature.signatureBytes);
        console.log("maker token: %s",singleOrder.maker_token);

        console.log("taker token: %s",singleOrder.taker_token);
        
        IBebopSettlement bebopContract = IBebopSettlement(0xbbbbbBB520d69a9775E85b458C58c648259FAD5F);

        unchecked {
                ERC20(singleOrder.taker_token).safeApprove(address(bebopContract), type(uint256).max);
            
                ERC20(singleOrder.maker_token).safeApprove(address(reactor), type(uint256).max);
            
        }

        bebopContract.swapSingle(singleOrder, makerSignature, filledTakerAmount);
        // transfer any native balance to the reactor
        // it will refund any excess
        if (address(this).balance > 0) {
            CurrencyLibrary.transferNative(address(reactor), address(this).balance);
        }
    }

    
    /// @notice Unwraps the contract's WETH9 balance and sends it to the recipient as ETH. Can only be called by owner.
    /// @param recipient The address receiving ETH
    function unwrapWETH(address recipient) external onlyOwner {
        uint256 balanceWETH = weth.balanceOf(address(this));

        weth.withdraw(balanceWETH);
        SafeTransferLib.safeTransferETH(recipient, address(this).balance);
    }

    /// @notice Transfer all ETH in this contract to the recipient. Can only be called by owner.
    /// @param recipient The recipient of the ETH
    function withdrawETH(address recipient) external onlyOwner {
        SafeTransferLib.safeTransferETH(recipient, address(this).balance);
    }

    /// @notice Necessary for this contract to receive ETH when calling unwrapWETH()
    receive() external payable {}
}
