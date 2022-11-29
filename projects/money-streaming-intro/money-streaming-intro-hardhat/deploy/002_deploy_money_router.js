const { Framework } = require("@superfluid-finance/sdk-core");
const fs = require('fs');
const path = require('path');

async function writeToFrontendFile(deployedAt) {
    //path relative to hardhat root
    fs.writeFileSync('./frontend/contracts/moneyRouter.json', JSON.stringify({"address": deployedAt}));
}


module.exports = async function ({ deployments }) {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const provider = new hre.ethers.providers.JsonRpcProvider(
        process.env.GOERLI_URL
    )

    const sf = await Framework.create({
        chainId: (await provider.getNetwork()).chainId,
        provider
    })


    const signers = await ethers.getSigners()
    // We get the contract to deploy


    const deployed = await deploy('MoneyRouter', {
        from: deployer,
        args: [sf.settings.config.hostAddress, signers[0].address]
    });

    await writeToFrontendFile(deployed.address);

};
module.exports.tags = ['MoneyRouter'];