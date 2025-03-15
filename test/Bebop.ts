import {
  time,
  loadFixture,
  impersonateAccount,
  setBalance,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import hre from "hardhat";
import { ResolvedOrderStruct } from "../typechain-types/src/interfaces/IProtocolFeeController";
import { getBytes, parseEther, parseUnits, solidityPackedKeccak256, ZeroAddress, zeroPadBytes } from "ethers";
import { parse } from "path";
import axios from "axios";


describe("Bebop", function () {
  

  /*

  What does this test do:

  - Deploys Permit2, A Reactor, and the Bebop Executor
  - Fetches an encoded transaction from the Bebop Quote API, and passes it to the Bebop Executor
  - Signs a permit2 signature for a fake user
  - Bebop executor calls reactor with the encoded bebop tx and permit2 order
  - Reactor validates order and calls the reactorcallback on executor, after transferring input tokens to executor
  - Executor calls Bebop for the swap, with the executor as receipient
  - Reactor grabs the funds from executor and forwards it to user
  - Balances are verified post calls

  */

  async function deployBebopFixture() {
  

    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await hre.ethers.getSigners();

    const permit2 = await hre.ethers.getContractAt("IPermit2","0x000000000022d473030f116ddee9f6b43ac78ba3");
    
    
    const DutchReactor = await hre.ethers.getContractFactory("DutchOrderReactor");
    const dutchReactor = await DutchReactor.deploy("0x000000000022d473030f116ddee9f6b43ac78ba3",owner.address);

    const BebopExecutor = await hre.ethers.getContractFactory("BebopExecutor");
    const bebopExecutor = await BebopExecutor.deploy(owner, await dutchReactor.getAddress(),owner);

    await impersonateAccount(await dutchReactor.getAddress());
    const pretendReactor = await hre.ethers.getSigner(await dutchReactor.getAddress());

    const weth = await hre.ethers.getContractAt("WETH","0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");


    return { owner, pretendReactor,  weth, permit2, dutchReactor, bebopExecutor};
  }

  describe("Feature testing", function () {
    it("reactorCallback", async function () {
      const { owner, pretendReactor, weth, permit2, dutchReactor, bebopExecutor } = await loadFixture(deployBebopFixture);
     console.log(`Bebop Executor: ${await bebopExecutor.getAddress()}`);

      const buyTokens = ["0xdAC17F958D2ee523a2206206994597C13D831ec7"] // USDT
      const sellTokens = ["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"] // WETH
      const totalAmount = 150000000000000000n
      const buyAmount = 100000000000;

      let response;
      await setBalance(owner.address,totalAmount);
      // // give 1 ETH to executor
      // await setBalance(await dutchReactor.getAddress(), parseEther("1"));
      // await setBalance(await bebopExecutor.getAddress(), parseEther("1"));

      // await setBalance(await pretendReactor.getAddress(), parseEther("1"));
      await weth.deposit({value: buyAmount});
      await weth.transfer(await bebopExecutor.getAddress(),buyAmount);
      const USDT = await hre.ethers.getContractAt("ERC20",buyTokens[0]);

      const feeData = await owner.provider.getFeeData();
      console.log(feeData);


      // get bebop quote
      try {
        response = await (await axios.get(`https://api.bebop.xyz/pmm/ethereum/v3/quote`, {
          params: {
              buy_tokens: buyTokens.toString(),
              sell_tokens: sellTokens.toString(),
              sell_amounts: buyAmount.toString(),
              taker_address: await bebopExecutor.getAddress(),
              receiver_address: "0x5Bad996643a924De21b6b2875c85C33F3c5bBcB6",
              gasless: false,
              skip_validation: true
              
          }
      })).data
      }
      catch (error) {
        console.log(error);
      }
      console.log(response);
      
   

    //remove the function selector from the calldata provided by Bebop API
    // leaving only the arguments for the bebop.singleSwap function
    const calldata = "0x" + response.tx.data.slice(10);
    console.log(calldata);



      
      // mint some ETH and WETH for the owner address
      await setBalance(await dutchReactor.getAddress(),parseEther("2"));

      const resolved: ResolvedOrderStruct[] = [
        {
          info: {
            reactor: await dutchReactor.getAddress(),
            // dutch reactor takes this in seconds NOT milliseconds
            // 1000 seconds from now
            deadline: Math.floor(Date.now() / 1000) + 1000,
            nonce: 1,
            swapper: owner.address,
            additionalValidationContract: ZeroAddress,
            additionalValidationData: "0x00"


          },
          input: {
            token: sellTokens[0],
            amount: buyAmount,
            maxAmount: buyAmount

          },
          outputs: [
            {
              amount: parseEther("1"),
              token: buyTokens[0],
              recipient: owner.address
            }
          ],
          sig: "0x1234",
          hash: solidityPackedKeccak256(["uint"],[1])
        }
      ]

      await bebopExecutor.connect(pretendReactor).reactorCallback(resolved,calldata,{maxFeePerGas: feeData.maxFeePerGas, maxPriorityFeePerGas: feeData.maxPriorityFeePerGas});
      console.log(await USDT.balanceOf(await dutchReactor.getAddress()));
      
      
    });

    
  });

});
