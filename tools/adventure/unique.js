/**
 * Unique-touch slot. v0 records the ask and does not call Imagine.
 */

export function requestUniqueTouch(card) {
  const rows = card && Array.isArray(card.uniqueTouch) ? card.uniqueTouch : [];
  const slots = [];
  for (let i = 0; i < rows.length && slots.length < 2; i++) {
    const row = rows[i];
    if (!row || typeof row !== "object") continue;
    slots.push({
      id: row.id,
      prompt: row.prompt,
      status: "stub",
    });
  }
  return { imagineCalls: 0, slots };
}
