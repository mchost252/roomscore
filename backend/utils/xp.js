const PRIORITY_MULTIPLIER = Object.freeze({
  low: 1,
  medium: 1.25,
  high: 1.5,
  urgent: 2,
});

function calculateTaskXp(points = 10, priority = 'medium') {
  const basePoints = Number.isFinite(Number(points)) ? Number(points) : 10;
  const multiplier = PRIORITY_MULTIPLIER[priority] || PRIORITY_MULTIPLIER.medium;
  return Math.round(basePoints * multiplier);
}

module.exports = { calculateTaskXp, PRIORITY_MULTIPLIER };
