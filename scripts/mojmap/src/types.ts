/**
 * Shared types for the MOJ-MAP pipeline.
 *
 * A "dataset" is a single CKAN package that corresponds roughly to one 大字
 * (or a packaged bundle of 大字) inside a single 市区町村. The pipeline is
 * dataset-level idempotent: each dataset is processed independently, has its
 * own manifest entry, and a failure on one dataset does not block others.
 */

export interface CkanResource {
  id: string;
  url: string;
  format: string;
  name?: string;
  size?: number;
  hash?: string;
  last_modified?: string;
}

export interface CkanPackage {
  id: string;
  name: string;
  title: string;
  metadata_modified: string;
  /** 市区町村コード — extracted from tags/extras by our CKAN wrapper. */
  municipalityCode: string | null;
  resources: CkanResource[];
}

/**
 * Resolved dataset ready for processing. Pairs a CKAN package with the ZIP
 * resource we plan to download and the municipality code used to pick the
 * CRS zone during parsing.
 */
export interface ResolvedDataset {
  id: string;
  ckanId: string;
  name: string;
  title: string;
  ckanModified: string;
  municipalityCode: string;
  zipUrl: string;
  zipResourceId: string;
}

export interface ManifestDataset {
  ckanId: string;
  ckanModified: string;
  zipSha256: string;
  featureCount: number;
  ingestedAt: string;
  /** Number of attempts in a row this dataset has failed. */
  failureStreak?: number;
  /** Reason from the last failure (short string, not a full stack trace). */
  lastError?: string;
}

export interface Manifest {
  schema: 1;
  phase: 1 | 2;
  lastFullRebuildAt: string | null;
  lastPmtilesObject: string | null;
  datasets: Record<string, ManifestDataset>;
}

export interface DatasetUpdatePlan {
  dataset: ResolvedDataset;
  reason: 'new' | 'modified' | 'retry' | 'forced';
  previousZipSha256: string | null;
}

export interface DatasetResult {
  datasetId: string;
  ok: boolean;
  zipSha256?: string;
  featureCount?: number;
  error?: string;
  geojsonGcsKey?: string;
}
