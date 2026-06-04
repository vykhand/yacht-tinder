/**
 * Core domain types for yacht-tinder. These are the contract between the
 * offline pipeline (scrape → embed) and the runtime app.
 */

export interface SeasonalRate {
  /** e.g. "Season A" */
  label: string;
  /** raw date range, kept verbatim — parsing dates from WP text is fragile */
  dateRange: string;
  /** weekly price in EUR, normalized to an integer */
  priceEur: number | null;
}

export interface Yacht {
  /** stable slug from the detail URL, e.g. "tatiana-i" */
  id: string;
  name: string;
  /** absolute detail URL */
  url: string;
  /** e.g. "FRANCE" (uppercased as the site presents it), or null */
  destination: string | null;

  // pricing (weekly, EUR)
  priceFromEur: number | null;
  priceToEur: number | null;

  // dimensions
  lengthM: number | null;
  beamM: number | null;
  draftM: number | null;
  cruiseSpeedKn: number | null;

  // build
  builtYear: number | null;
  renovatedYear: number | null;

  // capacity
  cabins: number | null;
  maxGuests: number | null;
  crewCount: number | null;
  crewRaw: string | null;

  waterSports: string[];
  description: string | null;
  seasonalRates: SeasonalRate[];
  images: string[];

  /** ISO timestamp of when this record was scraped */
  scrapedAt: string;
}

/** One yacht's precomputed embedding vector. */
export interface EmbeddingRecord {
  id: string;
  vector: number[];
}

/** Hard constraints extracted from a natural-language query (no LLM). */
export interface HardFilters {
  maxPriceEur?: number;
  minPriceEur?: number;
  minGuests?: number;
  destination?: string;
  waterSports?: string[];
}

/** A yacht plus its relevance score and which filters it matched. */
export interface RankedYacht {
  yacht: Yacht;
  score: number;
  matched: string[];
}
