import { CodeAssignment, ValidationError } from '@/types/manual-import';

/**
 * Validates the format of a reference code (e.g., "DTG 1.1" or "FALTA")
 */
export function validateCodeFormat(code: string): boolean {
  if (code === 'FALTA') return true;
  
  // Pattern: LETTERS SPACE NUMBER DOT NUMBER
  // Examples: DTG 1.1, CS 12.5, etc.
  const pattern = /^[A-Z]{2,5}\s\d+\.\d+$/;
  return pattern.test(code);
}

/**
 * Parses a reference code into its components
 */
export function parseRefCode(code: string): { bookCode: string; chapter: number; paragraph: number } | null {
  if (code === 'FALTA') return null;
  
  const match = code.match(/^([A-Z]{2,5})\s(\d+)\.(\d+)$/);
  if (!match) return null;
  
  return {
    bookCode: match[1],
    chapter: parseInt(match[2], 10),
    paragraph: parseInt(match[3], 10)
  };
}

/**
 * Validates all code assignments and returns errors
 */
export function validateCodeAssignments(
  assignments: CodeAssignment[],
  bookCode: string,
  existingCodes: Set<string>
): ValidationError[] {
  const errors: ValidationError[] = [];
  const seenCodes = new Map<string, number>(); // code -> first index
  let lastParsed: { chapter: number; paragraph: number } | null = null;

  assignments.forEach((assignment, index) => {
    const { assignedCode, status } = assignment;

    // Skip validation for pending assignments
    if (status === 'pending') {
      errors.push({
        type: 'missing_required',
        message: `El párrafo ${index + 1} necesita un código asignado`,
        affectedIndex: index
      });
      return;
    }

    // Skip further validation for FALTA
    if (assignedCode === 'FALTA') {
      lastParsed = null;
      return;
    }

    // Validate format
    if (!validateCodeFormat(assignedCode)) {
      errors.push({
        type: 'format',
        message: `Código inválido en párrafo ${index + 1}: "${assignedCode}"`,
        affectedIndex: index,
        affectedCode: assignedCode
      });
      return;
    }

    const parsed = parseRefCode(assignedCode);
    if (!parsed) return;

    // Validate book code matches
    if (parsed.bookCode !== bookCode) {
      errors.push({
        type: 'format',
        message: `El código "${assignedCode}" no pertenece al libro ${bookCode}`,
        affectedIndex: index,
        affectedCode: assignedCode
      });
      return;
    }

    // Validate code exists in database
    if (!existingCodes.has(assignedCode)) {
      errors.push({
        type: 'non_existent',
        message: `El código "${assignedCode}" no existe en la base de datos`,
        affectedIndex: index,
        affectedCode: assignedCode
      });
      return;
    }

    // Check for duplicates
    if (seenCodes.has(assignedCode)) {
      errors.push({
        type: 'duplicate',
        message: `El código "${assignedCode}" está duplicado (párrafos ${seenCodes.get(assignedCode)! + 1} y ${index + 1})`,
        affectedIndex: index,
        affectedCode: assignedCode
      });
      return;
    }
    seenCodes.set(assignedCode, index);

    // Validate sequence (only for same chapter)
    if (lastParsed && parsed.chapter === lastParsed.chapter) {
      if (parsed.paragraph !== lastParsed.paragraph + 1) {
        errors.push({
          type: 'sequence',
          message: `Secuencia incorrecta: después de "${assignments[index - 1].assignedCode}" esperaba capítulo ${lastParsed.chapter} párrafo ${lastParsed.paragraph + 1}, pero encontré "${assignedCode}"`,
          affectedIndex: index,
          affectedCode: assignedCode
        });
      }
    }

    lastParsed = { chapter: parsed.chapter, paragraph: parsed.paragraph };
  });

  return errors;
}

/**
 * Extracts paragraphs from text file content
 */
export function extractParagraphsFromText(content: string): string[] {
  // Split by double newline or more, then filter empty
  const paragraphs = content
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
  
  return paragraphs;
}
