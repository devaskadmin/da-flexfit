/**
 * StreakCalculator.js
 * FlexFit v0.82.20 – Dashboard Live Metrics
 *
 * Calculates the current consecutive-day workout streak from an array of
 * DISTINCT workout date strings (YYYY-MM-DD).
 */

/**
 * @param {string[]} dateStrings - DISTINCT workout date strings (any order).
 * @returns {number} Current streak length in days (0 if no active streak).
 */
function calculateStreak(dateStrings) {
  if (!dateStrings || dateStrings.length === 0) return 0;

  // Normalise to YYYY-MM-DD, deduplicate, sort descending
  const dates = [...new Set(dateStrings.map((d) => String(d).slice(0, 10)))].sort(
    (a, b) => (a > b ? -1 : 1)
  );

  const toMidnight = (str) => {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const mostRecent = toMidnight(dates[0]);

  // Streak is only alive if the most-recent workout was today or yesterday
  if (mostRecent < yesterday) return 0;

  let streak = 1;

  for (let i = 1; i < dates.length; i++) {
    const prev = toMidnight(dates[i - 1]);
    const curr = toMidnight(dates[i]);
    const diffDays = Math.round((prev - curr) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      streak++;
    } else {
      break; // gap found — streak ends here
    }
  }

  return streak;
}

module.exports = { calculateStreak };
