import dotenv from "dotenv";
import { ethers } from "ethers";
import fetch from "node-fetch";
import cfonts from "cfonts";
import chalk from'chalk';
// Load environment variables
dotenv.config();

// Helper function to add delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  try {
    cfonts.say('NT Exhaust', {
      font: 'block',        // Options: 'block', 'simple', '3d', etc.
      align: 'center',
      colors: ['cyan', 'magenta'],
      background: 'black',
      letterSpacing: 1,
      lineHeight: 1,
      space: true,
      maxLength: '0',
    });
  console.log(chalk.green("=== Telegram Channel : NT Exhaust ( @NTExhaust ) ==="))
    const privateKey = process.env.PRIVATE_KEY;
    const rpcUrl = process.env.RPC_URL;
    const API_URL = process.env.API_URL;
    const HEADERS = {
      "Accept": "application/json, text/plain, */*",
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 Edg/132.0.0.0",
      "Origin": "https://app.tea-fi.com", // Spoofing Origin to match allowed
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
    console.log("Wallet Balance (in MATIC):", ethers.formatUnits(balance, "ether"));

    // Ensure balance is sufficient
    const amountToWrap = ethers.parseEther("0.00015");
    if (balance < amountToWrap) {
      throw new Error("Insufficient MATIC balance for the transaction.");
    }

    // WMATIC contract details
    const wmaticAbi = ["function deposit() public payable"];
    const wmaticAddress = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
    const wmaticContract = new ethers.Contract(wmaticAddress, wmaticAbi, wallet);

    const loops = 100000;  // Define the number of loops here (can be modified manually)

    // Start looping through the transaction process
    for (let i = 1; i <= loops; i++) {
      console.log(`\n🔁 Loop ${i} of ${loops}`);
      let retry = true;

      while (retry) {
        try {
          // Wrap MATIC to WMATIC
          console.log("Wrapping MATIC to WMATIC...");
          const txResponse = await wmaticContract.deposit({ value: amountToWrap });
          console.log("✅ Transaction sent! Hash:", txResponse.hash);

          const receipt = await txResponse.wait();
          const lastTransactionHash = receipt.transactionHash;
          console.log("✅ WMATIC wrapped successfully! Transaction Hash:", txResponse.hash);

          // Prepare API payload
          const payload = {
            blockchainId: 137,
            type: 2,
            walletAddress: wallet.address,
            hash: txResponse.hash,
            fromTokenAddress: "0x0000000000000000000000000000000000000000",
            toTokenAddress: "0x1Cd0cd01c8C902AdAb3430ae04b9ea32CB309CF1",
            fromTokenSymbol: "WPOL",
            toTokenSymbol: "tPOL",
            fromAmount: "150000000000000",
            toAmount: "150000000000000",
            gasFeeTokenAddress: "0x0000000000000000000000000000000000000000",
            gasFeeTokenSymbol: "POL",
            gasFeeAmount: "8055000012888000",
          };

          // Send API request
          const response = await fetch(API_URL, {
            method: "POST",
            headers: HEADERS,
            body: JSON.stringify(payload),
          });

          // Check if the response is OK (status code 200)
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ API Error: ${response.status} - ${errorText}`);
            retry = false;
          } else {
            const result = await response.json();
            console.log("✅ API Response:", result);
            retry = false; // Stop retrying if successful
          }
        } catch (error) {
          console.error(`❌ Error during transaction or API call:`, error.message);

          // Check for rate limit error
          if (error.message.includes("Too many requests")) {
            console.log("⏳ Rate limit hit. Retrying in 1 minutes...");
            await delay(60000); // Wait for 10 minutes
          } else {
            retry = false; // Stop retrying for other errors
          }
        }
      }

      console.log("🕐 Waiting 1 minute before next transaction...");
      await delay(2000); // Delay 60 seconds between each loop
    }

  } catch (error) {
    console.error("Error occurred:", error.reason || error.message);
  }
}

main();

