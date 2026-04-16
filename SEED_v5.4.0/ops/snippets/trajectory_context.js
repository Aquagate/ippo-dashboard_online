/**
 * Trajectory Context Injection (Butterfly Analysis v2)
 * 
 * 過去のシミュレーション結果を要約し、現在の差分ログと共に
 * LLMに注入するアーキテクチャ。
 */

function buildPreviousSimSummary(sim) {
    if (!sim || !sim.result) return "No previous simulation data.";
    const r = sim.result;

    // v5.2 / v5.3 Schema 共通
    const worldlines = r.worldline_baseline
        ? [{ k: "baseline", v: r.worldline_baseline }, { k: "leap", v: r.worldline_leap }, { k: "guardrail", v: r.worldline_guardrail }]
        : [{ k: "solid", v: r.persona_solid }, { k: "leap", v: r.persona_leap }];

    let summary = "## Previous Outcomes Outline\n";
    worldlines.forEach(wl => {
        if (!wl.v) return;
        summary += `### ${wl.k.toUpperCase()}: ${wl.v.title || "Untitled"}\n`;
        summary += `- Outcome: ${wl.v.narrative || "No narrative"}\n`;
        const steps = wl.v.micro_steps || wl.v.next_steps || [];
        if (steps.length > 0) {
            const topStep = typeof steps[0] === 'string' ? steps[0] : steps[0].action;
            summary += `- Top Next Step: ${topStep}\n`;
        }
    });

    return summary;
}

/**
 * generatePrompt 内での注入例
 */
function injectTrajectoryContext(dataCache) {
    const sims = (dataCache.simulations || []).filter(s => !s.deleted);
    const previousSim = sims.length > 0 ? sims[0] : null;

    if (previousSim) {
        const contextText = buildPreviousSimSummary(previousSim);
        // プロンプトの ## Context セクションに注入
        return `
## Previous Simulation Context (Butterfly Analysis)
${contextText}

## New Logs Since Last Simulation
[NEW_LOG_DATA_HERE]

Instructions: Analyze the trajectory shift from the previous outcomes based on new logs.
      `;
    }
    return "First simulation: No previous context.";
}
