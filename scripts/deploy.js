const fs = require("fs");
const hre = require("hardhat");

async function main() {
    const Produce = await hre.ethers.getContractFactory("ProduceTracker");
    const produce = await Produce.deploy();
    await produce.deployed();
    console.log("Address", produce.address);
    const artifact = await hre.artifacts.readArtifact("ProduceTracker");
    const out = {
        address: produce.address,
        abi: artifact.abi
    };

    const publicDir = "./public";
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);

    fs.writeFileSync(`${publicDir}/contract.json`, JSON.stringify(out, null, 2));
    console.log("Wrote contract.json to public/contract.json");
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
});
