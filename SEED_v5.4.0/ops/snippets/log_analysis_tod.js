/**
 * TOD (Time of Day) Statistics Generator
 * Extracted from Ippo Dashboard v2.0 (AI Bridge)
 * 
 * ログデータに含まれるTODタグを集計し、LLM向けのコンテキスト文字列を生成する。
 * 
 * @param {Array} entries - ログエントリの配列。各エントリは { tod: string[] } を持つと想定。
 * @returns {string} - LLMコンテキスト用の統計文字列 (例: "- morning: 40% (4回)")
 */
function generateTodContext(entries) {
  const todMap = { "morning": "🌅", "afternoon": "☀️", "day": "☀️", "night": "🌙" };
  const todStats = { "morning": 0, "afternoon": 0, "day": 0, "night": 0 };
  let todTotal = 0;

  entries.forEach(e => {
    if (e.tod && Array.isArray(e.tod)) {
      e.tod.forEach(t => {
        if (todStats[t] !== undefined) {
          todStats[t]++;
          todTotal++;
        }
      });
    }
  });

  if (todTotal === 0) return "No time-of-day tags found.";

  return Object.entries(todStats)
    .filter(([k, v]) => v > 0)
    .map(([k, v]) => `- ${k}: ${Math.round((v / todTotal) * 100)}% (${v}回)`)
    .join("\n");
}

/**
 * Log Formatter with TOD Injection
 * 
 * ログの各行にTOD情報を埋め込むフォーマッター。
 * 
 * @param {Object} entry - ログエントリ
 * @returns {string} - フォーマット済みログ行
 */
function formatLogWithTod(entry) {
  const todMap = { "morning": "🌅", "afternoon": "☀️", "day": "☀️", "night": "🌙" };
  const tods = (entry.tod || []).map(k => {
    const icon = todMap[k] || "";
    return icon ? `${icon}(${k})` : "";
  }).join(" ");
  
  const todStr = tods ? ` ${tods}` : "";
  return `${entry.date}${todStr} [${entry.category}]: ${entry.text}`;
}

module.exports = { generateTodContext, formatLogWithTod };
