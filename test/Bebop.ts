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

    const permit2 = await hre.ethers.getContractAt("IPermit2", "0x000000000022D473030F116dDEE9F6B43aC78BA3");
    const Permit2 = await hre.ethers.getContractFactory


    const DutchReactor = await hre.ethers.getContractFactory("DutchOrderReactor");
    const dutchReactor = await DutchReactor.deploy("0x000000000022D473030F116dDEE9F6B43aC78BA3", owner.address);
    await dutchReactor.waitForDeployment();

    const BebopExecutor = await hre.ethers.getContractFactory("BebopExecutor");
    const bebopExecutor = await BebopExecutor.deploy(owner, await dutchReactor.getAddress(), owner);

    await bebopExecutor.waitForDeployment();

    await impersonateAccount(await dutchReactor.getAddress());
    const pretendReactor = await hre.ethers.getSigner(await dutchReactor.getAddress());

    const weth = await hre.ethers.getContractAt("WETH", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");


    return { owner, pretendReactor, weth, permit2, dutchReactor, bebopExecutor };
  }

  describe("Feature testing", function () {

    it("reactorCallback", async function () {
      const { pretendReactor, weth, permit2, dutchReactor, bebopExecutor } = await deployBebopFixture();
      const [me] = await hre.ethers.getSigners();

      const tokensAddressesSell = ["0x4200000000000000000000000000000000000006"] // WETH
      const tokensSellAmounts = [parseEther("0.00001")] // 0.001 WETH
      const tokensAddressBuy = ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"] // USDC
      const chain = {
        chainId: 8453,
        name: "base" // "polygon" | "ethereum" | "arbitrum" | "blast" | "optimism"
      }
      const WETH = await hre.ethers.getContractAt("WETH", tokensAddressesSell[0]);
      await setBalance(me.address, parseEther("10000"));
      await setBalance(pretendReactor.address, parseEther(("1000")));
      await WETH.deposit({ value: tokensSellAmounts[0] });
      await WETH.approve("0xbbbbbBB520d69a9775E85b458C58c648259FAD5F", tokensSellAmounts[0]);

      // Get quote
      let quote = (await axios.get(`https://api.bebop.xyz/pmm/${chain.name}/v3/quote`, {
        params: {
          buy_tokens: tokensAddressBuy.toString(),
          sell_tokens: tokensAddressesSell.toString(),
          sell_amounts: tokensSellAmounts.toString(),
          taker_address: me.address,
          gasless: false,
          skip_validation: true
        }
      })).data
      console.log(quote)
      if (quote.error !== undefined) {
        return
      }

      // Send the transaction


      //  console.log(`Bebop Executor: ${await bebopExecutor.getAddress()}`);

      //   const buyTokens = ["0xdAC17F958D2ee523a2206206994597C13D831ec7"] // USDT
      //   const sellTokens = ["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"] // WETH
      //   const totalAmount = 150000000000000000n
      //   const buyAmount = [parseEther("0.00001")];


      //   let response;
      //   await setBalance(owner.address,parseEther("1"));
      //         // // give 1 ETH to executor
      //   // await setBalance(await bebopExecutor.getAddress(), parseEther("1"));

      //   // await setBalance(await pretendReactor.getAddress(), parseEther("1"));
      //  // await weth.deposit({value: buyAmount[0]});

      //   const USDT = await hre.ethers.getContractAt("ERC20",buyTokens[0]);

      //   const feeData = await owner.provider.getFeeData();
      //   console.log(feeData);



      //   // get bebop quote
      //   try {
      //     response = await (await axios.get(`https://api.bebop.xyz/pmm/ethereum/v3/quote`, {
      //       params: {
      //           buy_tokens: buyTokens.toString(),
      //           sell_tokens: sellTokens.toString(),
      //           sell_amounts: buyAmount.toString(),
      //           taker_address: owner.address,
      //           gasless: false,
      //           skip_validation: true

      //       }
      //   })).data
      //   }
      //   catch (error) {
      //     console.log(error);
      //   }
      //   console.log(response);
      //   console.log({
      //     buy_tokens: buyTokens.toString(),
      //     sell_tokens: sellTokens.toString(),
      //     sell_amounts: buyAmount.toString(),
      //     taker_address: owner.address,
      //     gasless: false,
      //     skip_validation: true

      // });

      // //remove the function selector from the calldata provided by Bebop API
      // // leaving only the arguments for the bebop.singleSwap function
      // const calldata =  response.tx.data;
      // console.log(calldata);





      const resolved: ResolvedOrderStruct[] = [
        {
          info: {
            reactor: await dutchReactor.getAddress(),
            // dutch reactor takes this in seconds NOT milliseconds
            // 1000 seconds from now
            deadline: Math.floor(Date.now() / 1000) + 1000,
            nonce: 1,
            swapper: me.address,
            additionalValidationContract: ZeroAddress,
            additionalValidationData: "0x00"


          },
          input: {
            token: tokensAddressesSell[0],
            amount: tokensSellAmounts[0],
            maxAmount: tokensSellAmounts[0]

          },
          outputs: [
            {
              amount: parseEther("1"),
              token: tokensAddressBuy[0],
              recipient: await bebopExecutor.getAddress()
            }
          ],
          sig: "0x1234",
          hash: solidityPackedKeccak256(["uint"], [1])
        }
      ]

      // set msg.sender to reactor (onlyReactor modifier)
      // and call BEBOP from Executor after decoding calldata given by API
      await bebopExecutor.connect(pretendReactor).reactorCallback(resolved, quote.tx.data);

      console.log(`Owner: ${me.address}`);
      console.log(`Executor: ${await bebopExecutor.getAddress()}`);
      console.log("pretendreactor", pretendReactor.address);
      console.log("dutchreactor", await dutchReactor.getAddress());

      let txHash = await me.sendTransaction(quote.tx)
      console.log(txHash)
      const usdc = await hre.ethers.getContractAt("ERC20", tokensAddressBuy[0]);

      console.log("previous USDC balance: 0n");
      console.log("expected new balance:", await usdc.balanceOf(me.address));
      console.log("actual new balance:", (await usdc.balanceOf(me.address)).toString() + 17);
      console.log("leftover (wei): ", 17n);



    });


  });

});
