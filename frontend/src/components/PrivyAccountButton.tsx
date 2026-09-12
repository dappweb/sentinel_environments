import { useLogin, usePrivy, useWallets } from "@privy-io/react-auth";
import { useEffect, useState } from "react";

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID as string | undefined;

interface PrivyAccountButtonProps {
  className?: string;
  onUnavailable?: () => void;
}

function ConfiguredPrivyAccountButton({ className = "" }: PrivyAccountButtonProps) {
  const { ready, authenticated, logout, getAccessToken } = usePrivy();
  const { login } = useLogin();
  const { wallets } = useWallets();
  const [walletStatus, setWalletStatus] = useState<"idle" | "syncing" | "synced" | "error">("idle");

  useEffect(() => {
    if (!authenticated || wallets.length === 0) {
      setWalletStatus("idle");
      return;
    }
    let cancelled = false;
    setWalletStatus("syncing");
    void (async () => {
      const token = await getAccessToken();
      if (!token || cancelled) {
        if (!cancelled) setWalletStatus("error");
        return;
      }
      const wallet = wallets[0];
      const chainId = Number(wallet.chainId?.split(":").pop() ?? 0);
      const response = await fetch("/api/account/wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "same-origin",
        body: JSON.stringify({ address: wallet.address, chain_id: chainId }),
      }).catch(() => null);
      if (!cancelled) setWalletStatus(response?.ok ? "synced" : "error");
    })();
    return () => { cancelled = true; };
  }, [authenticated, wallets, getAccessToken]);

  if (!ready) {
    return (
      <button type="button" disabled className={`${className} cursor-wait opacity-60`}>
        Loading…
      </button>
    );
  }

  if (authenticated) {
    return (
      <span className="inline-flex items-center gap-2">
        {wallets.length > 0 && (
          <span className="hidden text-xs opacity-70 md:inline" title={wallets[0].address}>
            {walletStatus === "error" ? "Wallet sync failed" : walletStatus === "syncing" ? "Syncing wallet…" : "Wallet bound"}
          </span>
        )}
        <button type="button" onClick={() => void logout()} className={className}>Log out</button>
      </span>
    );
  }

  return (
    <button type="button" onClick={login} className={className}>
      Log in
    </button>
  );
}

export default function PrivyAccountButton({ className = "", onUnavailable }: PrivyAccountButtonProps) {
  if (import.meta.env.VITE_PUBLIC_READONLY === "true" && import.meta.env.VITE_PRIVY_ENABLED !== "true") {
    return <button type="button" disabled className={`${className} opacity-60`} title="Account login is not available yet">Login coming soon</button>;
  }
  if (!PRIVY_APP_ID) {
    return (
      <button
        type="button"
        onClick={onUnavailable}
        title="Configure VITE_PRIVY_APP_ID to enable Privy authentication"
        className={className}
      >
        Log in
      </button>
    );
  }

  return <ConfiguredPrivyAccountButton className={className} />;
}
