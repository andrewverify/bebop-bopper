import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-foundry";

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  mocha: {
    timeout: 0,
  },
  networks: {
    hardhat: {
      forking: {
        url: "https://rpc.ankr.com/eth",
        enabled: true,
        
      },
      gas: 100000,
      gasPrice: 700441629

    }
  }
};

export default config;
