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
    // 0. Auth Callback Guard (Handle Popup Redirect)
    const hash = window.location.hash;
    const search = window.location.search;

    // DEBUG: Check if we are checking the right things
    // console.log("Checking Auth:", hash, search);

    if (hash.includes("code=") || hash.includes("error=") || search.includes("code=") || search.includes("error=")) {

        // VISUAL DEBUG: Force screen takeover to prove this code is running
        document.body.innerHTML = `
            <div style="padding:20px; font-family:sans-serif; color:white; background:darkblue; height:100vh;">
                <h1>🛑 Auth Guard Triggered!</h1>
                <p>Processing Authentication Callback...</p>
                <div style="background:black; padding:10px; font-family:monospace;">
                    Hash: ${hash.substring(0, 20) + "..." || "(none)"}<br>
                    Search: ${search || "(none)"}
                </div>
                <div id="debug-status" style="margin-top:20px; border:1px solid white; padding:10px;">
                    Initializing...
                </div>
            </div>
        `;

        console.log("Processing Auth Callback...");
        const odSettings = odLoadSettings();

        const statusDiv = document.getElementById("debug-status")!;

        if (odSettings?.clientId) {
            statusDiv.innerHTML = `
                <strong>Settings Loaded:</strong><br>
                ClientId: ${odSettings.clientId.substring(0, 5)}...<br>
                RedirectUri: ${odSettings.redirectUri}<br>
                <br>
                Calling MSAL...
            `;

            try {
                // Initialize MSAL to handle the hash (it will close the window if consistent)
                const result = await odEnsureMsal({
                    clientId: odSettings.clientId,
                    tenant: odSettings.tenant,
                    redirectUri: odSettings.redirectUri
                });

                statusDiv.innerHTML += `<br><strong>MSAL Result:</strong> ${result ? "SUCCESS" : "NULL (Ignored)"}`;

                if (result) {
                    statusDiv.innerHTML += `<br>Closing window in 2 seconds...`;
                    setTimeout(() => window.close(), 2000);
                } else {
                    statusDiv.innerHTML += `<br>⚠️ MSAL ignored the hash. Redirect URI mismatch?`;
                }

            } catch (e: any) {
                statusDiv.innerHTML += `<br>❌ Error: ${e.message || e}`;
            }

        } else {
            // Append error to the screen
            statusDiv.innerHTML = "<h3>⚠️ Warning: Settings not found in localStorage.</h3><p>Could not initialize MSAL.</p>";
            statusDiv.style.backgroundColor = "darkred";
        }
        return; // Stop app initialization
    }

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
