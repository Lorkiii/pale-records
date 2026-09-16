// Extracts PALE printable Attendance scans locally by validating identity and reading known cells.
import { cloneAttendanceRecords, getAttendanceSessionRoster } from './attendance-draft';
import {
  alignAttendanceTemplatePage,
  createLandscapeAttendanceCanvas,
  extractAttendanceRemarksRegion,
  extractAttendanceStatusRegion,
  readAttendanceTemplatePageIdentity,
  rotateAttendanceCanvas180,
} from './attendance-ocr-image';
import {
  getAttendanceTemplatePageCount,
  getAttendanceTemplatePageRowRange,
} from './attendance-template-layout';
import { getAttendanceTemplateReference } from './attendance-template';
import {
  ATTENDANCE_REMARKS_MAX_LENGTH,
  isAttendanceStatusCode,
  type AttendanceSessionDraft,
  type AttendanceStatusCode,
  type WorkingAttendanceRecordsByStudentId,
} from './attendance-types';

export const ATTENDANCE_SCAN_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
export const ATTENDANCE_SCAN_MAX_TOTAL_SIZE_BYTES = 40 * 1024 * 1024;
export const ATTENDANCE_SCAN_MAX_PAGE_COUNT = 20;

const STATUS_CONFIDENCE_THRESHOLD = 75;
const REMARKS_CONFIDENCE_THRESHOLD = 55;

type TesseractModule = typeof import('tesseract.js');
type TesseractWorker = Awaited<ReturnType<TesseractModule['createWorker']>>;

interface AttendanceSourcePage {
  canvas: HTMLCanvasElement;
  embeddedText: string;
  sourceLabel: string;
}

export interface AttendanceOcrProgress {
  message: string;
  percent: number;
}

export interface AttendanceOcrRow {
  studentId: string;
  studentName: string;
  pageNumber: number;
  rosterRowNumber: number;
  status: AttendanceStatusCode | null;
  rawStatusText: string;
  statusConfidence: number;
  remarks: string;
  remarksConfidence: number;
  needsReview: boolean;
  issues: string[];
}

export interface AttendanceOcrPreview {
  records: WorkingAttendanceRecordsByStudentId;
  rows: AttendanceOcrRow[];
  pageCount: number;
  needsReviewCount: number;
}

export class AttendanceOcrValidationError extends Error {
  messages: string[];

  constructor(messages: string[]) {
    super(messages[0] ?? 'The attendance scan is invalid.');
    this.name = 'AttendanceOcrValidationError';
    this.messages = messages;
  }
}

function getExtension(file: File) {
  const match = /\.([^.]+)$/.exec(file.name.toLowerCase());
  return match?.[1] ?? '';
}

export function isAttendanceCsvSelection(files: readonly File[]) {
  return files.length === 1 && getExtension(files[0]) === 'csv';
}

export function isAttendancePdfSelection(files: readonly File[]) {
  return files.length === 1 && getExtension(files[0]) === 'pdf';
}

export function isAttendanceImageSelection(files: readonly File[]) {
  return files.length > 0 && files.every((file) =>
    ['png', 'jpg', 'jpeg'].includes(getExtension(file)));
}

// Rejects mixed, oversized, or incomplete selections before loading OCR dependencies.
export function validateAttendanceScanSelection(
  files: readonly File[],
  expectedPageCount: number,
) {
  const messages: string[] = [];
  const isPdf = isAttendancePdfSelection(files);
  const isImageSet = isAttendanceImageSelection(files);

  if (!isPdf && !isImageSet) {
    messages.push('Choose one PALE PDF or a complete set of PNG/JPEG page images.');
  }
  if (files.some((file) => file.size > ATTENDANCE_SCAN_MAX_FILE_SIZE_BYTES)) {
    messages.push('Each PDF or image must be 20 MB or smaller.');
  }
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > ATTENDANCE_SCAN_MAX_TOTAL_SIZE_BYTES) {
    messages.push('The selected scan files must total 40 MB or less.');
  }
  if (expectedPageCount > ATTENDANCE_SCAN_MAX_PAGE_COUNT) {
    messages.push(
      `This roster requires more than the supported ${ATTENDANCE_SCAN_MAX_PAGE_COUNT} scan pages.`,
    );
  }
  if (isImageSet && files.length !== expectedPageCount) {
    messages.push(
      `Select all ${expectedPageCount} image ${expectedPageCount === 1 ? 'page' : 'pages'} for this roster.`,
    );
  }

  if (messages.length > 0) {
    throw new AttendanceOcrValidationError(messages);
  }
}

