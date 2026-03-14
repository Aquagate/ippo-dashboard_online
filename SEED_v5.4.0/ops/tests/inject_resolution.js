const fs = require('fs-extra');
const config = require('../config');

async function inject() {
    console.log('💉 Injecting resolution data for Pattern Analysis test...');
    const intakes = await fs.readJson(config.PATHS.INTAKES_FILE);

    // Find Project A (Summary: Fix Login Button Alignment)
    const target = intakes.find(i => i.summary === 'Fix Login Button Alignment');
    if (target) {
        target.resolution = {
            final_answer: "Fixed CSS flexbox alignment.",
            manual_ref_id: "MAN-999" // Trigger for analysis
        };
        await fs.writeJson(config.PATHS.INTAKES_FILE, intakes, { spaces: 2 });
        console.log(`✅ Injected resolution into ${target.intake_id}`);
    } else {
        console.error('❌ Project A not found');
    }
}

inject();
