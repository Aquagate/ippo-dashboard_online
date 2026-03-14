const { generateCompletion } = require('./llm_client');

// Force REAL mode
process.env.LLM_MOCK = "false";
// Use the 12B model for benchmarking
process.env.LLM_MODEL = "gemma3:12b";

async function testConnection() {
    console.log("🤖 Testing Local LLM Connection (Ollama)...");
    console.log(`Target Endpoint: ${process.env.LLM_ENDPOINT || 'http://localhost:11434/api/generate'}`);
    console.log(`Target Model: ${process.env.LLM_MODEL}`);

    const prompt = "This is a connection test. Please reply with only the word 'Connected' in JSON format like {\"status\": \"Connected\"}.";

    const startTime = Date.now();
    try {
        console.log("⏳ Sending request... (This might take a few seconds for model loading)");
        const result = await generateCompletion(prompt);
        const duration = Date.now() - startTime;

        console.log("\n✅ Response Received:");
        console.log(JSON.stringify(result, null, 2));
        console.log(`⏱️ Duration: ${duration}ms`);

        if (result.trigger_text === "Unknown" && result.reason === "Generic fallback response.") {
            console.log("\n⚠️  WARNING: Response looks like a MOCK response. Connection might have failed silently.");
        } else {
            console.log("\n🎉 Connection Successful! Local LLM is active.");
        }
    } catch (error) {
        console.error("\n❌ Connection Failed:", error);
    }
}

testConnection();
