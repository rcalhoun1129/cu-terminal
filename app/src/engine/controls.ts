/** Named control cells. Buyout control keys carry an athlete surname in the source workbook, so they are matched by pattern. */
export const ctl = {
  buyout25: (C: Record<string, number>) => C[Object.keys(C).find((k) => /^\S+ buyout$/.test(k)) ?? ''] ?? 0,
  buyout26: (C: Record<string, number>) => C[Object.keys(C).find((k) => / F26 buyout \(current book\)$/.test(k)) ?? ''] ?? 0,
};
