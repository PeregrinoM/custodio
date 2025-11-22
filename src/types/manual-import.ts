// Manual Import Types for Historical Versions

export interface ManualImportState {
  currentPhase: 1 | 2 | 3 | 4 | 5;
  bookCode: string;
  bookTitle: string;
  versionType: 'regular' | 'physical_baseline';
  editionDate: string | null;
  versionNotes: string;
  
  // Phase 1: File upload
  uploadedFile: File | null;
  rawParagraphs: string[];
  
  // Phase 2: Structural comparison
  structuralComparison: StructuralComparison | null;
  
  // Phase 3: Code assignment
  codeAssignments: CodeAssignment[];
  
  // Phase 4: Review
  validationErrors: ValidationError[];
  
  // Phase 5: Import result
  importResult: ImportResult | null;
}

export interface StructuralComparison {
  uploadedCount: number;
  dbCount: number;
  match: 'exact' | 'extra' | 'missing';
  extraCount?: number;
  missingCount?: number;
}

export interface CodeAssignment {
  index: number; // 0-based index in uploaded file
  text: string;
  assignedCode: string; // e.g., "DTG 1.1" or "FALTA"
  status: 'auto' | 'manual' | 'missing' | 'pending';
  confidence?: number; // 0-1 for auto assignments
  suggestedCodes?: Array<{
    code: string;
    similarity: number;
    dbText: string;
  }>;
}

export interface ValidationError {
  type: 'format' | 'sequence' | 'duplicate' | 'non_existent' | 'missing_required';
  message: string;
  affectedIndex?: number;
  affectedCode?: string;
}

export interface ImportResult {
  success: boolean;
  versionId?: string;
  versionNumber?: number;
  error?: string;
  snapshotsCreated?: number;
}

export interface ExistingParagraph {
  id: string;
  refcode_short: string;
  base_text: string;
  chapter_number: number;
  chapter_title: string;
}
