// ===== Main Entry Point =====

import './styles/main.css';
import { uuid, formatDate, formatDateTimeForRecord } from './utils/helpers';
import { dataCache, setDataCache, entries, nextMemos, setEntries, setNextMemos, getActiveEntries } from './app/store';
import {
    loadEntriesFromCache, loadNextMemosFromCache, saveEntriesToStorage, saveNextMemosToStorage,
    deleteEntryById, parseIppoCsv, migrateLegacyData,
    downloadCsv, buildMonthlySummaryRows, buildAllEntriesRows,
    downloadJson, importJsonFile, computeMetrics, getRecordTime,
    createEntry, createMemo, // Added helpers
} from './app/actions';
import { getDeviceId } from './utils/device';
import {
    storageLoadData, storageSaveData, odSaveCache, odEnqueueChange, saveLastGood, odLoadSettings,
} from './services/storage/localStorage';
import { initSyncUI } from './ui/views/syncSettings';
import { syncAutoConnect, syncFlush } from './services/sync/syncManager';
import { odEnsureMsal } from './services/sync/onedrive';
import {
    renderAll, renderNextMemos, renderDailyTable, renderDiaryForDate,
    renderMetrics, renderCategoryBars, renderFlowChart,
} from './ui/views/ippoLog';
import { initFutureLab } from './ui/views/futureLab';
import { initSettings } from './ui/views/settings';
import { initSyncStatus } from './ui/components/syncStatus';
import { inferCategory } from './domain/categories';

const DEFAULT_FILE_PATH = "/Apps/IppoDashboard/ippo_data.json";

// ===== Tab Switching =====

function initTabs(): void {
    const tabs = document.querySelectorAll(".tab-btn");
    tabs.forEach(btn => {
        btn.addEventListener("click", () => {
            const target = (btn as HTMLElement).dataset.tab;
            if (target) switchTab(target);
        });
    });
}

function switchTab(tabName: string): void {
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.classList.toggle("active", (btn as HTMLElement).dataset.tab === tabName);
    });
    document.getElementById("tabIppo")?.classList.toggle("active", tabName === "ippo");
    document.getElementById("tabFuture")?.classList.toggle("active", tabName === "future");
    document.getElementById("tabSettings")?.classList.toggle("active", tabName === "settings");
    if (tabName === "future") {
        initFutureLab();
    }
}

// ===== Event Setup =====

