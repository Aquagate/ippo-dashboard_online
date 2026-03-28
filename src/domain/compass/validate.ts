// ===== 羅針盤: バリデーション =====
// 羅針盤のTrack定義の整合性を検証する。

import {
    REQUIREMENT_TYPES, MISSION_KINDS,
    type CompassTrack,
} from './schema';

export interface ValidationError {
    path: string;
    message: string;
}

export function validateTrack(track: unknown): ValidationError[] {
    const errors: ValidationError[] = [];
    if (!track || typeof track !== 'object') {
        errors.push({ path: 'track', message: 'トラック定義がオブジェクトではありません' });
        return errors;
    }

    const t = track as any;

    if (!t.id || typeof t.id !== 'string') {
        errors.push({ path: 'track.id', message: 'IDが必要です' });
    }
    if (!t.name || typeof t.name !== 'string') {
        errors.push({ path: 'track.name', message: '名前が必要です' });
    }
    if (!Array.isArray(t.levels) || t.levels.length === 0) {
        errors.push({ path: 'track.levels', message: '最低1つの風景（階層）が必要です' });
        return errors;
    }

    t.levels.forEach((level: any, i: number) => {
        const prefix = `track.levels[${i}]`;
        if (!level.id) errors.push({ path: `${prefix}.id`, message: 'IDが必要です' });
        if (typeof level.order !== 'number') errors.push({ path: `${prefix}.order`, message: 'orderが数値ではありません' });
        if (!level.name) errors.push({ path: `${prefix}.name`, message: '名前が必要です' });

        if (Array.isArray(level.requirements)) {
            level.requirements.forEach((req: any, j: number) => {
                const rPrefix = `${prefix}.requirements[${j}]`;
                if (!req.id) errors.push({ path: `${rPrefix}.id`, message: 'IDが必要です' });
                if (!req.type || !REQUIREMENT_TYPES.includes(req.type)) {
                    errors.push({ path: `${rPrefix}.type`, message: `不正な条件種別: ${req.type}` });
                }
                if (!req.expected && req.expected !== '') {
                    errors.push({ path: `${rPrefix}.expected`, message: 'expected値が必要です' });
                }
            });
        }

        if (Array.isArray(level.missions)) {
            level.missions.forEach((m: any, k: number) => {
                const mPrefix = `${prefix}.missions[${k}]`;
                if (!m.id) errors.push({ path: `${mPrefix}.id`, message: 'IDが必要です' });
                if (!m.kind || !MISSION_KINDS.includes(m.kind)) {
                    errors.push({ path: `${mPrefix}.kind`, message: `不正なミッション種別: ${m.kind}` });
                }
            });
        }
    });

    const orders = (t.levels as any[]).map(l => l.order).sort((a, b) => a - b);
    for (let i = 0; i < orders.length; i++) {
        if (orders[i] !== i + 1) {
            errors.push({ path: 'track.levels', message: `orderが1始まりの連番ではありません（期待: ${i + 1}, 実際: ${orders[i]}）` });
            break;
        }
    }

    return errors;
}

export function isValidTrack(track: unknown): track is CompassTrack {
    return validateTrack(track).length === 0;
}
