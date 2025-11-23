// Manual Import Types for Historical Versions

export interface ChapterStructure {
  chapterNumber: number;
  chapterTitle: string;
  startIndex: number;
  endIndex: number;
  paragraphCount: number;
  dbChapterId: string | null;
  dbParagraphCount: number;
}

export interface ManualImportState {
  currentPhase: 1 | 1.5 | 2 | 3 | 4 | 5;
  bookCode: string;
  bookTitle: string;
  versionType: 'regular' | 'physical_baseline';
  editionDate: string | null;
  versionNotes: string;
  
  // Phase 1: File upload
  uploadedFile: File | null;
  rawParagraphs: string[];
  
  // Phase 1.5: Chapter detection
  chapterStructure: ChapterStructure[];
  
  // Phase 2: Structural comparison
  structuralComparison: StructuralComparison | null;
  
  // Phase 3: Code assignment
  codeAssignments: CodeAssignment[];
  currentChapter: number;
  completedChapters: number[];
  
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
  status: 'auto' | 'manual' | 'missing' | 'pending' | 'discarded';
  chapterNumber: number; // Which chapter this paragraph belongs to
  confidence?: number; // 0-1 for auto assignments
  discarded?: boolean; // Mark as not a real paragraph (header, metadata, etc.)
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
