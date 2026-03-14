// ===== Data Model Types =====

export interface Entry {
    id: string;
    date: string;
    text: string;
    category: string;
    energy?: number | null;
    morningEnergy?: number | null;
    nightEnergy?: number | null;
    starred?: boolean;
    tod: string[];
    ts: number;
    updatedAt: number;
    deleted: boolean;
    rev: number;
    deviceId: string;
}

export interface Memo {
    id: string;
    text: string;
    createdAt: number;
    updatedAt: number;
    done: boolean;
    deleted: boolean;
    rev: number;
    deviceId: string;
}

export interface SimulationRoadmapItem {
    horizon: string;
    outcome: string;
    measurement?: string;
    focus?: string;
}

export interface SimulationMicroStep {
    action: string;
    reason: string;
}

export interface SimulationAssetStep {
    asset: string;
    type: string;
    why: string;
}

export interface SimulationEvidence {
    log_excerpt: string;
    why: string;
}

export interface RubricDetail {
    consistency: number;
    causality: number;
    actionability: number;
    asset_leverage: number;
    guardrail_sanity: number;
    evidence_grounding: number;
}

export interface Worldline {
    title: string;
    narrative: string;
    roadmap?: SimulationRoadmapItem[];
    micro_steps?: SimulationMicroStep[];
    next_steps?: any[];
    asset_steps?: SimulationAssetStep[];
    risks?: string[];
    guardrails?: string[];
    evidence?: SimulationEvidence[];
    /** Leap専用: 3セクション構造 (Evidence Mirror / Chaos Leap / Action Seeds) */
    leap_sections?: {
        evidence_mirror?: string;
        chaos_leap?: string;
        action_seeds?: string;
    };
    rubric_score: number;
    rubric_reason?: string;
    rubric_detail?: RubricDetail;
}

export interface SimulationResult {
    meta?: {
        version: string;
        generated_at: string;
        time_horizon_days: number;
        notes?: string;
        trajectory_shift?: string;
    };
    worldline_baseline?: Worldline;
    worldline_leap?: Worldline;
    worldline_guardrail?: Worldline;
    persona_solid?: Worldline;
    persona_leap?: Worldline;
    worldlines?: any[];
}

export interface AssetCommit {
    worldline: string;
    assetIndex: number;
    committedAt: number;
    asset: string;
    type: string;
    why: string;
    customPrompt?: string;
    updatedAt?: number;
}

export interface SimulationCommit {
    worldline: string;
    stepIndex: number;
    committedAt: number;
}

export interface Simulation {
    id: string;
    createdAt: number;
    updatedAt: number;
    promptVersion: string;
    logWindowDays: number;
    recentCount: number;
    seedKey?: string | null;
    inputDigest: any;
    result: SimulationResult;
    commit: SimulationCommit | null;
    assetCommits: AssetCommit[];
    memoedStepIndices: string[];
    deleted: boolean;
    rev: number;
    deviceId: string;
}

export interface DailyState {
    morningEnergy?: number | null;
    nightEnergy?: number | null;
    updatedAt?: number;
    rev: number;
    deviceId: string;
}

export interface DataCache {
    schemaVersion: number;
    entries: Entry[];
    memos: Memo[];
    simulations: Simulation[];
    dailyStates: Record<string, DailyState>;
}

export const MAX_SIMULATION_HISTORY = 20;
