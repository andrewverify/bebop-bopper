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

    function swapSingleFromContract(
        Single calldata order,
        MakerSignature calldata makerSignature
    ) external payable;

  

}
