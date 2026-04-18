import { PublicClientApplication, Configuration, RedirectRequest, IPublicClientApplication, AccountInfo, AuthenticationResult } from "@azure/msal-browser";
import { odSaveLoginHint, odLoadLoginHint } from '../storage/localStorage';

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

    // デバッグモードの判定（設定から読む）
    let debugLogging = false;
    try {
        const settings = JSON.parse(localStorage.getItem("ippoOneDriveSettings_v2") || "null");
        debugLogging = !!settings?.debugLogging;
    } catch { /* ignore */ }

    return {
        auth: {
            clientId: config.clientId,
            authority: `https://login.microsoftonline.com/${tenant}`,
            redirectUri,
        },
        cache: { cacheLocation: "localStorage", storeAuthStateInCookie: true },
        system: {
            allowNativeBroker: false,
            loggerOptions: {
                loggerCallback: (level: any, message: any, containsPii: any) => {
                    if (containsPii) return;
                    // デバッグモード時のみUIとconsoleに出力
                    if (debugLogging) {
                        console.log(`[MSAL] ${message}`);
                        const debugArea = document.getElementById("debugLogArea") as HTMLTextAreaElement;
                        if (debugArea) debugArea.value += `[MSAL] ${message}\n`;
                    }
                },
                logLevel: 2, // Info以上（0=Error, 1=Warning, 2=Info, 3=Verbose）
            }
        },
    };
}

// MSAL初期化タイムアウト（秒）
const MSAL_INIT_TIMEOUT_MS = 10_000;

export async function odEnsureMsal(config: OdAuthConfig): Promise<AuthenticationResult | null> {
    // シングルトン: 初期化済みならキャッシュ済みアカウントを返す
    if (odMsalApp) {
        const accounts = odMsalApp.getAllAccounts();
        odAccount = accounts && accounts.length ? accounts[0] : null;
        return null;
    }

    const msalConfig = odBuildMsalConfig(config);
    odMsalApp = new PublicClientApplication(msalConfig);
    await odMsalApp.initialize();

    // リダイレクトコールバック処理（タイムアウト付き）
    // ネットワーク不通時の永久ブロックを防止する
    let authResult: AuthenticationResult | null = null;
    try {
        const timeoutPromise = new Promise<null>((resolve) =>
            setTimeout(() => {
                console.warn("[MSAL] handleRedirectPromise がタイムアウトしました。オフラインモードで継続します。");
                resolve(null);
            }, MSAL_INIT_TIMEOUT_MS)
        );
        authResult = await Promise.race([
            odMsalApp.handleRedirectPromise(),
            timeoutPromise,
        ]);
    } catch (e: any) {
        // no_token_request_cache_error 等のリダイレクト関連エラーを吸収
        // アプリの起動をブロックせず、オフラインモードで継続する
        console.warn("[MSAL] handleRedirectPromise エラー（無視して継続）:", e.message || e);
    }

    const accounts = odMsalApp.getAllAccounts();
    odAccount = accounts && accounts.length ? accounts[0] : null;

    // リダイレクト認証が成功した場合、loginHintを保存
    if (authResult?.account) {
        odAccount = authResult.account;
        odSaveLoginHint(authResult.account.username);
    }

    return authResult;
}

export function odGetAccountName(): string | null {
    return odAccount ? odAccount.username : null;
}

export async function odSignIn(config: OdAuthConfig): Promise<void> {
    await odEnsureMsal(config);
    if (!odMsalApp) return;

    // まずサイレント復帰を試みる（認証画面なしでセッション復元）
    try {
        const accounts = odMsalApp.getAllAccounts();
        const loginHint = odLoadLoginHint();

        if (accounts.length > 0) {
            // キャッシュ済みアカウントがあればサイレントでトークン取得
            const result = await odMsalApp.acquireTokenSilent({
                account: accounts[0],
                scopes: OD_SCOPES,
            });
            odAccount = result.account;
            if (odAccount) odSaveLoginHint(odAccount.username);
            return; // 認証画面なしで成功
        }

        // アカウント情報なし → ssoSilentでMicrosoftセッション検出を試みる
        const ssoReq: any = { scopes: OD_SCOPES };
        if (loginHint) ssoReq.loginHint = loginHint;

        const ssoResult = await odMsalApp.ssoSilent(ssoReq);
        odAccount = ssoResult.account;
        if (odAccount) odSaveLoginHint(odAccount.username);
        return; // SSO検出成功、認証画面なし
    } catch {
        // サイレント/SSO失敗 → リダイレクト方式で認証
        // ポップアップはスマホで動作しないため、リダイレクト方式に統一。
        // loginHintを渡すことでアカウント選択画面をスキップし、
        // 既知のアカウントでの再認証がワンタップで完了する。
        const loginHint = odLoadLoginHint();
        const redirectReq: any = { scopes: OD_SCOPES };
        if (loginHint) redirectReq.loginHint = loginHint;

        // loginRedirect はページ遷移を起こす。
        // 認証完了後、ブラウザがこのアプリに戻り、
        // odEnsureMsal() の handleRedirectPromise() で結果を受け取る。
        // ※ この行以降には到達しない（ページ遷移が発生するため）
        await odMsalApp.loginRedirect(redirectReq);
    }
}

export async function odSignOut(config: OdAuthConfig): Promise<void> {
    if (!odMsalApp) await odEnsureMsal(config);
    const account = odAccount;
    odAccount = null;
    if (account && odMsalApp) await odMsalApp.logoutRedirect({ account });
}

async function odGetToken(config: OdAuthConfig): Promise<string> {
    if (!odMsalApp) await odEnsureMsal(config);
    if (!odAccount) throw new Error("サインインしてません。");
    try {
        const r = await odMsalApp!.acquireTokenSilent({ account: odAccount, scopes: OD_SCOPES });
        return r.accessToken;
    } catch (e) {
        // サイレント失敗 → リダイレクトせず、同期をスキップして通知に留める
        // ユーザーは準備ができたときに手動で再サインインできる
        console.warn("Silent token acquisition failed. Sync will be skipped until re-authentication.");
        odAccount = null; // セッション無効化（再サインイン待ち）
        throw new Error("auth_session_expired");
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
