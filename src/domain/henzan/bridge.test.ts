import { describe, it, expect } from 'vitest';
import { validateHenzanBridgeRun, validateHenzanProposal } from './validate';
import { type HenzanBridgeRun, type HenzanProposal } from './schema';

describe('HenzanBridge Validation', () => {
    describe('validateHenzanBridgeRun', () => {
        it('should pass valid bridge run', () => {
            const run: HenzanBridgeRun = {
                id: 'run_123',
                prompt_version: 'discovery-v1',
                mode: 'discovery',
                window_days: 60,
                created_at: 1000,
                proposal_ids: ['pro_1', 'pro_2']
            };
            const res = validateHenzanBridgeRun(run);
            expect(res.valid).toBe(true);
            expect(res.errors.length).toBe(0);
        });

        it('should fail missing required fields', () => {
            const run = { id: 'run_123' } as HenzanBridgeRun;
            const res = validateHenzanBridgeRun(run);
            expect(res.valid).toBe(false);
            expect(res.errors.length).toBeGreaterThan(0);
        });
    });

    describe('validateHenzanProposal', () => {
        it('should pass valid create proposal', () => {
            const proposal: HenzanProposal = {
                id: 'pro_123',
                run_id: 'run_123',
                operation: 'create',
                target_asset_id: null,
                merge_target_id: null,
                candidate: {
                    name: 'Test Skill',
                    type: '技能',
                    scale: '小',
                    summary: 'Test summary'
                },
                evidence_log_ids: ['log_1', 'log_2'],
                evidence_quotes: ['quote 1', 'quote 2'],
                reason: 'It is a new skill',
                confidence: '高',
                resolved: false,
                created_at: 1000,
            };
            const res = validateHenzanProposal(proposal);
            expect(res.valid).toBe(true);
        });

        it('should fail missing candidate name for create operation', () => {
            const proposal: HenzanProposal = {
                id: 'pro_123',
                run_id: 'run_123',
                operation: 'create',
                target_asset_id: null,
                merge_target_id: null,
                candidate: { type: '技能', scale: '小', summary: 'Missing name' } as any,
                evidence_log_ids: [],
                evidence_quotes: [],
                reason: 'Test',
                confidence: '低',
                resolved: false,
                created_at: 1000,
            };
            const res = validateHenzanProposal(proposal);
            expect(res.valid).toBe(false);
            expect(res.errors).toContain('operation: "create" needs candidate.name and candidate.type');
        });

        it('should require target_asset_id for update_existing', () => {
            const proposal: HenzanProposal = {
                id: 'pro_123',
                run_id: 'run_123',
                operation: 'update_existing',
                target_asset_id: null, // missing target
                merge_target_id: null,
                candidate: { summary: 'Update info' },
                evidence_log_ids: [],
                evidence_quotes: [],
                reason: 'Update details',
                confidence: '中',
                resolved: false,
                created_at: 1000,
            };
            const res = validateHenzanProposal(proposal);
            expect(res.valid).toBe(false);
            expect(res.errors).toContain('operation: "update_existing" needs target_asset_id');
        });

        it('should require merge_target_id for merge_into_existing', () => {
            const proposal: HenzanProposal = {
                id: 'pro_123',
                run_id: 'run_123',
                operation: 'merge_into_existing',
                target_asset_id: 'asset_1',
                merge_target_id: null, // missing merge target
                candidate: {},
                evidence_log_ids: [],
                evidence_quotes: [],
                reason: 'Merge',
                confidence: '中',
                resolved: false,
                created_at: 1000,
            };
            const res = validateHenzanProposal(proposal);
            expect(res.valid).toBe(false);
            expect(res.errors).toContain('operation: "merge_into_existing" needs target_asset_id and merge_target_id');
        });
    });
});
