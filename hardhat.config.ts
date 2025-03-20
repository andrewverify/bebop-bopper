import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-foundry";
import "hardhat-tracer";

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  mocha: {
    timeout: 0,
  },
  networks: {
    hardhat: {
      forking: {
        url: "https://base-mainnet.infura.io/v3/100a0970864f4dde865358262e3d5bb4",
        enabled: true,
        
      },
      chainId: 8453

    }
  }
};

export default config;
