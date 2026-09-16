export interface CalendarCell {
  iso: string;
  day: number;
  inCurrentMonth: boolean;
  inCandidateRange: boolean;
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Monday-first calendar grid for the given month, clipped to the candidate date range. */
export function getMonthGrid(year: number, month: number, rangeStartIso: string, rangeEndIso: string): CalendarCell[] {
  const firstOfMonth = new Date(year, month, 1);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - mondayOffset);

  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const iso = toIso(d);
    cells.push({
      iso,
      day: d.getDate(),
      inCurrentMonth: d.getMonth() === month,
      inCandidateRange: iso >= rangeStartIso && iso <= rangeEndIso,
    });
  }

  // Trim trailing all-next-month weeks for a tighter grid.
  while (cells.length > 7 && cells.slice(-7).every((c) => !c.inCurrentMonth)) {
    cells.splice(-7, 7);
  }

  return cells;
}
