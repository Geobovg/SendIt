// Delt mellom serveren (getCatalogPage) og katalogen i nettleseren.
export type CatalogFilters = { search: string; position: string; minimum: number; maximumPrice: number | null; clubs: string[]; sort: "overall" | "price-asc" | "price-desc" };
export const defaultCatalogFilters: CatalogFilters = { search: "", position: "all", minimum: 0, maximumPrice: null, clubs: [], sort: "overall" };
export const catalogPageSize = 24;
/** Posisjonene et kort kan ha, som hovedposisjon eller alternativ (migrering 0109). */
export const catalogPositions = ["GK", "RB", "CB", "LB", "CDM", "CM", "CAM", "RW", "LW", "ST"];
