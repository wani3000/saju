import type { Reading } from "../domain/model";
export function buildSelectedReading(first: unknown, second: unknown, relationship: string): Reading;
export const selectedReadingPolicy: {
  version: string;
  status: "selected-for-app-review";
  productionApproved: false;
  engineVersion: string;
  definitionVersion: string;
  includedRuleIds: readonly string[];
};
export function buildBetaReading(first: unknown, second: unknown, relationship: string): Reading;
export const privateBetaScope: {scopeVersion: string; readingVersion: string; productionApproved: false; realCharges: false};
export function validateBetaScope(scope: unknown): unknown;
