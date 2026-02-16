// ===== OneDrive API Layer =====
// Handles MSAL Auth and Graph API calls
// No UI dependencies

import { PublicClientApplication } from '@azure/msal-browser';

const DEFAULT_FILE_PATH = "/Apps/IppoDashboard/ippo_data.json";
const OD_SCOPES = ["Files.ReadWrite.AppFolder", "offline_access"];

let odMsalApp: PublicClientApplication | null = null;
let odAccount: any = null;

// Auth Config
export interface OdAuthConfig {
    clientId: string;
    tenant?: string;
    redirectUri?: string;
}

export function odGetRedirectUriDefault(): string {
    return location.href.split("#")[0].split("?")[0];
}

function odBuildMsalConfig(config: OdAuthConfig): any {
    if (!config.clientId) throw new Error("Client ID が未設定です。");
    const tenant = config.tenant || "common";
    const redirectUri = config.redirectUri || odGetRedirectUriDefault();
    return {
        auth: {
            clientId: config.clientId,
            authority: `https://login.microsoftonline.com/${tenant}`,
            redirectUri,
        },
        cache: { cacheLocation: "localStorage", storeAuthStateInCookie: false },
        system: { allowNativeBroker: false },
    };
}

export async function odEnsureMsal(config: OdAuthConfig): Promise<void> {
    const msalConfig = odBuildMsalConfig(config);
    odMsalApp = new PublicClientApplication(msalConfig);
    await odMsalApp.initialize();
    const accounts = odMsalApp.getAllAccounts();
    odAccount = accounts && accounts.length ? accounts[0] : null;
}

export function odGetAccountName(): string | null {
    return odAccount ? odAccount.username : null;
}

export async function odSignIn(config: OdAuthConfig): Promise<void> {
    await odEnsureMsal(config);
    if (!odMsalApp) return;
    const result = await odMsalApp.loginPopup({ scopes: OD_SCOPES, prompt: "select_account" });
    odAccount = result.account || null;
}

export async function odSignOut(config: OdAuthConfig): Promise<void> {
    if (!odMsalApp) await odEnsureMsal(config);
    const account = odAccount;
    odAccount = null;
    if (account && odMsalApp) await odMsalApp.logoutPopup({ account });
}

async function odGetToken(config: OdAuthConfig): Promise<string> {
    if (!odMsalApp) await odEnsureMsal(config);
    if (!odAccount) throw new Error("サインインしてません。");
    try {
        const r = await odMsalApp!.acquireTokenSilent({ account: odAccount, scopes: OD_SCOPES });
        return r.accessToken;
    } catch (e) {
        const r = await odMsalApp!.acquireTokenPopup({ scopes: OD_SCOPES });
        return r.accessToken;
    }
}

// Graph API

function odGetGraphFileUrl(filePath: string): string {
    const path = (filePath || DEFAULT_FILE_PATH).replace(/^\/?Apps\//, "");
    const normalized = path.startsWith("/") ? path.slice(1) : path;
    const encodedPath = normalized.split("/").map(encodeURIComponent).join("/");
    return `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${encodedPath}:/content`;
}

export async function odGetRemoteData(config: OdAuthConfig, filePath: string): Promise<{ data: any; etag: string | null }> {
    const token = await odGetToken(config);
    const url = odGetGraphFileUrl(filePath);
    const res = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
    if (res.status === 404) {
        return { data: null, etag: null };
    }
    if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`OneDrive取得失敗: ${res.status} ${t}`);
    }
    const etag = res.headers.get("ETag");
    const raw = await res.text();
    let data;
    try { data = JSON.parse(raw); } catch {
        throw new Error("OneDriveのJSONが壊れています。");
    }
    return { data, etag };
}

export async function odPutRemoteData(config: OdAuthConfig, filePath: string, data: any, etag: string | null): Promise<string | null> {
    const token = await odGetToken(config);
    const url = odGetGraphFileUrl(filePath);
    const headers: Record<string, string> = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
    };
    if (etag) headers["If-Match"] = etag;
    const res = await fetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify(data, null, 2)
    });
    if (res.status === 412) {
        throw new Error("etag_mismatch");
    }
    if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`OneDrive保存失敗: ${res.status} ${t}`);
    }
    return res.headers.get("ETag");
}
