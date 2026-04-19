import type { SimulationResult, Worldline } from '../../../domain/schema';
import { dataCache } from '../../../app/store';
import { sanitize } from '../../../utils/sanitize';
import { hasRecentAssetCommit } from '../../../logic/compass/compassResolver';

export interface CardActions {
    onToggleStoryMode: () => void;
    onCommitAsset: (worldlineKey: string, assetIndex: number) => void;
    onMemoMicroStep: (worldlineKey: string, stepIndex: number) => void;
    onShowAssetPrompt: (encodedAsset: string) => void;
    storyModeEnabled: boolean;
}

export function renderFutureCards(
    container: HTMLElement, 
    result: SimulationResult, 
    simId: string, 
    actions: CardActions
): void {
    container.innerHTML = "";

    // Story Mode toggle UI
    const canEnableStoryMode = hasRecentAssetCommit();
    const storyToggle = document.createElement("div");
    storyToggle.style.cssText = "grid-column: 1/-1; display:flex; justify-content:flex-end; gap:8px; align-items:center; margin-bottom:8px;";
    
    const toggleLabel = document.createElement("span");
    toggleLabel.style.cssText = "font-size:11px; color:#888;";
    toggleLabel.textContent = "📖 Story Mode";
    
    const toggleBtn = document.createElement("button");
    const { storyModeEnabled } = actions;
    toggleBtn.style.cssText = `background:${storyModeEnabled ? '#d946ef' : '#333'}; color:${storyModeEnabled ? '#fff' : '#666'}; border:1px solid ${canEnableStoryMode ? '#d946ef' : '#555'}; padding:4px 10px; border-radius:4px; font-size:10px; cursor:${canEnableStoryMode ? 'pointer' : 'not-allowed'};`;
    toggleBtn.textContent = storyModeEnabled ? "ON" : "OFF";
    toggleBtn.disabled = !canEnableStoryMode;
    if (!canEnableStoryMode) toggleBtn.title = "直近7日でコミットが必要";
    toggleBtn.addEventListener("click", () => actions.onToggleStoryMode());
    
    storyToggle.appendChild(toggleLabel);
    storyToggle.appendChild(toggleBtn);
    container.appendChild(storyToggle);

    const isV5 = !!(result.worldline_baseline && result.worldline_leap && result.worldline_guardrail);
    const worldlines = isV5 ? [
        { key: "worldline_baseline", color: "#38bdf8", icon: "🌱", label: "Baseline（現状延長）" },
        { key: "worldline_leap", color: "#d946ef", icon: "🚀", label: "Leap（10X飛躍）" },
        { key: "worldline_guardrail", color: "#22c55e", icon: "🛡️", label: "Guardrail（帰還ルート）" }
    ] : [
        { key: "persona_solid", color: "#38bdf8", icon: "🌱", label: "Solid Future" },
        { key: "persona_leap", color: "#d946ef", icon: "🚀", label: "Leap Future" }
    ];

    worldlines.forEach(wl => {
        const item = (result as any)[wl.key] as Worldline | undefined;
        if (!item) return;

        const card = document.createElement("div");
        card.style.cssText = `background:rgba(0,0,0,0.3); border:1px solid ${wl.color}; border-radius:8px; padding:16px;`;

        // Micro steps
        const steps = item.micro_steps || (item as any).next_steps || [];
        const sim = (dataCache.simulations || []).find(s => s.id === simId);
        const memoedSteps = sim?.memoedStepIndices || [];

        const stepsHtml = steps.map((step: any, i: number) => {
            const isMemoed = memoedSteps.includes(`${wl.key}-${i}`);
            const btnHtml = isMemoed
                ? `<span style="flex-shrink:0; background:#22c55e; color:#fff; padding:4px 8px; border-radius:4px; font-size:10px;">✓ Added</span>`
                : `<button class="memo-btn" data-wl="${wl.key}" data-idx="${i}" style="flex-shrink:0; background:${wl.color}22; border:1px solid ${wl.color}; color:${wl.color}; padding:4px 8px; border-radius:4px; font-size:10px; cursor:pointer;">メモ</button>`;
            return `<div style="margin-bottom:10px; display:flex; gap:8px; align-items:flex-start;">
                <span style="color:${wl.color}; font-family:monospace; font-weight:bold; flex-shrink:0;">#${i + 1}</span>
                <div style="flex:1;">
                    <div style="font-size:13px; font-weight:bold; color:#fff;">${sanitize(step.action || step.toString())}</div>
                    <div style="font-size:11px; color:${wl.color}; opacity:0.7; margin-top:2px;">${sanitize(step.reason || "")}</div>
                </div>
                ${btnHtml}
            </div>`;
        }).join("");

        // Roadmap
        const roadmapHtml = item.roadmap ? `
            <div style="background:${wl.color}11; padding:10px; border-radius:6px; margin-bottom:12px; border:1px solid ${wl.color}22;">
                <div style="font-size:10px; color:${wl.color}; margin-bottom:6px; letter-spacing:1px;">📍 ROADMAP</div>
                ${item.roadmap.map(r => `<div style="font-size:11px; margin-bottom:4px; display:flex; gap:6px;">
                    <span style="color:${wl.color}; font-weight:bold; min-width:30px;">${sanitize(r.horizon)}</span>
                    <span style="color:#ccc;">${sanitize(r.outcome)}</span>
                </div>`).join("")}
            </div>` : "";

        // Asset steps
        const assetHtml = item.asset_steps ? `
            <div style="background:rgba(255,215,0,0.1); padding:10px; border-radius:6px; margin-top:12px; border:1px solid rgba(255,215,0,0.3);">
                <div style="font-size:10px; color:#fbbf24; margin-bottom:6px; letter-spacing:1px;">🏆 ASSET STEPS</div>
                ${item.asset_steps.map((a, idx) => {
            const isCommitted = sim?.assetCommits?.some(ac => ac.worldline === wl.key && ac.assetIndex === idx);
            return `<div style="font-size:11px; margin-bottom:6px;">
                        <div style="color:#fff; font-weight:bold;">${sanitize(a.asset)} <span style="color:#fbbf24; font-size:9px;">[${sanitize(a.type)}]</span></div>
                        <div style="color:#aaa; font-size:10px;">${sanitize(a.why)}</div>
                        <div style="display:flex; gap:6px; margin-top:4px;">
                            <button class="asset-prompt-btn" data-asset="${encodeURIComponent(JSON.stringify(a))}" style="background:#fbbf24; color:#000; border:none; padding:2px 6px; border-radius:3px; font-size:9px; cursor:pointer;">📝 資産生成プロンプトを表示</button>
                            ${isCommitted
                    ? `<span style="color:#22c55e; font-size:9px;">✓ 確定済み</span>`
                    : `<button class="commit-asset-btn" data-wl="${wl.key}" data-idx="${idx}" style="background:#22c55e; color:#fff; border:none; padding:2px 6px; border-radius:3px; font-size:9px; cursor:pointer;">📌 資産として確定</button>`}
                        </div>
                    </div>`;
        }).join("")
            }
</div>` : "";

        // Risks & Guardrails
        const risksHtml = item.risks ? `<div style="margin-top:10px; font-size:10px;"><span style="color:#f59e0b;">⚡ 詰まりポイント:</span> <span style="color:#aaa;">${item.risks.slice(0, 2).map(r => sanitize(r)).join(", ")}</span></div>` : "";
        const guardrailsHtml = item.guardrails ? `<div style="font-size:10px; margin-top:4px;"><span style="color:#22c55e;">🛡️ 復帰手順:</span> <span style="color:#aaa;">${item.guardrails.slice(0, 2).map(g => sanitize(g)).join(", ")}</span></div>` : "";

        // Evidence
        const evidenceHtml = item.evidence ? `
            <div style="background:rgba(100,100,100,0.2); padding:8px; border-radius:6px; margin-top:10px;">
                <div style="font-size:10px; color:#9ca3af; margin-bottom:4px;">📋 Evidence</div>
                ${item.evidence.slice(0, 2).map(e => `<div style="font-size:10px; color:#6b7280; margin-bottom:4px; font-style:italic;">"${sanitize(e.log_excerpt?.slice(0, 50) || "")}..."</div>`).join("")}
            </div>` : "";

        // Rubric detail
        const scoreColor = (item.rubric_score || 0) >= 90 ? wl.color : "#ef4444";
        const rd = item.rubric_detail || {} as any;
        const hasDetail = rd.consistency !== undefined;
        const detailHtml = hasDetail ? `
            <div style="margin-top:6px; font-size:9px; color:#9ca3af; display:flex; flex-wrap:wrap; gap:3px;">
                <span style="color:${rd.consistency >= 16 ? '#22c55e' : '#ef4444'}">一貫${rd.consistency}</span>
                <span style="color:${rd.causality >= 16 ? '#22c55e' : '#ef4444'}">因果${rd.causality}</span>
                <span style="color:${rd.actionability >= 12 ? '#22c55e' : '#ef4444'}">実行${rd.actionability}</span>
                <span style="color:${rd.asset_leverage >= 12 ? '#22c55e' : '#ef4444'}">資産${rd.asset_leverage}</span>
                <span style="color:${rd.guardrail_sanity >= 12 ? '#22c55e' : '#ef4444'}">安全${rd.guardrail_sanity}</span>
                <span style="color:${rd.evidence_grounding >= 12 ? '#22c55e' : '#ef4444'}">根拠${rd.evidence_grounding}</span>
            </div>` : "";

        // Leap三段セクション
        let leapSectionsHtml = "";
        if (wl.key === "worldline_leap" && item.leap_sections) {
            const ls = item.leap_sections;
            const sectionData = [
                { title: "🪞 Evidence Mirror", content: ls.evidence_mirror, color: "#38bdf8" },
                { title: "🌀 Chaos Leap", content: ls.chaos_leap, color: "#d946ef" },
                { title: "🌱 Action Seeds", content: ls.action_seeds, color: "#22c55e" },
            ];
            leapSectionsHtml = sectionData
                .filter(s => s.content)
                .map(s => `
                    <details class="leap-section" open>
                        <summary style="font-size:12px; font-weight:bold; color:${s.color}; cursor:pointer; padding:6px 0; list-style:none; display:flex; align-items:center; gap:6px;">
                            <span style="font-size:8px;">▶</span> ${s.title}
                        </summary>
                        <div style="font-size:12px; color:#ccc; line-height:1.6; padding:4px 0 10px 8px; white-space:pre-wrap;">${sanitize(s.content || "")}</div>
                    </details>
                `).join("");
            if (leapSectionsHtml) {
                leapSectionsHtml = `
                    <div style="background:rgba(217,70,239,0.08); border:1px solid rgba(217,70,239,0.25); border-radius:8px; padding:12px; margin-bottom:12px;">
                        <div style="font-size:10px; color:#d946ef; margin-bottom:6px; letter-spacing:1px;">🎯 LEAP三段構造</div>
                        ${leapSectionsHtml}
                    </div>`;
            }
        }

        card.className = "future-lab-card";
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                <span style="color:${wl.color}; font-weight:bold; font-size:12px;">${wl.icon} ${wl.label}</span>
                <div style="text-align:right;">
                    <span style="background:${scoreColor}; color:#fff; font-size:10px; padding:2px 6px; border-radius:4px;">Score: ${item.rubric_score}${(item.rubric_score || 0) < 90 ? ' ⚠️' : ''}</span>
                    ${detailHtml}
                </div>
            </div>
            <h4 style="margin:0 0 8px; font-size:16px; color:#fff;">${sanitize(item.title)}</h4>
            ${storyModeEnabled
                ? `<p style="font-size:12px; color:#ccc; line-height:1.5; margin-bottom:12px; font-style:italic;">"${sanitize(item.narrative)}"</p>`
                : `<p style="font-size:11px; color:#666; margin-bottom:8px;">📐 設計図モード（Story ModeをONで物語表示）</p>`}
            ${leapSectionsHtml}
            ${roadmapHtml}
            <div style="background:${wl.color}11; padding:12px; border-radius:6px; border:1px solid ${wl.color}33; margin-bottom:12px;">
                <div style="font-size:10px; color:${wl.color}; margin-bottom:8px; letter-spacing:1px;">
                    ${wl.key === "worldline_guardrail" ? "🛡️ 15分で復帰の足場を作る" : "🚀 MICRO STEPS (15分以内)"}
                </div>
                ${stepsHtml}
            </div>
            <details style="margin-top:8px; border-top:1px solid rgba(255,255,255,0.1); padding-top:8px;">
                <summary style="font-size:11px; color:#aaa; cursor:pointer; list-style:none; display:flex; align-items:center; gap:4px;">
                    <span style="font-size:10px;">▶</span> 詳細を表示 (Assets, Risks, Evidence)
                </summary>
                <div style="padding-top:8px;">
                    ${assetHtml}
                    ${risksHtml}
                    ${guardrailsHtml}
                    ${evidenceHtml}
                </div>
            </details>`;
        container.appendChild(card);
    });

    // Bind event listeners
    container.querySelectorAll(".memo-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const wlKey = btn.getAttribute("data-wl")!;
            const idx = parseInt(btn.getAttribute("data-idx")!, 10);
            actions.onMemoMicroStep(wlKey, idx);
        });
    });
    container.querySelectorAll(".commit-asset-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            actions.onCommitAsset(btn.getAttribute("data-wl")!, parseInt(btn.getAttribute("data-idx")!, 10));
        });
    });
    container.querySelectorAll(".asset-prompt-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            actions.onShowAssetPrompt(btn.getAttribute("data-asset")!);
        });
    });
}
