import raw from './research.json';

export interface Missingness {
  field: string;
  pctAll: number;
  pctFraud: number;
  pctGenuine: number;
}
export interface Flag {
  flag: string;
  pctFraud: number;
  pctGenuine: number;
}
export interface ModelRow {
  name: string;
  family: 'baseline' | 'text' | 'metadata' | 'combined';
  note: string;
  accuracy: number | null;
  balanced_accuracy: number | null;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  pr_auc: number | null;
  roc_auc: number | null;
  pr_auc_std: number | null;
  f1_std: number | null;
}
export interface OofThreshold {
  model: string;
  threshold: number;
  precision: number;
  recall: number;
  f1: number;
}
export interface Feature {
  feature: string;
  coef: number;
}
export interface CountryRow {
  code: string;
  postings: number;
  fraud: number;
  fraudRate: number;
  recall: number | null;
  precision: number | null;
}
export interface SubgroupRow {
  status: string;
  postings: number;
  fraud: number;
  fraudRate: number;
  recall: number | null;
  precision: number | null;
}
export interface ErrorExample {
  title: string;
  location: string;
  score: number;
  profile: string;
}

export interface Research {
  dataset: {
    name: string;
    source: string;
    years: string;
    total: number;
    fraud: number;
    genuine: number;
    fraudRate: number;
    textFields: string[];
    missingness: Missingness[];
    flags: Flag[];
  };
  duplicates: {
    totalRows: number;
    uniqueGroups: number;
    singletonGroups: number;
    multiRowGroups: number;
    rowsInMultiGroups: number;
    largestGroupSize: number;
    sizeHistogram: { size: number; groups: number }[];
  };
  split: {
    random_state: number;
    split_method: string;
    n_splits: number;
    selected_fold: number;
    train_size: number;
    test_size: number;
    unique_text_groups: number;
    group_overlap: number;
    target: string;
    trainFraud: number;
    trainTotal: number;
    testFraud: number;
    testTotal: number;
  };
  modelComparison: { cvNote: string; models: ModelRow[] };
  oofThresholds: OofThreshold[];
  finalTest: {
    metrics: Record<string, number>;
    bootstrap: Record<string, { est: number; lo: number; hi: number }>;
  };
  confusion: { tp: number; fp: number; tn: number; fn: number; threshold: number };
  features: { fraud: Feature[]; legit: Feature[] };
  country: CountryRow[];
  companyProfile: SubgroupRow[];
  errors: {
    counts: Record<string, number>;
    falsePositives: ErrorExample[];
    falseNegatives: ErrorExample[];
  };
  model: { name: string; threshold: number; vocab: number };
}

export const research = raw as unknown as Research;
