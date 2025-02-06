import dotenv from "dotenv";
import { ethers } from "ethers";
import fetch from "node-fetch";
import cfonts from "cfonts";
import chalk from 'chalk';

// Load environment variables
dotenv.config();

// Helper function to add delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  try {
    cfonts.say('NT Exhaust', {
      font: 'block',
      align: 'center',
      colors: ['cyan', 'magenta'],
      background: 'black',
      letterSpacing: 1,
      lineHeight: 1,
      space: true,
      maxLength: '0',
    });
    console.log(chalk.green("=== Telegram Channel : NT Exhaust ( @NTExhaust ) ==="));

    const privateKey = process.env.PRIVATE_KEY;
    const rpcUrl = process.env.RPC_URL;
    const API_URL = process.env.API_URL;
    
    const HEADERS = {
      "Accept": "application/json, text/plain, */*",
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 Edg/132.0.0.0",
      "Origin": "https://app.tea-fi.com",
      "Referer": "https://app.tea-fi.com/",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
    };

    if (!privateKey || !rpcUrl || !API_URL) {
      throw new Error("PRIVATE_KEY, RPC_URL, or API_URL is missing in the .env file.");
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log("Wallet address:", wallet.address);

    // Check wallet balance
    const balance = await provider.getBalance(wallet.address);
    console.log("Wallet Balance (in native token):", ethers.formatUnits(balance, "ether"));

    // Ensure balance is sufficient
    const amountToWrap = ethers.parseEther("0.00015");
    if (balance < amountToWrap) {
      throw new Error("Insufficient balance for the transaction.");
    }

    // Fetch current gas fee data
    const feeData = await provider.getFeeData();
    const doubledGasPrice = feeData.gasPrice * 2n; // Double the gas price
    console.log("Current Gas Price:", ethers.formatUnits(feeData.gasPrice, "gwei"), "Gwei");
    console.log("Doubled Gas Price:", ethers.formatUnits(doubledGasPrice, "gwei"), "Gwei");

    // WMATIC contract details
    const wmaticAbi = ["function deposit() public payable"];
    const wmaticAddress = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
    const wmaticContract = new ethers.Contract(wmaticAddress, wmaticAbi, wallet);

    const loops = 100000; // Define the number of loops here (can be modified manually)

    // Start looping through the transaction process
    for (let i = 1; i <= loops; i++) {
      console.log(`\n🔁 Loop ${i} of ${loops}`);
      let retry = true;

      while (retry) {
        try {
          // Wrap MATIC to WMATIC
          console.log("Wrapping MATIC to WMATIC...");
          const txResponse = await wmaticContract.deposit({
            value: amountToWrap,
            gasPrice: doubledGasPrice // Use doubled gas price
          });
          console.log("✅ Transaction sent! Hash:", txResponse.hash);

          const receipt = await txResponse.wait();
          console.log("✅ WMATIC wrapped successfully! Transaction Hash:", receipt.transactionHash);

          // Prepare API payload
          const payload = {
            blockchainId: 137,
            type: 2,
            walletAddress: wallet.address,
            hash: receipt.transactionHash,
            fromTokenAddress: "0x0000000000000000000000000000000000000000",
            toTokenAddress: "0x1Cd0cd01c8C902AdAb3430ae04b9ea32CB309CF1",
            fromTokenSymbol: "WPOL",
            toTokenSymbol: "tPOL",
            fromAmount: amountToWrap.toString(),
            toAmount: amountToWrap.toString(),
            gasFeeTokenAddress: "0x0000000000000000000000000000000000000000",
            gasFeeTokenSymbol: "POL",
            gasFeeAmount: doubledGasPrice.toString(), // Use doubled gas fee
          };

          // Send API request
          const response = await fetch(API_URL, {
            method: "POST",
            headers: HEADERS,
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ API Error: ${response.status} - ${errorText}`);
            retry = false;
          } else {
            const result = await response.json();
            console.log("✅ API Response:", result);
            retry = false;
          }
        } catch (error) {
          console.error(`❌ Error during transaction or API call:`, error.message);
          if (error.message.includes("Too many requests")) {
            console.log("⏳ Rate limit hit. Retrying in 1 minute...");
            await delay(60000);
          } else {
            retry = false;
          }
        }
      }

      console.log("🕒 Waiting 1 minute before next transaction...");
      await delay(60000);
    }

  } catch (error) {
    console.error("Error occurred:", error.reason || error.message);
  }
}

main();