function parseEmbeddedPageIdentity(text: string) {
  const normalized = text
    .toUpperCase()
    .replace(/[–—_]/g, '-')
    .replace(/\s+/g, '');
  const referenceMatch = /PALT-([0-9])-([A-F0-9]{16})/.exec(normalized);
  const pageMatch = /PAGE([0-9]+)\/([0-9]+)/.exec(normalized);
  if (!referenceMatch || !pageMatch) {
    return null;
  }

  return {
    reference: `PALT-${referenceMatch[1]}-${referenceMatch[2]}`,
    pageNumber: Number(pageMatch[1]),
    pageCount: Number(pageMatch[2]),
  };
}

function normalizeStatusText(text: string) {
  return text.toUpperCase().replace(/[^PALE]/g, '');
}

function normalizeRemarksText(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

async function createImagePage(file: File): Promise<AttendanceSourcePage> {
  try {
    const image = await createImageBitmap(file);
    try {
      return {
        canvas: createLandscapeAttendanceCanvas(image, image.width, image.height),
        embeddedText: '',
        sourceLabel: file.name,
      };
    } finally {
      image.close();
    }
  } catch {
    throw new AttendanceOcrValidationError([
      `${file.name} is not a readable PNG or JPEG image.`,
    ]);
  }
}

async function extractPageRows(
  sourcePage: AttendanceSourcePage,
  expectedReference: string,
  expectedPageCount: number,
  roster: ReturnType<typeof getAttendanceSessionRoster>,
  worker: TesseractWorker,
  tesseract: TesseractModule,
  completedRows: number,
  onProgress?: (progress: AttendanceOcrProgress) => void,
) {
  onProgress?.({
    message: `Aligning ${sourcePage.sourceLabel}`,
    percent: Math.min(90, 15 + ((completedRows / roster.length) * 70)),
  });

  let alignment;
  try {
    alignment = alignAttendanceTemplatePage(sourcePage.canvas);
  } catch (error) {
    throw new AttendanceOcrValidationError([
      `${sourcePage.sourceLabel}: ${error instanceof Error ? error.message : 'The page could not be aligned.'}`,
    ]);
  }

  let identity = parseEmbeddedPageIdentity(sourcePage.embeddedText) ??
    readAttendanceTemplatePageIdentity(alignment);
  if (!identity) {
    onProgress?.({
      message: `Checking the PALE page identity in ${sourcePage.sourceLabel}`,
      percent: Math.min(90, 18 + ((completedRows / roster.length) * 70)),
    });
    const rotatedCanvas = rotateAttendanceCanvas180(sourcePage.canvas);
    try {
      const rotatedAlignment = alignAttendanceTemplatePage(rotatedCanvas);
      const rotatedIdentity = readAttendanceTemplatePageIdentity(rotatedAlignment);
      if (rotatedIdentity) {
        alignment = rotatedAlignment;
        identity = rotatedIdentity;
      }
    } catch {
      // The first aligned orientation provides the actionable validation error below.
    }
  }

  if (!identity) {
    throw new AttendanceOcrValidationError([
      `${sourcePage.sourceLabel}: PALE could not read the page identity strip. Use a clear, uncropped scan of a PALE-generated template.`,
    ]);
  }
  if (identity.reference !== expectedReference) {
    throw new AttendanceOcrValidationError([
      `${sourcePage.sourceLabel}: this template belongs to a different class, date, or roster.`,
    ]);
  }
  if (
    identity.pageCount !== expectedPageCount ||
    identity.pageNumber < 1 ||
    identity.pageNumber > expectedPageCount
  ) {
    throw new AttendanceOcrValidationError([
      `${sourcePage.sourceLabel}: the page number does not match this ${expectedPageCount}-page template.`,
    ]);
  }

  const rowRange = getAttendanceTemplatePageRowRange(identity.pageNumber, roster.length);
  const pageRoster = roster.slice(
    rowRange.firstRowNumber - 1,
    rowRange.lastRowNumber,
  );
  const preparedRows = pageRoster.map((student, index) => ({
    student,
    rosterRowNumber: rowRange.firstRowNumber + index,
    statusRegion: extractAttendanceStatusRegion(alignment, index),
    remarksRegion: extractAttendanceRemarksRegion(alignment, index),
  }));

  await worker.setParameters({
    tessedit_pageseg_mode: tesseract.PSM.SINGLE_WORD,
    tessedit_char_whitelist: 'PALE',
  });
  const statusResults: Array<{
    status: AttendanceStatusCode | null;
    rawStatusText: string;
    statusConfidence: number;
    statusIssue: string | null;
  }> = [];

  for (let index = 0; index < preparedRows.length; index += 1) {
    const prepared = preparedRows[index];
    const absoluteProgress = completedRows + index;
    onProgress?.({
      message: `Reading status row ${prepared.rosterRowNumber} of ${roster.length}`,
      percent: Math.min(90, 20 + ((absoluteProgress / roster.length) * 45)),
    });

    if (prepared.statusRegion.isBlank) {
      statusResults.push({
        status: null,
        rawStatusText: '',
        statusConfidence: 100,
        statusIssue: null,
      });
      continue;
    }

    const recognition = await worker.recognize(prepared.statusRegion.canvas);
    const rawStatusText = normalizeStatusText(recognition.data.text);
    const status = rawStatusText.length === 1 && isAttendanceStatusCode(rawStatusText)
      ? rawStatusText
      : null;
    const statusConfidence = Math.round(recognition.data.confidence);
    statusResults.push({
      status,
      rawStatusText,
      statusConfidence,
      statusIssue: status && statusConfidence >= STATUS_CONFIDENCE_THRESHOLD
        ? null
        : 'Status could not be read confidently.',
    });
  }

  await worker.setParameters({
    tessedit_pageseg_mode: tesseract.PSM.SINGLE_LINE,
    tessedit_char_whitelist: '',
    preserve_interword_spaces: '1',
  });
  const rows: AttendanceOcrRow[] = [];

  for (let index = 0; index < preparedRows.length; index += 1) {
    const prepared = preparedRows[index];
    const statusResult = statusResults[index];
    const absoluteProgress = completedRows + index;
    onProgress?.({
      message: `Reading remarks row ${prepared.rosterRowNumber} of ${roster.length}`,
      percent: Math.min(94, 65 + ((absoluteProgress / roster.length) * 27)),
    });

    let remarks = '';
    let remarksConfidence = 100;
    const issues = statusResult.statusIssue ? [statusResult.statusIssue] : [];
    if (!prepared.remarksRegion.isBlank) {
      const recognition = await worker.recognize(prepared.remarksRegion.canvas);
      remarks = normalizeRemarksText(recognition.data.text);
      remarksConfidence = Math.round(recognition.data.confidence);
      if (!remarks || remarksConfidence < REMARKS_CONFIDENCE_THRESHOLD) {
        issues.push('Remarks could not be read confidently.');
      }
      if (remarks.length > ATTENDANCE_REMARKS_MAX_LENGTH) {
        issues.push(`Remarks exceed ${ATTENDANCE_REMARKS_MAX_LENGTH} characters.`);
      }
    }
    if (statusResult.status === 'E' && !remarks) {
      issues.push('Excused requires remarks.');
    } else if (statusResult.status !== 'E' && remarks) {
      issues.push('Remarks were found but the status is not Excused.');
    }

    rows.push({
      studentId: prepared.student.id,
      studentName: `${prepared.student.lastName}, ${prepared.student.firstName}`,
      pageNumber: identity.pageNumber,
      rosterRowNumber: prepared.rosterRowNumber,
      status: statusResult.status,
      rawStatusText: statusResult.rawStatusText,
      statusConfidence: statusResult.statusConfidence,
      remarks,
      remarksConfidence,
      needsReview: issues.length > 0,
      issues,
    });
  }

  return { identity, rows };
}

async function extractImagePages(
  files: readonly File[],
  processPage: (page: AttendanceSourcePage) => Promise<void>,
) {
  for (const file of files) {
    await processPage(await createImagePage(file));
  }
}

async function extractPdfPages(
  file: File,
  expectedPageCount: number,
  processPage: (page: AttendanceSourcePage) => Promise<void>,
) {
  const [{ getDocument, GlobalWorkerOptions }, workerModule] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  GlobalWorkerOptions.workerSrc = workerModule.default;
  const loadingTask = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });

  try {
    const pdf = await loadingTask.promise;
    if (pdf.numPages !== expectedPageCount) {
      throw new AttendanceOcrValidationError([
        `The PDF has ${pdf.numPages} ${pdf.numPages === 1 ? 'page' : 'pages'}; this roster requires ${expectedPageCount}.`,
      ]);
    }
    if (pdf.numPages > ATTENDANCE_SCAN_MAX_PAGE_COUNT) {
      throw new AttendanceOcrValidationError([
        `PDFs are limited to ${ATTENDANCE_SCAN_MAX_PAGE_COUNT} pages.`,
      ]);
    }

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(3, 3_000 / Math.max(baseViewport.width, baseViewport.height));
      const viewport = page.getViewport({ scale });
      const rawCanvas = document.createElement('canvas');
      rawCanvas.width = Math.max(1, Math.round(viewport.width));
      rawCanvas.height = Math.max(1, Math.round(viewport.height));
      const context = rawCanvas.getContext('2d');
      if (!context) {
        throw new AttendanceOcrValidationError([
          'This browser cannot render the selected attendance PDF.',
        ]);
      }
      await page.render({
        canvas: rawCanvas,
        canvasContext: context,
        viewport,
        background: '#ffffff',
      }).promise;
      const textContent = await page.getTextContent();
      const embeddedText = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');
      await processPage({
        canvas: createLandscapeAttendanceCanvas(
          rawCanvas,
          rawCanvas.width,
          rawCanvas.height,
        ),
        embeddedText,
        sourceLabel: `PDF page ${pageNumber}`,
      });
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }
}

