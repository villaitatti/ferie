import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { createContext, type ReactNode, useContext, useEffect } from "react";
import { setTokenProvider } from "./api";

interface Props { children: ReactNode }

const PortalSessionContext = createContext<{ signOut: () => void }>({ signOut: () => undefined });

export function safeReturnTo(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export function usePortalSession() {
  return useContext(PortalSessionContext);
}

function ProductionSession({ children }: Props) {
  const { isLoading, isAuthenticated, loginWithRedirect, getAccessTokenSilently, logout } = useAuth0();
  setTokenProvider(getAccessTokenSilently);
  useEffect(() => {
    if (!isLoading && !isAuthenticated) void loginWithRedirect({ appState: { returnTo: `${window.location.pathname}${window.location.search}${window.location.hash}` } });
  }, [isAuthenticated, isLoading, loginWithRedirect]);
  if (isLoading) return <div className="centered-loader">Loading…</div>;
  if (!isAuthenticated) return <div className="centered-loader">Sign in…</div>;
  return <PortalSessionContext.Provider value={{ signOut: () => void logout({ logoutParams: { returnTo: window.location.origin } }) }}>{children}</PortalSessionContext.Provider>;
}

export function AuthBoundary({ children }: Props) {
  if (import.meta.env.VITE_AUTH_DISABLED !== "false") {
    setTokenProvider(null);
    const signOut = () => {
      localStorage.removeItem("ferie-demo-subject");
      window.location.assign(window.location.origin);
    };
    return <PortalSessionContext.Provider value={{ signOut }}>{children}</PortalSessionContext.Provider>;
  }
  return (
    <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
      authorizationParams={{ redirect_uri: window.location.origin, audience: import.meta.env.VITE_AUTH0_AUDIENCE }}
      onRedirectCallback={(appState) => window.history.replaceState({}, document.title, safeReturnTo(appState?.returnTo))}
      cacheLocation="localstorage"
      useRefreshTokens
    >
      <ProductionSession>{children}</ProductionSession>
    </Auth0Provider>
  );
}
