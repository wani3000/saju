import { z } from "zod";
import catalog from "../../content/readings.json";
import { buildSelectedReading, selectedReadingPolicy, buildBetaReading, privateBetaScope } from "../generated/selected-reading.mjs";
import { AppError, type Reading } from "../domain/model";
import { addSymbolicReading, symbolicReadingVersion } from "../domain/symbolic-reading";
import { buildWholeChartReading,wholeChartVersion } from "../domain/whole-chart-reading";

const text = z.string().trim().min(1).max(160);
const releaseSchema = z.object({
  version: z.string().min(1),
  kind: z.literal("generic-conversation-example"),
  birthDerived: z.literal(false),
  productionApproved: z.literal(false),
  editorialReview: z.object({ reviewer: text, reviewedOn: text, scope: text }).strict(),
  domainReview: z.object({ status: z.literal("pending"), reviewer: z.null() }).strict(),
  reading: z.object({
    label: text, title: text, strength: text, difference: text, advice: text,
    ruleVersion: z.string().min(1), score: z.null(),
  }).strict(),
}).strict();
// No expressions or weights are executable from the catalog. These entries are
// generic examples, never evidence of an approved birth-derived interpretation.
export function validateReadingCatalog(input: unknown) {
  const parsed = z.object({ schemaVersion: z.literal(1), currentVersion: z.string(),
    releases: z.array(releaseSchema).min(1) }).strict().parse(input);
  const keys = new Set<string>();
  for (const release of parsed.releases) {
    if (keys.has(release.version) || release.reading.ruleVersion !== release.version)
      throw new Error("INVALID_READING_VERSION");
    keys.add(release.version);
  }
  if (!keys.has(parsed.currentVersion)) throw new Error("MISSING_CURRENT_READING");
  return parsed;
}
import {addEasyRelationshipReading,easyReadingVersion} from "../domain/easy-relationship-reading";

const checked = validateReadingCatalog(catalog);
export const currentReadingVersion = easyReadingVersion;
export function readingForVersion(version: string, context?: {
  charts: Record<string, unknown>; relation: string;
}): Reading {
  if ([easyReadingVersion,wholeChartVersion,symbolicReadingVersion,selectedReadingPolicy.version,privateBetaScope.readingVersion].includes(version)) {
    if (!context) throw new AppError("READING_CONTEXT_REQUIRED", 503,
      "저장된 계산을 확인할 수 없어요. 잠시 후 다시 시도해 주세요.");
    try {
      if(version===easyReadingVersion) return addEasyRelationshipReading(buildWholeChartReading(
        buildBetaReading(context.charts.me,context.charts.other,context.relation),context.charts,context.relation),context.relation);
      if(version===wholeChartVersion) return buildWholeChartReading(
        buildBetaReading(context.charts.me,context.charts.other,context.relation),context.charts,context.relation);
      if (version === symbolicReadingVersion) return addSymbolicReading(
        buildBetaReading(context.charts.me, context.charts.other, context.relation),context.charts,context.relation);
      return (version === privateBetaScope.readingVersion ? buildBetaReading : buildSelectedReading)(context.charts.me, context.charts.other, context.relation);
    } catch {
      throw new AppError("READING_CONTEXT_INVALID", 503,
        "저장된 계산을 확인할 수 없어요. 잠시 후 다시 시도해 주세요.");
    }
  }
  const entry = checked.releases.find((r) => r.version === version);
  if (!entry) throw new AppError("READING_VERSION_UNAVAILABLE", 503,
    "저장된 풀이 버전을 확인하고 있어요. 잠시 후 다시 시도해 주세요.");
  return { ...entry.reading };
}