// Runs one bounded OCR worker and returns a complete read-only extraction for Step 4 review.
export async function extractAttendanceTemplateScan(
  files: readonly File[],
  session: AttendanceSessionDraft,
  onProgress?: (progress: AttendanceOcrProgress) => void,
): Promise<AttendanceOcrPreview> {
  const roster = getAttendanceSessionRoster(session);
  const expectedPageCount = getAttendanceTemplatePageCount(roster.length);
  validateAttendanceScanSelection(files, expectedPageCount);
  const expectedReference = getAttendanceTemplateReference(session);
  const rowsByPage = new Map<number, AttendanceOcrRow[]>();
  let completedRows = 0;
  let latestWorkerProgress = 0;

  onProgress?.({ message: 'Loading the local OCR reader', percent: 2 });
  const tesseract = await import('tesseract.js');
  const worker = await tesseract.createWorker('eng', undefined, {
    logger: (message) => {
      if (message.status === 'recognizing text') {
        return;
      }
      latestWorkerProgress = Math.max(latestWorkerProgress, message.progress);
      onProgress?.({
        message: 'Loading the local OCR reader',
        percent: Math.min(14, 2 + (latestWorkerProgress * 12)),
      });
    },
  });

  const processPage = async (sourcePage: AttendanceSourcePage) => {
    const result = await extractPageRows(
      sourcePage,
      expectedReference,
      expectedPageCount,
      roster,
      worker,
      tesseract,
      completedRows,
      onProgress,
    );
    if (rowsByPage.has(result.identity.pageNumber)) {
      throw new AttendanceOcrValidationError([
        `Page ${result.identity.pageNumber} was selected more than once.`,
      ]);
    }
    rowsByPage.set(result.identity.pageNumber, result.rows);
    completedRows += result.rows.length;
  };

  try {
    if (isAttendancePdfSelection(files)) {
      await extractPdfPages(files[0], expectedPageCount, processPage);
    } else {
      await extractImagePages(files, processPage);
    }
  } catch (error) {
    if (error instanceof AttendanceOcrValidationError) {
      throw error;
    }
    throw new AttendanceOcrValidationError([
      error instanceof Error
        ? `PALE could not finish OCR: ${error.message}`
        : 'PALE could not finish OCR for this template.',
    ]);
  } finally {
    await worker.terminate();
  }

  const missingPages = Array.from(
    { length: expectedPageCount },
    (_, index) => index + 1,
  ).filter((pageNumber) => !rowsByPage.has(pageNumber));
  if (missingPages.length > 0) {
    throw new AttendanceOcrValidationError([
      `The scan is missing ${missingPages.map((page) => `page ${page}`).join(', ')}.`,
    ]);
  }

  const rows = Array.from(rowsByPage.entries())
    .toSorted(([firstPage], [secondPage]) => firstPage - secondPage)
    .flatMap(([, pageRows]) => pageRows)
    .toSorted((first, second) => first.rosterRowNumber - second.rosterRowNumber);
  if (rows.length !== roster.length) {
    throw new AttendanceOcrValidationError([
      'The extracted row count does not match the selected attendance roster.',
    ]);
  }

  const records = cloneAttendanceRecords(session.records);
  for (const row of rows) {
    records[row.studentId] = {
      ...records[row.studentId],
      status: row.status,
      remarks: row.remarks,
    };
  }

  onProgress?.({ message: 'OCR extraction is ready for review', percent: 100 });
  return {
    records,
    rows,
    pageCount: expectedPageCount,
    needsReviewCount: rows.filter((row) => row.needsReview).length,
  };
}
