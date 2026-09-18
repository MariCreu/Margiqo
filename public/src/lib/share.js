import { money } from "./format.js";
import { getStrings, getNumberLocale } from "./i18n.js";

/**
 * A plain-text summary a merchant can paste into Slack/email — deliberately
 * not a PDF or a hosted link: nothing about the scan is stored anywhere,
 * so there's nothing to link to.
 */
export function buildShareSummary(report, { isDemo = false, locale = "en" } = {}) {
  const t = getStrings(locale).share;
  const numberLocale = getNumberLocale(locale);
  const lines = [];
  lines.push(t.title(isDemo));
  lines.push(getStrings(locale).app.headline.leaksDetected(report.headline.leaksCount));
  if (report.headline.knownMarginAtRisk > 0) {
    lines.push(getStrings(locale).app.headline.atRisk(money(report.headline.knownMarginAtRisk, report.currency, numberLocale)));
  }
  lines.push("");

  for (const leak of report.leaks) {
    const impact = leak.knownProductMargin !== null ? money(leak.knownProductMargin, report.currency, numberLocale) : t.unknown;
    lines.push(`${leak.severity} — ${leak.title}: ${impact} — ${leak.whatWeFound}`);
  }

  lines.push("");
  lines.push(t.notIncludedLine);
  lines.push(t.generatedBy);

  return lines.join("\n");
}
