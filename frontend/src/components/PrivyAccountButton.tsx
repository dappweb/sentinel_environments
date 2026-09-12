import { useLogin, usePrivy } from "@privy-io/react-auth";

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID as string | undefined;

interface PrivyAccountButtonProps {
  className?: string;
  onUnavailable?: () => void;
}

function ConfiguredPrivyAccountButton({ className = "" }: PrivyAccountButtonProps) {
  const { ready, authenticated, logout } = usePrivy();
  const { login } = useLogin();

  if (!ready) {
    return (
      <button type="button" disabled className={`${className} cursor-wait opacity-60`}>
        Loading…
      </button>
    );
  }

  if (authenticated) {
    return (
      <button type="button" onClick={() => void logout()} className={className}>
        Log out
      </button>
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
