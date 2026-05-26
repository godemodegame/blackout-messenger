// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";

contract BlackoutMessenger {
    uint256 public constant MAX_BODY_BYTES = 4096;

    struct MessageKey {
        euint128 partA;
        euint128 partB;
    }

    uint256 public nextMessageId = 1;
    mapping(uint256 => MessageKey) private messageKeys;

    event MessageSent(
        uint256 indexed messageId,
        address indexed sender,
        address indexed recipient,
        uint64 sentAt,
        euint128 keyPartA,
        euint128 keyPartB,
        bytes encryptedBody,
        bytes12 iv,
        bytes32 bodyHash
    );

    error InvalidRecipient();
    error EmptyBody();
    error BodyTooLarge();
    error InvalidBodyHash();
    error UnknownMessage();

    function sendMessage(
        address recipient,
        InEuint128 memory encryptedKeyPartA,
        InEuint128 memory encryptedKeyPartB,
        bytes calldata encryptedBody,
        bytes12 iv,
        bytes32 bodyHash
    ) external returns (uint256 messageId) {
        if (recipient == address(0)) revert InvalidRecipient();
        if (encryptedBody.length == 0) revert EmptyBody();
        if (encryptedBody.length > MAX_BODY_BYTES) revert BodyTooLarge();
        if (bodyHash == bytes32(0)) revert InvalidBodyHash();

        euint128 keyPartA = FHE.asEuint128(encryptedKeyPartA);
        euint128 keyPartB = FHE.asEuint128(encryptedKeyPartB);

        FHE.allowThis(keyPartA);
        FHE.allowThis(keyPartB);
        FHE.allow(keyPartA, msg.sender);
        FHE.allow(keyPartB, msg.sender);
        FHE.allow(keyPartA, recipient);
        FHE.allow(keyPartB, recipient);

        messageId = nextMessageId++;
        messageKeys[messageId] = MessageKey({
            partA: keyPartA,
            partB: keyPartB
        });

        emit MessageSent(
            messageId,
            msg.sender,
            recipient,
            uint64(block.timestamp),
            keyPartA,
            keyPartB,
            encryptedBody,
            iv,
            bodyHash
        );
    }

    function getKeyHandles(uint256 messageId) external view returns (euint128 keyPartA, euint128 keyPartB) {
        if (messageId == 0 || messageId >= nextMessageId) revert UnknownMessage();
        MessageKey storage messageKey = messageKeys[messageId];
        return (messageKey.partA, messageKey.partB);
    }
}
