import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import type { ReactNode } from "react";
import { setTokenProvider } from "./api";

interface Props { children: ReactNode }

function ProductionSession({ children }: Props) {
  const { isLoading, isAuthenticated, loginWithRedirect, getAccessTokenSilently } = useAuth0();
  setTokenProvider(getAccessTokenSilently);
  if (isLoading) return <div className="centered-loader">Loading…</div>;
  if (!isAuthenticated) { void loginWithRedirect(); return <div className="centered-loader">Sign in…</div>; }
  return children;
}

export function AuthBoundary({ children }: Props) {
  if (import.meta.env.VITE_AUTH_DISABLED !== "false") { setTokenProvider(null); return children; }
  return (
    <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
      authorizationParams={{ redirect_uri: window.location.origin, audience: import.meta.env.VITE_AUTH0_AUDIENCE }}
      cacheLocation="localstorage"
      useRefreshTokens
    >
      <ProductionSession>{children}</ProductionSession>
    </Auth0Provider>
  );
}
