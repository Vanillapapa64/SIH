//@ts-ignore

"use client";
import { useEffect, useState, FormEvent } from "react";
import { ethers } from "ethers";

// Extend the Window interface to include ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

// Define types for contract.json
interface ContractInfo {
  address: string;
  abi: any;
}

// Define a log type
interface EventLog {
  produceId: string;
  by: string;
  hash: string;
  tx: string;
}

export default function Home() {
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null);
  const [logs, setLogs] = useState<EventLog[]>([]);
  const [account, setAccount] = useState<string | null>(null);

  useEffect(() => {
    fetch("/contract.json")
      .then((r) => r.json())
      .then((data: ContractInfo) => setContractInfo(data))
      .catch(() => console.warn("contract.json not found in public folder"));
  }, []);

  async function connectWallet() {
  if (typeof window === "undefined" || typeof window.ethereum === "undefined") {
    alert("Install MetaMask and ensure it's running.");
    return;
  }

  const targetChainIdDec = 31337;
  const targetChainIdHex = "0x7a69"; // 31337 in hex

  try {
    // 1) Ask MetaMask for account access
    const web3Provider = new ethers.providers.Web3Provider(window.ethereum, "any");
    await web3Provider.send("eth_requestAccounts", []);
    let signer = web3Provider.getSigner();
    const acc = await signer.getAddress();

    // 2) Check current chain
    let network = await web3Provider.getNetwork();
    if (network.chainId !== targetChainIdDec) {
      // try to switch MetaMask to local Hardhat chain
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: targetChainIdHex }],
        });
        // recreate provider & signer after switch
        const switchedProvider = new ethers.providers.Web3Provider(window.ethereum, "any");
        signer = switchedProvider.getSigner();
      } catch (switchErr: any) {
        // If the chain is not added in MetaMask, wallet_switchEthereumChain throws error.code === 4902
        if (switchErr?.code === 4902) {
          // Try to add the Hardhat network (RPC must be reachable)
          try {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: targetChainIdHex,
                  chainName: "Hardhat Local",
                  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
                  rpcUrls: ["http://127.0.0.1:8545"],
                  blockExplorerUrls: [],
                },
              ],
            });
            // recreate provider & signer after adding
            const addedProvider = new ethers.providers.Web3Provider(window.ethereum, "any");
            signer = addedProvider.getSigner();
          } catch (addErr: any) {
            console.error("Failed to add Hardhat network:", addErr);
            alert("Please switch MetaMask network to your local Hardhat network (RPC: http://127.0.0.1:8545).");
            return;
          }
        } else {
          console.error("Failed to switch network:", switchErr);
          alert("Please switch MetaMask to the local Hardhat network (chainId 31337).");
          return;
        }
      }
    }

    // 3) Recreate provider and signer (current)
    const provider = new ethers.providers.Web3Provider(window.ethereum, "any");
    const currentSigner = provider.getSigner();

    // 4) Set state
    setProvider(provider);
    setSigner(currentSigner);
    setAccount(acc);

    // 5) Attach contract if contractInfo exists
    if (!contractInfo) {
      console.warn("contract.json missing — contract will not be attached.");
      return;
    }

    // If previous contract existed, remove listeners to avoid duplicates
    if ((contract as any)?.removeAllListeners) {
      (contract as any).removeAllListeners("EventAdded");
    }

    const c = new ethers.Contract(contractInfo.address, contractInfo.abi, currentSigner);
    setContract(c);

    // listen for EventAdded (avoid duplicate listeners, removed above)
    c.on("EventAdded", (produceId: ethers.BigNumber, by: string, hash: string, ev: any) => {
      setLogs((prev) => [
        {
          produceId: produceId.toString(),
          by,
          hash,
          tx: ev.transactionHash,
        },
        ...prev,
      ]);
    });

    // Optional: show user success
    console.info("Connected", acc, "on chainId", (await provider.getNetwork()).chainId);
  } catch (err: any) {
    console.error("connectWallet failed:", err);
    alert(err?.message ?? "Failed to connect wallet");
  }
}


  function computeHash(obj: Record<string, unknown>): string {
    const json = JSON.stringify(obj);
    return ethers.utils.sha256(ethers.utils.toUtf8Bytes(json));
  }

  async function registerProduce(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!contract) return;

    const form = new FormData(e.currentTarget);
    const id = form.get("produceId") as string;
    const desc = form.get("description") as string;
    const farmerName = form.get("farmerName") as string;
    const location = form.get("location") as string;
    const price = form.get("price") as string;

    const record = { farmerName, location, price, timestamp: Date.now() };
    const initialHash = computeHash(record);

    const tx = await contract.registerProduce(
      ethers.BigNumber.from(id),
      desc,
      initialHash
    );
    await tx.wait();
    alert("Produce registered (initialHash emitted).");
  }

  async function authorizeParticipant(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!contract) return;

    const form = new FormData(e.currentTarget);
    const id = form.get("authProduceId") as string;
    const participant = form.get("participant") as string;
    console.log("before")
    const tx = await contract.authorizeParticipant(ethers.BigNumber.from(id), participant);
    await tx.wait();
    console.log("after")
    alert("Authorized participant");
  }

  async function addEvent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!contract) return;

    const form = new FormData(e.currentTarget);
    const id = form.get("evtProduceId") as string;
    const actor = form.get("actor") as string;
    const notes = form.get("notes") as string;

    const record = { actor, notes, timestamp: Date.now() };
    const hash = computeHash(record);

    const tx = await contract.addEvent(ethers.BigNumber.from(id), hash);
    await tx.wait();
    alert("Event added (hash emitted).");
  }

  async function fetchMeta(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!contract) return;

    const form = new FormData(e.currentTarget);
    const id = form.get("metaId") as string;

    try {
      const owner = await contract.getOwner(ethers.BigNumber.from(id));
      const desc = await contract.getDescription(ethers.BigNumber.from(id));
      const count = (await contract.getEventCount(ethers.BigNumber.from(id))).toString();
      alert(`Owner: ${owner}\nDescription: ${desc}\nEventCount: ${count}`);
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Produce Tracker — Local Prototype</h1>
      <p>Account: {account ?? "Not connected"}</p>
      <button onClick={connectWallet}>Connect Wallet (MetaMask)</button>

      <hr />

      <h2>Register Produce (farmer)</h2>
      <form onSubmit={registerProduce}>
        <input name="produceId" placeholder="produceId (e.g. 1)" required />
        <input name="description" placeholder="description" required />
        <input name="farmerName" placeholder="farmer name" required />
        <input name="location" placeholder="location" required />
        <input name="price" placeholder="price" />
        <button type="submit">Register</button>
      </form>

      <h2>Authorize Participant (farmer)</h2>
      <form onSubmit={authorizeParticipant}>
        <input name="authProduceId" placeholder="produceId" required />
        <input name="participant" placeholder="participant address" required />
        <button type="submit">Authorize</button>
      </form>

      <h2>Add Event (authorized)</h2>
      <form onSubmit={addEvent}>
        <input name="evtProduceId" placeholder="produceId" required />
        <input name="actor" placeholder="actor name (for record)" />
        <input name="notes" placeholder="notes" />
        <button type="submit">Add Event</button>
      </form>

      <h2>Get Produce Meta</h2>
      <form onSubmit={fetchMeta}>
        <input name="metaId" placeholder="produceId" />
        <button type="submit">Fetch</button>
      </form>

      <h2>Recent on-chain EventAdded logs</h2>
      <ul>
        {logs.map((l, i) => (
          <li key={i}>
            produceId: {l.produceId} by: {l.by} hash: {l.hash} tx: {l.tx}
          </li>
        ))}
      </ul>
    </div>
  );
}