function setupEvents(): void {
    let currentEnergy: number | null = null;
    let currentMental: number | null = null;

    function setupRatingBtns(containerId: string, clearId: string, _getValue: () => number | null, setValue: (v: number | null) => void): void {
        const container = document.getElementById(containerId);
        const clearBtn = document.getElementById(clearId);
        if (!container) return;

        container.querySelectorAll(".rating-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const val = parseInt((btn as HTMLElement).dataset.value || "0", 10);
                container.querySelectorAll(".rating-btn").forEach(b => b.classList.remove("selected"));
                btn.classList.add("selected");
                setValue(val);
            });
        });

        if (clearBtn) {
            clearBtn.addEventListener("click", () => {
                container.querySelectorAll(".rating-btn").forEach(b => b.classList.remove("selected"));
                setValue(null);
            });
        }
    }

    setupRatingBtns("energyBtns", "energyClear", () => currentEnergy, v => currentEnergy = v);
    setupRatingBtns("mentalBtns", "mentalClear", () => currentMental, v => currentMental = v);

    // Date select
    const select = document.getElementById("dateSelect") as HTMLSelectElement;
    if (select) {
        select.addEventListener("change", () => {
            const v = select.value;
            select.setAttribute("data-current", v);
            renderDailyTable(v);
        });
    }

    // CSV input
    const csvInput = document.getElementById("csvInput") as HTMLInputElement;
    const fileStatus = document.getElementById("fileStatus");
    if (csvInput && fileStatus) {
        csvInput.addEventListener("change", (ev) => {
            const file = (ev.target as HTMLInputElement).files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result as string;
                const parsed = parseIppoCsv(text);
                if (!parsed.length) {
                    fileStatus.textContent = "CSVを読み込んだが、エントリが見つかりませんでした";
                    fileStatus.style.color = "#f97373";
                    return;
                }
                setEntries(parsed);
                saveEntriesToStorage();
                fileStatus.textContent = `${file.name} から ${parsed.length}件 読み込み済み`;
                fileStatus.style.color = "#9ca3af";
                renderAll();
            };
            reader.onerror = () => {
                fileStatus.textContent = "CSV読み込みに失敗しました";
                fileStatus.style.color = "#f97373";
            };
            reader.readAsText(file, "UTF-8");
        });
    }

    // Add form
    const addForm = document.getElementById("addForm");
    const addText = document.getElementById("addText") as HTMLTextAreaElement;
    const addDate = document.getElementById("addDate") as HTMLInputElement;
    const addMsg = document.getElementById("addMessage");

    if (addText) {
        addText.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter" && !ev.shiftKey) {
                ev.preventDefault();
                addForm?.dispatchEvent(new Event("submit"));
            }
        });
    }

    if (addForm && addText && addDate && addMsg) {
        addForm.addEventListener("submit", (ev) => {
            ev.preventDefault();
            const text = (addText.value || "").trim();
            let dateStr = addDate.value;
            if (!text) {
                addMsg.textContent = "一歩の内容を入れてください。";
                addMsg.className = "message err";
                return;
            }
            if (!dateStr) dateStr = formatDate(new Date());

            const now = new Date();
            const entry = createEntry({
                date: dateStr,
                text: text,
                category: inferCategory(text),
                ts: now.getTime(),
                updatedAt: now.getTime(),
            });

            entries.push(entry);
            entries.sort((a, b) => {
                const ka = (a.date || "") + " " + getRecordTime(a);
                const kb = (b.date || "") + " " + getRecordTime(b);
                return ka.localeCompare(kb);
            });
            saveEntriesToStorage();

            addText.value = "";
            currentEnergy = null;
            currentMental = null;
            document.querySelectorAll("#energyBtns .rating-btn, #mentalBtns .rating-btn").forEach(b => b.classList.remove("selected"));

            addMsg.textContent = "一歩を追加しました。";
            addMsg.className = "message ok";

            renderAll();
            if (select) {
                select.value = dateStr;
                select.setAttribute("data-current", dateStr);
                renderDailyTable(dateStr);
            }
        });

        addDate.value = formatDate(new Date());
    }

    // Reset
    const resetBtn = document.getElementById("resetButton");
    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            const ok = window.confirm("保存されている一歩ログをすべて削除します。本当にリセットしますか？");
            if (!ok) return;

            setEntries([]);
            setNextMemos([]);
            const fresh = { schemaVersion: 2, entries: [] as any[], memos: [] as any[], simulations: [] as any[], dailyStates: {} };
            setDataCache(fresh as any);
            odSaveCache(fresh as any);
            odEnqueueChange();

            if (fileStatus) {
                fileStatus.textContent = "データを全てリセットしました";
                fileStatus.style.color = "#f97373";
            }

            const dailyTbody = document.getElementById("dailyTbody");
            const dailyTableWrap = document.getElementById("dailyTableWrap");
            const noDataDaily = document.getElementById("noDataDaily");
            const selectedDateLabel = document.getElementById("selectedDateLabel");
            const dailyCountLabel = document.getElementById("dailyCountLabel");
            const dailyScore = document.getElementById("dailyScore");

            if (dailyTbody) dailyTbody.innerHTML = "";
            if (dailyTableWrap) dailyTableWrap.style.display = "none";
            if (noDataDaily) noDataDaily.style.display = "";
            if (selectedDateLabel) selectedDateLabel.textContent = "-";
            if (dailyCountLabel) dailyCountLabel.textContent = "0件";
            if (dailyScore) dailyScore.textContent = "0.0";

            renderAll();
            renderDiaryForDate("-");
            renderNextMemos();
        });
    }

    // Export buttons
    document.getElementById("exportMonthlyBtn")?.addEventListener("click", () => {
        const rows = buildMonthlySummaryRows();
        downloadCsv("ippo-monthly-summary.csv", rows);
    });

    document.getElementById("exportAllBtn")?.addEventListener("click", () => {
        const rows = buildAllEntriesRows();
        downloadCsv("ippo-all-entries.csv", rows);
    });

    // Mental UI
    document.getElementById("dailyMentalBtns")?.addEventListener("click", (e) => {
        if (!(e.target as HTMLElement).classList.contains("rating-btn")) return;
        const val = parseInt((e.target as HTMLElement).dataset.value || "0");
        const dateSelect = document.getElementById("dateSelect") as HTMLSelectElement;
        const dateStr = dateSelect?.value;
        if (!dateStr || dateStr === "-") return;

        dataCache.dailyStates = dataCache.dailyStates || {};
        if (!dataCache.dailyStates[dateStr]) dataCache.dailyStates[dateStr] = { rev: 0, deviceId: getDeviceId() };
        dataCache.dailyStates[dateStr].mental = val;
        dataCache.dailyStates[dateStr].updatedAt = Date.now();
        storageSaveData(dataCache);

        document.querySelectorAll("#dailyMentalBtns .rating-btn").forEach(btn => {
            btn.classList.toggle("selected", parseInt((btn as HTMLElement).dataset.value || "0") === val);
        });
        renderFlowChart();
    });

    document.getElementById("dailyMentalClear")?.addEventListener("click", () => {
        const dateSelect = document.getElementById("dateSelect") as HTMLSelectElement;
        const dateStr = dateSelect?.value;
        if (!dateStr || dateStr === "-") return;

        if (dataCache.dailyStates && dataCache.dailyStates[dateStr]) {
            delete dataCache.dailyStates[dateStr].mental;
            dataCache.dailyStates[dateStr].updatedAt = Date.now();
            dataCache.dailyStates[dateStr].rev = (dataCache.dailyStates[dateStr].rev || 0) + 1;
            dataCache.dailyStates[dateStr].deviceId = getDeviceId();
            storageSaveData(dataCache);
        }

        document.querySelectorAll("#dailyMentalBtns .rating-btn").forEach(btn => {
            btn.classList.remove("selected");
        });
        renderFlowChart();
    });

    // Diary buttons
    document.getElementById("regenerateDiaryBtn")?.addEventListener("click", () => {
        const s = document.getElementById("dateSelect") as HTMLSelectElement;
        renderDiaryForDate(s?.value || "-");
    });

    document.getElementById("copyDiaryBtn")?.addEventListener("click", async () => {
        const out = document.getElementById("diaryOutput") as HTMLTextAreaElement;
        const text = out?.value || "";
        const diaryMsg = document.getElementById("diaryMessage");
        if (!text.trim()) {
            if (diaryMsg) diaryMsg.textContent = "コピーする日記がありません。";
            return;
        }
        try {
            await navigator.clipboard.writeText(text);
            if (diaryMsg) diaryMsg.textContent = "クリップボードにコピーしました。";
        } catch {
            if (diaryMsg) diaryMsg.textContent = "コピーに失敗しました。テキストを選択して手動でコピーしてください。";
        }
    });

    // Memo form
    const memoForm = document.getElementById("nextMemoForm");
    const memoInput = document.getElementById("nextMemoInput") as HTMLTextAreaElement;
    if (memoForm && memoInput) {
        memoForm.addEventListener("submit", (ev) => {
            ev.preventDefault();
            const text = (memoInput.value || "").trim();
            if (!text) return;
            const now = new Date();
            const memo = createMemo(text);
            nextMemos.push(memo);
            saveNextMemosToStorage();
            memoInput.value = "";
            renderNextMemos();
        });
    }


}

