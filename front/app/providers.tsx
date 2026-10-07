"use client";

import { PhantomProvider, darkTheme } from "@phantom/react-sdk";
import { AddressType } from "@phantom/browser-sdk";

export function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PHANTOM_APP_ID?.trim() || undefined;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <PhantomProvider
      config={{
        providers: appId ? ["google", "apple", "injected"] : ["injected"],
        appId,
        addressTypes: [AddressType.solana],
        authOptions: {
          redirectUrl: `${appUrl}/auth/callback`,
        },
      }}
      theme={darkTheme}
      appName="VYNX"
    >
      {children}
    </PhantomProvider>
  );
}
