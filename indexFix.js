import dotenv from "dotenv";
import { ethers } from "ethers";
import fetch from "node-fetch";
import cfonts from "cfonts";
import chalk from "chalk";

dotenv.config();

const privateKey = process.env.PRIVATE_KEY;
const rpcUrl = process.env.RPC_URL;
const API_URL = process.env.API_URL;

if (!privateKey || !rpcUrl || !API_URL) {
  throw new Error("PRIVATE_KEY, RPC_URL, atau API_URL tidak ditemukan di .env");
}

const provider = new ethers.JsonRpcProvider(rpcUrl);
const wallet = new ethers.Wallet(privateKey, provider);

const wpolAbi = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function transfer(address to, uint256 amount) public returns (bool)"
];

const wpolAddress = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
const twpolAddress = "0x1Cd0cd01c8C902AdAb3430ae04b9ea32CB309CF1";
const wpolContract = new ethers.Contract(wpolAddress, wpolAbi, wallet);

const HEADERS = {
  "Accept": "application/json, text/plain, */*",
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0",
  "Origin": "https://app.tea-fi.com",
  "Referer": "https://app.tea-fi.com/",
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-site",
};

async function main() {
  try {
    console.log("Approving WPOL for swap (once)...");
    const approveTx = await wpolContract.approve(twpolAddress, ethers.parseEther("10"));
    console.log("✅ Approval TX sent! Hash:", approveTx.hash);
    await approveTx.wait();

    for (let i = 1; i <= 100000; i++) {
      console.log(`\n🔁 Loop ${i} of 100000`);
      try {
        console.log("Swapping WPOL to tPOL...");
        const swapTx = await wpolContract.transfer(twpolAddress, ethers.parseEther("0.00015"));
        console.log("✅ Swap TX sent! Hash:", swapTx.hash);
        await swapTx.wait();

        // 🔥 Kirim data ke API Tea-Fi
        const payload = {
          blockchainId: 137,
          type: 2,
          walletAddress: wallet.address,
          hash: swapTx.hash,
          fromTokenAddress: wpolAddress,
          toTokenAddress: twpolAddress,
          fromTokenSymbol: "WPOL",
          toTokenSymbol: "tPOL",
          fromAmount: "150000000000000",
          toAmount: "150000000000000",
          gasFeeTokenAddress: "0x0000000000000000000000000000000000000000",
          gasFeeTokenSymbol: "POL",
          gasFeeAmount: "8055000012888000",
        };

        const response = await fetch(API_URL, {
          method: "POST",
          headers: HEADERS,
          body: JSON.stringify(payload),
        });

        const result = await response.json();
        console.log("✅ API Response:", result);

      } catch (error) {
        console.error("❌ Error during swap or API request:", error.message);
      }

      console.log("🕐 Waiting 1 minute before next transaction...");
      await new Promise(resolve => setTimeout(resolve, 60000));
    }
  } catch (error) {
    console.error("❌ Error occurred:", error.message);
  }
}
main();
