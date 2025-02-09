import dotenv from "dotenv";
import { ethers } from "ethers";
import fetch from "node-fetch";

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
  "function transfer(address to, uint256 amount) public returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)"
];

const wpolAddress = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
const tpolAddress = "0x1Cd0cd01c8C902AdAb3430ae04b9ea32CB309CF1";
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

async function approveIfNeeded() {
  const allowance = await wpolContract.allowance(wallet.address, tpolAddress);
  if (allowance < ethers.parseEther("0.00015")) {
    console.log("Approving WPOL for swap...");
    const approveTx = await wpolContract.approve(tpolAddress, ethers.parseEther("10"));
    console.log("✅ Approval TX sent! Hash:", approveTx.hash);
    await approveTx.wait();
  } else {
    console.log("✅ WPOL sudah di-approve sebelumnya.");
  }
}

async function getWpolBalance() {
  const balance = await wpolContract.balanceOf(wallet.address);
  return ethers.formatEther(balance);
}

async function swapWpolToTpol() {
  let retries = 3;
  while (retries > 0) {
    try {
      const balance = await getWpolBalance();
      console.log(`💰 WPOL Balance: ${balance} WPOL`);
      if (parseFloat(balance) < 0.00015) {
        console.error("❌ Saldo WPOL tidak cukup!");
        return null;
      }

      console.log("Swapping WPOL to tPOL...");
      const swapTx = await wpolContract.transfer(tpolAddress, ethers.parseEther("0.00015"));
      console.log("✅ Swap TX sent! Hash:", swapTx.hash);
      await swapTx.wait();

      return swapTx.hash;
    } catch (error) {
      console.error(`❌ Error during swap, retrying... (${3 - retries + 1}/3)`);
      retries--;
      if (retries === 0) {
        console.error("❌ Gagal swap setelah 3 percobaan.");
        return null;
      }
    }
  }
}

async function sendToApi(hash) {
  try {
    const payload = {
      blockchainId: 137,
      type: 2,
      walletAddress: wallet.address,
      hash: hash,
      fromTokenAddress: wpolAddress,
      toTokenAddress: tpolAddress,
      fromTokenSymbol: "WPOL",
      toTokenSymbol: "tPOL",
      fromAmount: "150000000000000",
      toAmount: "150000000000000",
      gasFeeTokenAddress: tpolAddress,
      gasFeeTokenSymbol: "tPOL",
      gasFeeAmount: "500000000000000",
    };

    const response = await fetch(API_URL, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log("✅ API Response:", result);
  } catch (error) {
    console.error("❌ Error during API request:", error.message);
  }
}

async function main() {
  try {
    await approveIfNeeded();

    for (let i = 1; i <= 100000; i++) {
      console.log(`\n🔁 Loop ${i} of 100000`);
      
      const hash = await swapWpolToTpol();
      if (hash) {
        await sendToApi(hash);
      }

      console.log("🕐 Waiting 1 minute before next transaction...");
      await new Promise(resolve => setTimeout(resolve, 60000));
    }
  } catch (error) {
    console.error("❌ Error occurred:", error.message);
  }
}

main();
