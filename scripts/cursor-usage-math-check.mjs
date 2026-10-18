/**
 * Self-check for cursor-usage calculator math (assets/js/cursor-usage.js).
 * ponytail: fixed "today" so asserts do not drift with the calendar.
 */

function parseDate(iso) {
  const parts = iso.split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function toIso(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysBetween(start, end) {
  const ms = parseDate(end).getTime() - parseDate(start).getTime();
  return Math.round(ms / 86400000);
}

function addDays(iso, n) {
  const d = parseDate(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
}

function addMonths(iso, months) {
  const d = parseDate(iso);
  return toIso(new Date(d.getFullYear(), d.getMonth() + months, d.getDate()));
}

const GROK_CYCLE_DAYS = 7;

function getWeeklyCycleInfo(resetDateIso, todayIso) {
  const cycleStart = addDays(resetDateIso, -(GROK_CYCLE_DAYS - 1));
  return getCycleInfoFromStart(resetDateIso, cycleStart, todayIso, GROK_CYCLE_DAYS);
}

function getCycleInfo(resetDateIso, todayIso) {
  const cycleStart = addMonths(resetDateIso, -1);
  return getCycleInfoFromStart(resetDateIso, cycleStart, todayIso);
}

function getCycleInfoFromStart(resetDateIso, cycleStart, todayIso, cycleDaysOverride) {
  const cycleDays =
    cycleDaysOverride != null
      ? cycleDaysOverride
      : daysBetween(cycleStart, resetDateIso);
  const daysLeft = daysBetween(todayIso, resetDateIso) + 1;
  const elapsedInclusive = Math.max(daysBetween(cycleStart, todayIso) + 1, 1);
  const daysAfterToday = Math.max(daysLeft - 1, 0);
  return {
    cycleDays,
    daysLeft,
    elapsedInclusive,
    daysAfterToday,
    isWeekly: cycleDaysOverride === GROK_CYCLE_DAYS,
  };
}

function stopAtFromRaw(stopAtRaw, isWeekly) {
  if (isWeekly) {
    return Math.round(stopAtRaw);
  }
  return Math.max(0, Math.floor(stopAtRaw) - 1);
}

function usageMath(usedPct, cycle) {
  const used = Number(usedPct) || 0;
  const elapsedForRate = cycle.isWeekly
    ? Math.max(cycle.cycleDays - cycle.daysLeft, 1)
    : cycle.elapsedInclusive;
  const dailyRate = used / elapsedForRate;
  const projected = used + dailyRate * cycle.daysAfterToday;
  const stopAtRaw = cycle.isWeekly
    ? Math.min(
        100,
        (100 * elapsedForRate) / (elapsedForRate + cycle.daysAfterToday)
      )
    : Math.min(100, (100 * cycle.elapsedInclusive) / cycle.cycleDays);
  const stopAt = stopAtFromRaw(stopAtRaw, cycle.isWeekly);
  return {
    dailyRate,
    projected: Math.round(projected),
    stopAt,
    overPace: used > stopAt,
    overflowRisk: projected > 100,
  };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const reset = "2026-09-19";
const today = "2026-08-30";
const cycle = getCycleInfo(reset, today);

assert(cycle.cycleDays === 31, `cycleDays expected 31, got ${cycle.cycleDays}`);
assert(cycle.elapsedInclusive === 12, `elapsed expected 12, got ${cycle.elapsedInclusive}`);
assert(cycle.daysLeft === 21, `daysLeft expected 21, got ${cycle.daysLeft}`);
assert(cycle.daysAfterToday === 20, `daysAfterToday expected 20, got ${cycle.daysAfterToday}`);

const at12 = usageMath(12, cycle);
assert(at12.dailyRate === 1, `dailyRate expected 1, got ${at12.dailyRate}`);
assert(at12.projected === 32, `forecast expected 32, got ${at12.projected}`);
assert(at12.stopAt === 37, `stopAt expected 37, got ${at12.stopAt}`);
assert(!at12.overPace, "12% should be under pace at stop 37");

const at0 = usageMath(0, cycle);
assert(at0.stopAt === 37, `stopAt at 0% expected 37, got ${at0.stopAt}`);
assert(!at12.overflowRisk, "12% should not overflow");

const day1 = getCycleInfo(reset, "2026-08-19");
const day1Stats = usageMath(12, day1);
assert(day1Stats.projected === 384, `day-1 forecast expected 384, got ${day1Stats.projected}`);

const over = usageMath(40, cycle);
assert(over.overPace, "40% should be over pace");
assert(over.overflowRisk, "40% should forecast overflow");

const grokReset = "2026-09-03";
const grokCycle = getWeeklyCycleInfo(grokReset, today);
assert(grokCycle.cycleDays === 7, `grok cycleDays expected 7, got ${grokCycle.cycleDays}`);
assert(grokCycle.elapsedInclusive === 3, `grok elapsed expected 3, got ${grokCycle.elapsedInclusive}`);
assert(grokCycle.daysLeft === 5, `grok daysLeft expected 5, got ${grokCycle.daysLeft}`);

const grok25 = usageMath(25, grokCycle);
assert(grok25.dailyRate === 12.5, `grok dailyRate expected 12.5, got ${grok25.dailyRate}`);
assert(grok25.projected === 75, `grok forecast expected 75, got ${grok25.projected}`);
assert(grok25.stopAt === 33, `grok stopAt expected 33, got ${grok25.stopAt}`);
assert(!grok25.overPace, "25% should be under grok stop 33");

const grok32 = usageMath(32, grokCycle);
assert(grok32.projected === 96, `grok 32% forecast expected 96, got ${grok32.projected}`);
assert(grok32.stopAt === 33, `grok 32% stopAt expected 33, got ${grok32.stopAt}`);
assert(!grok32.overPace, "32% should be under grok stop 33");

const grok33 = usageMath(33, grokCycle);
assert(grok33.projected === 99, `grok 33% forecast expected 99, got ${grok33.projected}`);
assert(grok33.stopAt === 33, `grok 33% stopAt expected 33, got ${grok33.stopAt}`);
assert(!grok33.overPace, "33% should be at grok stop 33");

const grok34 = usageMath(34, grokCycle);
assert(grok34.overPace, "34% should be over grok stop 33");

console.log("cursor-usage-math-check: ok");
