import type { Simulation } from '../../../domain/schema';
import { dataCache } from '../../../app/store';

export interface HistoryActions {
    onLoad: (simId: string) => void;
    onDelete: (simId: string) => void;
}

export function renderSimulationHistory(
    container: HTMLElement,
    sims: Simulation[], 
    actions: HistoryActions
): void {
    const simsToShow = sims.filter(s => !s.deleted);
    if (simsToShow.length === 0) {
        container.innerHTML = `<div style="font-size:12px; color:#9ca3af;">📚 シミュレーション履歴はまだありません</div>`;
        return;
    }

    const itemsHtml = simsToShow.slice(0, 10).map(sim => {
        const date = new Date(sim.createdAt).toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
        const isV5 = !!(sim.result?.worldline_baseline);
        const titles = isV5
            ? [sim.result.worldline_baseline?.title, sim.result.worldline_leap?.title, sim.result.worldline_guardrail?.title].filter(Boolean)
            : [sim.result?.persona_solid?.title, sim.result?.persona_leap?.title].filter(Boolean);
        const hasCommit = !!sim.commit;
        return `<div class="sim-history-item" data-sim-id="${sim.id}" style="cursor:pointer; padding:8px 12px; background:rgba(56,189,248,0.1); border:1px solid rgba(56,189,248,0.2); border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <div style="display:flex; align-items:center; gap:6px;">
                    <span style="font-size:10px; color:#9ca3af;">${date}</span>
                </div>
                <span style="font-size:11px; color:#fff; margin-left:8px;">${(titles[0] as string)?.slice(0, 30) || "Untitled"}...</span>
                ${hasCommit ? '<span style="color:#22c55e; font-size:10px; margin-left:6px;">✓ committed</span>' : ''}
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:10px; color:#38bdf8;">${sim.promptVersion}</span>
                <button class="delete-sim-btn" data-sim-id="${sim.id}" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:14px; opacity:0.7;" title="この履歴を削除">🗑️</button>
            </div>
        </div>`;
    }).join("");

    container.innerHTML = `
        <div style="font-size:12px; color:#38bdf8; margin-bottom:12px; font-weight:bold;">📚 SIMULATION HISTORY (直近${Math.min(simsToShow.length, 10)}件)</div>
        <div style="display:flex; flex-direction:column; gap:8px;">${itemsHtml}</div>
        ${simsToShow.length >= 2 ? `<div id="butterflyDiff" style="margin-top:16px;"></div>` : ""}
    `;

    // Bind load events
    container.querySelectorAll(".sim-history-item").forEach(el => {
        el.addEventListener("click", (e) => {
            if ((e.target as HTMLElement).closest(".delete-sim-btn")) return;
            const sId = el.getAttribute("data-sim-id")!;
            actions.onLoad(sId);
        });
    });
    // Bind delete events
    container.querySelectorAll(".delete-sim-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            actions.onDelete(btn.getAttribute("data-sim-id")!);
        });
    });

    // Butterfly Diff
    if (simsToShow.length >= 2) {
        const diffContainer = container.querySelector("#butterflyDiff") as HTMLElement;
        if (diffContainer) renderButterflyDiff(diffContainer, simsToShow[0], simsToShow[1]);
    }
}

