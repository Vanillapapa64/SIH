// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ProduceTracker {
    struct Produce {
        address owner;
        string description;
        uint256 eventCount;
        bool exists;
    }

    mapping(uint256 => Produce) public produces;
    mapping(uint256 => mapping(address => bool)) public participants;

    event ProduceRegistered(uint256 indexed produceId, address indexed farmer, string initialHash);
    event EventAdded(uint256 indexed produceId, address indexed by, string hash);
    event ParticipantAuthorized(uint256 indexed produceId, address indexed participant);
    event ParticipantRevoked(uint256 indexed produceId, address indexed participant);

    modifier onlyOwner(uint256 produceId) {
        require(produces[produceId].exists, "Produce does not exist");
        require(produces[produceId].owner == msg.sender, "Only owner allowed");
        _;
    }

    modifier onlyAuthorized(uint256 produceId) {
        require(produces[produceId].exists, "Produce does not exist");
        if (msg.sender == produces[produceId].owner) {
            _;
            return;
        }
        require(participants[produceId][msg.sender], "Not authorized to add events");
        _;
    }

    function registerProduce(
        uint256 produceId,
        string calldata description,
        string calldata initialHash
    ) external {
        require(!produces[produceId].exists, "Produce already registered");
        require(bytes(initialHash).length > 0, "Initial hash required");

        produces[produceId] = Produce({
            owner: msg.sender,
            description: description,
            eventCount: 1,
            exists: true
        });

        emit ProduceRegistered(produceId, msg.sender, initialHash);
        emit EventAdded(produceId, msg.sender, initialHash);
    }

    function authorizeParticipant(uint256 produceId, address participant) external onlyOwner(produceId) {
        require(participant != address(0), "Invalid participant");
        participants[produceId][participant] = true;
        emit ParticipantAuthorized(produceId, participant);
    }

    function revokeParticipant(uint256 produceId, address participant) external onlyOwner(produceId) {
        require(participants[produceId][participant], "Participant not authorized");
        participants[produceId][participant] = false;
        emit ParticipantRevoked(produceId, participant);
    }

    function addEvent(uint256 produceId, string calldata hash) external onlyAuthorized(produceId) {
        require(bytes(hash).length > 0, "Hash required");
        produces[produceId].eventCount += 1;
        emit EventAdded(produceId, msg.sender, hash);
    }

    function getOwner(uint256 produceId) external view returns (address) {
        require(produces[produceId].exists, "Produce does not exist");
        return produces[produceId].owner;
    }

    function getDescription(uint256 produceId) external view returns (string memory) {
        require(produces[produceId].exists, "Produce does not exist");
        return produces[produceId].description;
    }

    function getEventCount(uint256 produceId) external view returns (uint256) {
        require(produces[produceId].exists, "Produce does not exist");
        return produces[produceId].eventCount;
    }

    function isAuthorized(uint256 produceId, address participant) external view returns (bool) {
        if (!produces[produceId].exists) return false;
        if (produces[produceId].owner == participant) return true;
        return participants[produceId][participant];
    }
}
