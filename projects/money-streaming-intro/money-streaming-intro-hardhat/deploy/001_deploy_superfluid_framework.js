const { expect } = require("chai")
const { Framework } = require("@superfluid-finance/sdk-core")
const { ethers } = require("hardhat")
const frameworkDeployer = require("@superfluid-finance/ethereum-contracts/scripts/deploy-test-framework")
const TestToken = require("@superfluid-finance/ethereum-contracts/build/contracts/TestToken.json")

const thousandEther = ethers.utils.parseEther("10000")

module.exports = async function ({ deployments }) {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const provider = new hre.ethers.providers.JsonRpcProvider(
        process.env.GOERLI_URL
    );

    [owner, account1, account2] = await ethers.getSigners();

    const sfDeployer = await frameworkDeployer.deployTestFramework();

    // GETTING SUPERFLUID FRAMEWORK SET UP

    // deploy the framework locally
    const contractsFramework = await sfDeployer.getFramework();

    // initialize framework
    sf = await Framework.create({
        chainId: (await provider.getNetwork()).chainId,
        provider: owner.provider,
        resolverAddress: contractsFramework.resolver, // (empty)
        protocolReleaseVersion: "test"
    });

    console.log('sf', sf);

    // DEPLOYING DAI and DAI wrapper super token
    tokenDeployment = await sfDeployer.deployWrapperSuperToken(
        "Fake DAI Token",
        "fDAI",
        18,
        ethers.utils.parseEther("100000000").toString()
    );


};
module.exports.tags = ['Framework'];