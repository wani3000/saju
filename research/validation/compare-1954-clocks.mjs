/** Two explicit research hypotheses. Does not replace the pinned app timezone table. */
const oldOffset = 9 * 3600, newOffset = 8.5 * 3600;
const models = [
  {id: 'iana-2025b', transition: Date.UTC(1954, 2, 20, 15),
    assumption: 'IANA 1954 Mar 21 default wall 00:00 uses the outgoing +09 offset.'},
  {id: 'gazette-outgoing-clock-hypothesis', transition: Date.UTC(1954, 2, 20, 15, 30),
    assumption: 'Read the gazette 00:30 as outgoing +09 clock, then move back to 00:00. Not yet established as actual practice.'},
];

export function compare1954Clocks({year, month, day, hour, minute, second = 0} = {}) {
  if (year !== 1954 || month !== 3 || ![20, 21].includes(day) ||
      ![hour, minute, second].every(Number.isInteger) || hour < 0 || hour > 23 ||
      minute < 0 || minute > 59 || second < 0 || second > 59) throw new Error('OUT_OF_1954_REVIEW_RANGE');
  const wall = Date.UTC(year, month - 1, day, hour, minute, second);
  const results = models.map(model => {
    const candidates = [oldOffset, newOffset].flatMap(offsetSeconds => {
      const instant = wall - offsetSeconds * 1000;
      const active = instant < model.transition ? oldOffset : newOffset;
      return active === offsetSeconds ? [{prolepticUtc: new Date(instant).toISOString(), offsetSeconds}] : [];
    });
    return {model: model.id, assumption: model.assumption,
      transitionProlepticUtc: new Date(model.transition).toISOString(),
      status: ['nonexistent', 'unique', 'ambiguous'][candidates.length], candidates};
  });
  return {productionApproved: false, models: results,
    agreed: JSON.stringify(results[0].candidates) === JSON.stringify(results[1].candidates)};
}