export function renderButterflyDiff(container: HTMLElement, latest: any, previous: any): void {
    const daysDiff = Math.round((latest.createdAt - previous.createdAt) / (1000 * 60 * 60 * 24));
    const dateLabel = daysDiff === 0 ? "Same Day" : `${daysDiff} days later`;
    const shiftText = latest.result?.meta?.trajectory_shift || "";

    const getScore = (sim: any, type: string) => sim?.result?.[`worldline_${type}`]?.rubric_score || 0;
    const compareScore = (type: string, label: string) => {
        const curr = getScore(latest, type);
        const prev = getScore(previous, type);
        const diff = curr - prev;
        const color = diff > 0 ? "#22c55e" : diff < 0 ? "#ef4444" : "#9ca3af";
        const sign = diff > 0 ? "+" : diff < 0 ? "" : "±";
        return `<div style="display:flex; flex-direction:column; align-items:center;">
            <span style="font-size:9px; color:#aaa;">${label}</span>
            <span style="font-size:12px; font-weight:bold; color:${color};">${curr} <span style="font-size:9px;">(${sign}${diff})</span></span>
        </div>`;
    };

    const scoreDiffHtml = latest.result?.meta?.version?.includes("v5") ? `
        <div style="display:flex; justify-content:space-around; margin-bottom:12px; background:rgba(0,0,0,0.2); padding:8px; border-radius:6px;">
            ${compareScore("baseline", "Baseline")}${compareScore("leap", "Leap")}${compareScore("guardrail", "Guardrail")}
        </div>
    ` : "";

    function normalizeStep(raw: any): string {
        if (typeof raw === 'string') return raw.toLowerCase().trim();
        return (raw.action || raw.title || '').toLowerCase().trim();
    }

    function getStepsList(sim: any): string[] {
        const r = sim.result;
        if (!r) return [];
        const wls = r.worldline_baseline
            ? [r.worldline_baseline, r.worldline_leap, r.worldline_guardrail]
            : [r.persona_solid, r.persona_leap];
        return wls.flatMap((w: any) => (w?.micro_steps || w?.next_steps || []).map((s: any) => normalizeStep(s))).filter((s: string) => s);
    }

    const latestList = getStepsList(latest);
    const previousList = getStepsList(previous);
    const latestSteps = new Set(latestList);
    const previousSteps = new Set(previousList);
    const added = [...latestSteps].filter(s => !previousSteps.has(s));
    const removed = [...previousSteps].filter(s => !latestSteps.has(s));
    const prevIndexMap = new Map(previousList.map((s, i) => [s, i]));
    const moved = latestList.filter(s => previousSteps.has(s)).map(s => ({ step: s, latestIdx: latestList.indexOf(s), prevIdx: prevIndexMap.get(s)! })).filter(m => Math.abs(m.latestIdx - m.prevIdx) >= 1).slice(0, 3);
    const totalSteps = Math.max(latestSteps.size + previousSteps.size, 1);
    const changeScore = Math.round((added.length + removed.length) / totalSteps * 100);

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div style="font-size:12px; color:#d946ef; font-weight:bold;">🦋 BUTTERFLY DIFF</div>
            <div style="font-size:10px; color:#666;">vs Previous (${dateLabel})</div>
        </div>
        ${shiftText ? `<div style="font-size:11px; color:#e2e8f0; background:rgba(217,70,239,0.1); border-left:3px solid #d946ef; padding:8px; margin-bottom:12px; line-height:1.4;">
            <div style="font-size:9px; color:#d946ef; margin-bottom:2px; font-weight:bold;">TRAJECTORY SHIFT</div>${shiftText}</div>` : ""}
        ${scoreDiffHtml}
        <div style="font-size:11px; color:#9ca3af; margin-bottom:8px;">
            Step Change: <span style="color:${changeScore > 30 ? '#f59e0b' : '#22c55e'}; font-weight:bold;">${changeScore}%</span>
        </div>
        ${added.length > 0 ? `<div style="font-size:10px; margin-bottom:6px;"><span style="color:#22c55e;">+ 追加されたステップ:</span><div style="color:#aaa; margin-left:12px;">${added.slice(0, 3).map(s => `• ${s?.slice(0, 40)}...`).join("<br>")}</div></div>` : ""}
        ${removed.length > 0 ? `<div style="font-size:10px; margin-bottom:6px;"><span style="color:#ef4444;">- 削除されたステップ:</span><div style="color:#aaa; margin-left:12px;">${removed.slice(0, 3).map(s => `• ${s?.slice(0, 40)}...`).join("<br>")}</div></div>` : ""}
        ${moved.length > 0 ? `<div style="font-size:10px; margin-bottom:6px;"><span style="color:#f59e0b;">↕️ 順位変動:</span><div style="color:#aaa; margin-left:12px;">${moved.map(m => `• ${m.step?.slice(0, 30)}... (${m.prevIdx + 1}→${m.latestIdx + 1})`).join("<br>")}</div></div>` : ""}
        ${added.length === 0 && removed.length === 0 && moved.length === 0 ? `<div style="font-size:10px; color:#6b7280;">ステップに大きな変化はありません</div>` : ""}
    `;
}
