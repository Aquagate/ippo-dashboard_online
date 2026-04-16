const fs = require('fs-extra');
const path = require('path');
const config = require('./config');
const { generateCompletion } = require('./llm_client');

const INTAKES_FILE = config.PATHS.INTAKES_FILE;
const PROPOSALS_FILE = config.PATHS.PROPOSALS_FILE;

async function analyzePatterns() {
    console.log('🤖 Starting AI Pattern Analysis...');

    // 1. Load Data
    const intakes = await fs.readJson(INTAKES_FILE).catch(() => []);
    let proposals = await fs.readJson(PROPOSALS_FILE).catch(() => []);

    // 2. Filter Targets
    // Target: Done tasks, resolved manually (referencing MAN-999 or implicit manual handling), and NOT analyzed yet.
    // For MVP, we just pick tasks that used "MAN-999" (Others)
    const targets = intakes.filter(i =>
        i.status === 'DONE' &&
        i.resolution &&
        i.resolution.manual_ref_id === 'MAN-999' // "Others"
    );

    console.log(`Found ${targets.length} candidates for analysis.`);

    if (targets.length === 0) {
        console.log('No implicit knowledge found. Exiting.');
        return;
    }

    // 3. Analyze each target
    for (const task of targets) {
        // Check if already proposed? (Skip for MVP efficiency)

        console.log(`\nAnalyzing Task: ${task.summary}`);

        // [Feedback Loop] Find latest APPROVED proposals to use as Few-Shot examples
        const approvedExamples = proposals
            .filter(p => p.status === 'APPROVED')
            .slice(-2) // Take last 2 examples
            .map(p => {
                return `Example Input: ${p.source_task}\nExample Output JSON: ${JSON.stringify({
                    suggested_title: p.ai_result.suggested_title,
                    category: p.ai_result.category,
                    reason: p.ai_result.reason
                }, null, 0)}`; // Minified JSON for token efficiency
            }).join("\n\n");

        const prompt = `
        You are an Ops Manager Assistant. Analyze the following IT support ticket and propose a new manual title if the resolution is reusable.
        
        ${approvedExamples ? `[Learning from Past Approvals]\n${approvedExamples}\n` : ''}
        
        [Current Request]
        Summary: ${task.summary}
        Details: ${task.details}
        
        [Resolution]
        Answer: ${task.resolution.final_answer}
        
        Output valid JSON only. Do not add any markdown formatting.
        **IMPORTANT: All values (suggested_title, reason, etc.) must be in JAPANESE.**
        
        Example format:
        {
            "trigger_text": "Keywords that trigger this manual (can be mixed)",
            "suggested_title": "マニュアルのタイトル (日本語)",
            "category": "One of [Account, Network, Device, Application, Other]",
            "reason": "なぜ標準化すべきかの理由 (日本語)"
        }
        `;

        let result = await generateCompletion(prompt);
        console.log('AI Suggestion (Raw):', result);

        // Clean response if it contains markdown code blocks
        if (typeof result === 'string') {
            try {
                const cleaned = result.replace(/```json\s*|\s*```/g, '').trim();
                result = JSON.parse(cleaned);
            } catch (e) {
                console.warn('Failed to parse AI response:', e);
                // Continue to next item if parsing fails
                continue;
            }
        }

        console.log('AI Suggestion (Parsed):', result);

        // 4. Quality Check (Rubric Engine)
        let rubricResult = null;
        let status = 'PENDING'; // Define outside scope

        if (result && result.suggested_title) {
            console.log('Running Rubric Evaluation...');
            const { evaluateAnswer } = require('./rubric_engine');
            // We evaluate the AI's "reason" or "suggested_title" against the context of the task.
            // Ideally we check if the suggestion makes sense given the task details.
            // For now, we use the "reason" as the target for G/S/T check.
            rubricResult = await evaluateAnswer(result.reason, `Task: ${task.summary}\n${task.details}`);
            console.log('Rubric Score:', rubricResult.finalScore, rubricResult.class);

            // Block if Safety violation
            if (rubricResult.class === 'BLOCKED') {
                console.warn('Proposal BLOCKED by Rubric Engine. Saving as BLOCKED record.');
                status = 'BLOCKED';
            }
        }

        // 5. Save Proposal
        if (result && result.suggested_title && result.trigger_text) {
            const proposal = {
                proposal_id: `PROP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                intake_id: task.intake_id,
                source_task: task.summary,
                ai_result: result,
                rubric: rubricResult, // Save score
                status: status, // PENDING or BLOCKED
                created_at: new Date().toISOString()
            };
            proposals.push(proposal);
        }
    }

    // 5. Write back
    await fs.writeJson(PROPOSALS_FILE, proposals, { spaces: 2 });
    console.log(`\n✅ Analysis Complete. Saved ${proposals.length} proposals.`);
}

analyzePatterns();
