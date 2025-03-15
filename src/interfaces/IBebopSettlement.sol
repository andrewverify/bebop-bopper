// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

struct Single {
        uint256 expiry;
        address taker_address;
        address maker_address;
        uint256 maker_nonce;
        address taker_token;
        address maker_token;
        uint256 taker_amount;
        uint256 maker_amount;
        address receiver;
        uint256 packed_commands;
        uint256 flags; // `hashSingleOrder` doesn't use this field for SingleOrder hash
}
struct MakerSignature {
        bytes signatureBytes;
        uint256 flags;
}

interface IBebopSettlement {

    event BebopOrder(uint128 indexed eventId);

    /// @notice Taker execution of one-to-one trade with one maker
    /// @param order Single order struct
    /// @param makerSignature Maker's signature for SingleOrder
    /// @param filledTakerAmount Partially filled taker amount, 0 for full fill
    function swapSingle(
        Single calldata order,
        MakerSignature calldata makerSignature,
        uint256 filledTakerAmount
    ) external payable;

  

}