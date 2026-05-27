export const blackoutMessengerAbi = [
  {
    type: "function",
    name: "sendMessage",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient", type: "address" },
      {
        name: "encryptedKeyPartA",
        type: "tuple",
        components: [
          { name: "ctHash", type: "uint256" },
          { name: "securityZone", type: "uint8" },
          { name: "utype", type: "uint8" },
          { name: "signature", type: "bytes" },
        ],
      },
      {
        name: "encryptedKeyPartB",
        type: "tuple",
        components: [
          { name: "ctHash", type: "uint256" },
          { name: "securityZone", type: "uint8" },
          { name: "utype", type: "uint8" },
          { name: "signature", type: "bytes" },
        ],
      },
      { name: "encryptedBody", type: "bytes" },
      { name: "iv", type: "bytes12" },
      { name: "bodyHash", type: "bytes32" },
    ],
    outputs: [{ name: "messageId", type: "uint256" }],
  },
  {
    type: "event",
    name: "MessageSent",
    anonymous: false,
    inputs: [
      { name: "messageId", type: "uint256", indexed: true },
      { name: "sender", type: "address", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "sentAt", type: "uint64", indexed: false },
      { name: "keyPartA", type: "bytes32", indexed: false },
      { name: "keyPartB", type: "bytes32", indexed: false },
      { name: "encryptedBody", type: "bytes", indexed: false },
      { name: "iv", type: "bytes12", indexed: false },
      { name: "bodyHash", type: "bytes32", indexed: false },
    ],
  },
] as const;