// ===== Online/Offline =====

window.addEventListener("online", () => {
    syncFlush();
});


// ===== Bootstrap =====

document.addEventListener("DOMContentLoaded", async () => {
    // 0. Auth Handler (Redirect Flow)
    // If we are returning from MSAL redirect, handles the hash and continues.
    const hash = window.location.hash;
    const search = window.location.search;

    if (hash.includes("code=") || hash.includes("error=") || search.includes("code=") || search.includes("error=")) {

        // VISUAL FEEDBACK: Show we are processing login
        const loadingDiv = document.createElement("div");
        loadingDiv.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); color:white; display:flex; flex-direction:column; justify-content:center; align-items:center; z-index:9999;";
        loadingDiv.innerHTML = `<h1>🔄 Processing Login...</h1><p>Please wait while we complete authentication.</p><div id="debug-status" style="margin-top:20px; font-family:monospace; font-size:12px; max-width:80%;">Initializing...</div>`;
        document.body.appendChild(loadingDiv);

        const statusDiv = document.getElementById("debug-status")!;
        const odSettings = odLoadSettings();

        if (odSettings?.clientId) {
            statusDiv.innerHTML = "Settings found. Calling MSAL...";
            try {
                // Initialize MSAL and handle hash
                const result = await odEnsureMsal({
                    clientId: odSettings.clientId,
                    tenant: odSettings.tenant,
                    redirectUri: odSettings.redirectUri
                });

                if (result) {
                    // LOGIN SUCCESS!
                    statusDiv.innerHTML = "✅ Authentication Successful! Resuming app...";

                    // Clear the hash/search from URL so we don't re-trigger this on reload
                    const url = new URL(window.location.href);
                    url.hash = "";
                    url.search = ""; // Be careful if search had other params? But usually code is in hash for SPA or search for cleanup.
                    // Actually, cleaner to just strip code/error related stuff, but wiping is safer for now.
                    // Restore 'tab' param if it was there? Hard to know what was there before redirect.
                    window.history.replaceState({}, document.title, url.pathname); // Keep pathname, strip query/hash

                    // Remove loading screen and allow app to continue
                    document.body.removeChild(loadingDiv);

                    // Proceed to normal init below...
                } else {
                    // No result usually means hash didn't contain auth info or was ignored.
                    // But we checked for 'code='... maybe it was something else?
                    // Just let app continue, maybe it was a false alarm?
                    // Or if it failed silently...
                    statusDiv.innerHTML += "<br>⚠️ MSAL finished but returned no result. Proceeding...";
                    setTimeout(() => document.body.removeChild(loadingDiv), 1000);
                }

            } catch (e: any) {
                // LOGIN FAILED
                loadingDiv.innerHTML = `
                    <div style="padding:20px; font-family:sans-serif; color:white; background:darkred; height:100vh; width:100%;">
                        <h1>❌ Authentication Failed</h1>
                        <p>Could not complete sign-in.</p>
                        <div style="background:black; padding:10px; font-family:monospace;">
                            Error: ${e.message || e}
                        </div>
                        <div id="diag-area"></div>
                        <button onclick="window.location.reload()" style="margin-top:20px; padding:10px;">Reload App</button>
                    </div>
                `;
                const diagArea = loadingDiv.querySelector("#diag-area")!;

                // Diagnostic: Mismatch
                try {
                    const currentOrigin = new URL(window.location.href).origin;
                    const redirectOrigin = new URL(odSettings.redirectUri).origin;
                    if (currentOrigin !== redirectOrigin) {
                        diagArea.innerHTML = `
                            <div style="margin-top:15px; background:#500; padding:10px; border:1px solid red;">
                                <strong>⚠️ CONFIG ERROR: Origin Mismatch</strong><br>
                                Current: ${currentOrigin}<br>
                                Config: ${redirectOrigin}<br>
                                Update Redirect URI in settings to match Current.
                            </div>`;
                    }
                } catch { }

                // Diagnostic: Storage
                const msalKeys = Object.keys(localStorage).filter(k => k.toLowerCase().includes("msal"));
                if (msalKeys.length === 0) {
                    diagArea.innerHTML += `
                        <div style="margin-top:10px; border-top:1px solid #555; padding-top:5px;">
                            <strong>⚠️ Storage Error:</strong> No MSAL keys found in LocalStorage.
                        </div>`;
                }

                return; // Stop app initialization
            }
        } else {
            // No settings? weird if we got a code.
            statusDiv.innerHTML += "<br>⚠️ No settings found. Proceeding...";
            setTimeout(() => document.body.removeChild(loadingDiv), 2000);
        }
    }

    // ===== Normal App Initialization =====

    await storageLoadData();
    migrateLegacyData();
    loadEntriesFromCache();
    loadNextMemosFromCache();

    // Check URL query param for tab
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab) switchTab(tab);

    renderAll();
    renderNextMemos();

    initTabs();
    initSettings();
    setupEvents();
    initSyncUI();
    initSyncStatus();

    // Auto-connect if configured
    await syncAutoConnect();
    if (navigator.onLine) syncFlush();

    // Schedule LastGood backup if successful so far
    setTimeout(() => {
        saveLastGood(dataCache);
    }, 5000);
});
