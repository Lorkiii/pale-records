// Aligns photographed or scanned PALE template pages and crops their known OCR cells.
import {
  ATTENDANCE_TEMPLATE_HEADER_HEIGHT_MM,
  ATTENDANCE_TEMPLATE_PAGE_MARGIN_MM,
  ATTENDANCE_TEMPLATE_REGISTRATION_MARK_CENTERS_MM,
  ATTENDANCE_TEMPLATE_REMARKS_COLUMN_WIDTH_MM,
  ATTENDANCE_TEMPLATE_ROW_HEIGHT_MM,
  ATTENDANCE_TEMPLATE_STATUS_COLUMN_WIDTH_MM,
  ATTENDANCE_TEMPLATE_STUDENT_COLUMN_WIDTH_MM,
  ATTENDANCE_TEMPLATE_TABLE_TOP_MM,
} from './attendance-template-layout';
import {
  ATTENDANCE_TEMPLATE_IDENTITY_MODULE_COUNT,
  ATTENDANCE_TEMPLATE_IDENTITY_MODULE_WIDTH_MM,
  ATTENDANCE_TEMPLATE_IDENTITY_STRIP_HEIGHT_MM,
  ATTENDANCE_TEMPLATE_IDENTITY_STRIP_X_MM,
  ATTENDANCE_TEMPLATE_IDENTITY_STRIP_Y_MM,
  decodeAttendanceTemplatePageIdentity,
} from './attendance-template-identity';

const MAX_PAGE_EDGE_PX = 3_000;
const CELL_PIXELS_PER_MM = 8;
const MARK_THRESHOLD = 128;

interface Point {
  x: number;
  y: number;
}

interface RegionMm {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AttendancePageAlignment {
  sourceImageData: ImageData;
  transform: readonly number[];
}

export interface PreparedAttendanceOcrRegion {
  canvas: HTMLCanvasElement;
  inkRatio: number;
  isBlank: boolean;
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function getCanvasContext(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('This browser cannot prepare the attendance image for OCR.');
  }
  return context;
}

// Bounds memory use and rotates portrait captures into the template's landscape orientation.
export function createLandscapeAttendanceCanvas(
  image: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
) {
  const longestEdge = Math.max(sourceWidth, sourceHeight);
  const scale = Math.min(1, MAX_PAGE_EDGE_PX / longestEdge);
  const scaledWidth = Math.max(1, Math.round(sourceWidth * scale));
  const scaledHeight = Math.max(1, Math.round(sourceHeight * scale));
  const isPortrait = scaledHeight > scaledWidth;
  const canvas = createCanvas(
    isPortrait ? scaledHeight : scaledWidth,
    isPortrait ? scaledWidth : scaledHeight,
  );
  const context = getCanvasContext(canvas);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  if (isPortrait) {
    context.translate(canvas.width, 0);
    context.rotate(Math.PI / 2);
  }

  context.drawImage(image, 0, 0, scaledWidth, scaledHeight);
  return canvas;
}

// Provides one orientation retry for scans captured upside down.
export function rotateAttendanceCanvas180(sourceCanvas: HTMLCanvasElement) {
  const canvas = createCanvas(sourceCanvas.width, sourceCanvas.height);
  const context = getCanvasContext(canvas);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.translate(canvas.width, canvas.height);
  context.rotate(Math.PI);
  context.drawImage(sourceCanvas, 0, 0);
  return canvas;
}

function isDarkPixel(data: Uint8ClampedArray, pixelIndex: number) {
  const offset = pixelIndex * 4;
  const luminance = (data[offset] * 0.2126) +
    (data[offset + 1] * 0.7152) +
    (data[offset + 2] * 0.0722);
  return data[offset + 3] > 96 && luminance < MARK_THRESHOLD;
}

function getCornerRegion(
  cornerIndex: number,
  width: number,
  height: number,
) {
  const isRight = cornerIndex % 2 === 1;
  const isBottom = cornerIndex >= 2;
  return {
    left: Math.floor(width * (isRight ? 0.7 : 0)),
    right: Math.ceil(width * (isRight ? 1 : 0.3)),
    top: Math.floor(height * (isBottom ? 0.75 : 0)),
    bottom: Math.ceil(height * (isBottom ? 1 : 0.25)),
    corner: {
      x: isRight ? width : 0,
      y: isBottom ? height : 0,
    },
  };
}

// Finds the best square connected component in one page corner.
function findRegistrationMark(
  imageData: ImageData,
  cornerIndex: number,
) {
  const { width, height, data } = imageData;
  const region = getCornerRegion(cornerIndex, width, height);
  const regionWidth = region.right - region.left;
  const regionHeight = region.bottom - region.top;
  const visited = new Uint8Array(regionWidth * regionHeight);
  const minimumSide = Math.max(2, Math.floor(Math.min(width, height) * 0.003));
  const maximumSide = Math.ceil(Math.min(width, height) * 0.03);
  let best: { point: Point; score: number } | null = null;

  for (let localY = 0; localY < regionHeight; localY += 1) {
    for (let localX = 0; localX < regionWidth; localX += 1) {
      const localIndex = (localY * regionWidth) + localX;
      if (visited[localIndex]) {
        continue;
      }
      visited[localIndex] = 1;
      const startX = region.left + localX;
      const startY = region.top + localY;
      if (!isDarkPixel(data, (startY * width) + startX)) {
        continue;
      }

      const queueX = [localX];
      const queueY = [localY];
      let queueIndex = 0;
      let area = 0;
      let minX = localX;
      let maxX = localX;
      let minY = localY;
      let maxY = localY;

      while (queueIndex < queueX.length) {
        const currentX = queueX[queueIndex];
        const currentY = queueY[queueIndex];
        queueIndex += 1;
        area += 1;
        minX = Math.min(minX, currentX);
        maxX = Math.max(maxX, currentX);
        minY = Math.min(minY, currentY);
        maxY = Math.max(maxY, currentY);

        const neighbors = [
          [currentX - 1, currentY],
          [currentX + 1, currentY],
          [currentX, currentY - 1],
          [currentX, currentY + 1],
        ];
        for (const [nextX, nextY] of neighbors) {
          if (
            nextX < 0 ||
            nextY < 0 ||
            nextX >= regionWidth ||
            nextY >= regionHeight
          ) {
            continue;
          }
          const nextLocalIndex = (nextY * regionWidth) + nextX;
          if (visited[nextLocalIndex]) {
            continue;
          }
          visited[nextLocalIndex] = 1;
          const absoluteX = region.left + nextX;
          const absoluteY = region.top + nextY;
          if (isDarkPixel(data, (absoluteY * width) + absoluteX)) {
            queueX.push(nextX);
            queueY.push(nextY);
          }
        }
      }

      const componentWidth = maxX - minX + 1;
      const componentHeight = maxY - minY + 1;
      if (
        componentWidth < minimumSide ||
        componentHeight < minimumSide ||
        componentWidth > maximumSide ||
        componentHeight > maximumSide
      ) {
        continue;
      }

      const aspectRatio = componentWidth / componentHeight;
      const fillRatio = area / (componentWidth * componentHeight);
      if (aspectRatio < 0.6 || aspectRatio > 1.67 || fillRatio < 0.5) {
        continue;
      }

      const point = {
        x: region.left + ((minX + maxX) / 2),
        y: region.top + ((minY + maxY) / 2),
      };
      const cornerDistance = Math.hypot(
        (point.x - region.corner.x) / width,
        (point.y - region.corner.y) / height,
      );
      const score = cornerDistance +
        (Math.abs(1 - aspectRatio) * 0.3) +
        ((1 - fillRatio) * 0.5);
      if (!best || score < best.score) {
        best = { point, score };
      }
    }
  }

  return best?.point ?? null;
}

function solveLinearSystem(matrix: number[][], values: number[]) {
  const size = values.length;
  const augmented = matrix.map((row, index) => [...row, values[index]]);

  for (let column = 0; column < size; column += 1) {
    let pivotRow = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivotRow][column])) {
        pivotRow = row;
      }
    }
    [augmented[column], augmented[pivotRow]] = [augmented[pivotRow], augmented[column]];
    const pivot = augmented[column][column];
    if (Math.abs(pivot) < 1e-8) {
      throw new Error('The attendance page registration marks do not form a usable page.');
    }

    for (let entry = column; entry <= size; entry += 1) {
      augmented[column][entry] /= pivot;
    }
    for (let row = 0; row < size; row += 1) {
      if (row === column) {
        continue;
      }
      const factor = augmented[row][column];
      for (let entry = column; entry <= size; entry += 1) {
        augmented[row][entry] -= factor * augmented[column][entry];
      }
    }
  }

  return augmented.map((row) => row[size]);
}

function createPageTransform(sourcePoints: readonly Point[]) {
  const matrix: number[][] = [];
  const values: number[] = [];

  ATTENDANCE_TEMPLATE_REGISTRATION_MARK_CENTERS_MM.forEach((target, index) => {
    const source = sourcePoints[index];
    matrix.push([
      target.x,
      target.y,
      1,
      0,
      0,
      0,
      -source.x * target.x,
      -source.x * target.y,
    ]);
    values.push(source.x);
    matrix.push([
      0,
      0,
      0,
      target.x,
      target.y,
      1,
      -source.y * target.x,
      -source.y * target.y,
    ]);
    values.push(source.y);
  });

  return solveLinearSystem(matrix, values);
}

// Requires all four printed anchors before any roster cell can be trusted.
export function alignAttendanceTemplatePage(sourceCanvas: HTMLCanvasElement) {
  const context = getCanvasContext(sourceCanvas);
  const imageData = context.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const marks = ATTENDANCE_TEMPLATE_REGISTRATION_MARK_CENTERS_MM.map((_, index) =>
    findRegistrationMark(imageData, index));

  if (marks.some((mark) => mark === null)) {
    throw new Error(
      'All four PALE registration squares must be visible. Retake the photo without cropping the page.',
    );
  }

  const sourcePoints = marks as Point[];
  const topWidth = Math.hypot(
    sourcePoints[1].x - sourcePoints[0].x,
    sourcePoints[1].y - sourcePoints[0].y,
  );
  const bottomWidth = Math.hypot(
    sourcePoints[3].x - sourcePoints[2].x,
    sourcePoints[3].y - sourcePoints[2].y,
  );
  const leftHeight = Math.hypot(
    sourcePoints[2].x - sourcePoints[0].x,
    sourcePoints[2].y - sourcePoints[0].y,
  );
  const rightHeight = Math.hypot(
    sourcePoints[3].x - sourcePoints[1].x,
    sourcePoints[3].y - sourcePoints[1].y,
  );
  if (
    Math.min(topWidth, bottomWidth) < sourceCanvas.width * 0.45 ||
    Math.min(leftHeight, rightHeight) < sourceCanvas.height * 0.45
  ) {
    throw new Error(
      'The PALE template is too small or incomplete in this image. Fill the frame with the full page.',
    );
  }

  return {
    sourceImageData: imageData,
    transform: createPageTransform(sourcePoints),
  } satisfies AttendancePageAlignment;
}

function mapPagePoint(transform: readonly number[], x: number, y: number) {
  const denominator = (transform[6] * x) + (transform[7] * y) + 1;
  return {
    x: ((transform[0] * x) + (transform[1] * y) + transform[2]) / denominator,
    y: ((transform[3] * x) + (transform[4] * y) + transform[5]) / denominator,
  };
}

function sampleChannel(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  channel: number,
) {
  if (x < 0 || y < 0 || x >= width - 1 || y >= height - 1) {
    return 255;
  }
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const xWeight = x - x0;
  const yWeight = y - y0;
  const topLeft = data[(((y0 * width) + x0) * 4) + channel];
  const topRight = data[(((y0 * width) + x0 + 1) * 4) + channel];
  const bottomLeft = data[((((y0 + 1) * width) + x0) * 4) + channel];
  const bottomRight = data[((((y0 + 1) * width) + x0 + 1) * 4) + channel];
  return ((topLeft * (1 - xWeight)) + (topRight * xWeight)) * (1 - yWeight) +
    ((bottomLeft * (1 - xWeight)) + (bottomRight * xWeight)) * yWeight;
}

function samplePageLuminance(
  alignment: AttendancePageAlignment,
  pageX: number,
  pageY: number,
) {
  const sourcePoint = mapPagePoint(alignment.transform, pageX, pageY);
  const source = alignment.sourceImageData;
  const red = sampleChannel(
    source.data,
    source.width,
    source.height,
    sourcePoint.x,
    sourcePoint.y,
    0,
  );
  const green = sampleChannel(
    source.data,
    source.width,
    source.height,
    sourcePoint.x,
    sourcePoint.y,
    1,
  );
  const blue = sampleChannel(
    source.data,
    source.width,
    source.height,
    sourcePoint.x,
    sourcePoint.y,
    2,
  );
  return (red * 0.2126) + (green * 0.7152) + (blue * 0.0722);
}

// Reads the checksum-protected footer strip without trusting OCR for roster identity.
export function readAttendanceTemplatePageIdentity(
  alignment: AttendancePageAlignment,
) {
  const sampleY = ATTENDANCE_TEMPLATE_IDENTITY_STRIP_Y_MM +
    (ATTENDANCE_TEMPLATE_IDENTITY_STRIP_HEIGHT_MM / 2);
  const luminanceValues = Array.from(
    { length: ATTENDANCE_TEMPLATE_IDENTITY_MODULE_COUNT },
    (_, moduleIndex) => {
      const sampleX = ATTENDANCE_TEMPLATE_IDENTITY_STRIP_X_MM +
        ((moduleIndex + 0.5) * ATTENDANCE_TEMPLATE_IDENTITY_MODULE_WIDTH_MM);
      const offsets = [-0.3, 0, 0.3];
      const samples = offsets.flatMap((xOffset) => offsets.map((yOffset) =>
        samplePageLuminance(alignment, sampleX + xOffset, sampleY + yOffset)));
      return samples.reduce((sum, value) => sum + value, 0) / samples.length;
    },
  );
  const sorted = [...luminanceValues].sort((first, second) => first - second);
  const darkLevel = sorted[Math.floor(sorted.length * 0.15)] ?? 0;
  const lightLevel = sorted[Math.floor(sorted.length * 0.85)] ?? 255;
  if (lightLevel - darkLevel < 70) {
    return null;
  }
  const threshold = (darkLevel + lightLevel) / 2;
  return decodeAttendanceTemplatePageIdentity(
    luminanceValues.map((luminance) => luminance < threshold),
  );
}

function extractMappedRegion(
  alignment: AttendancePageAlignment,
  region: RegionMm,
  pixelsPerMm: number,
) {
  const output = createCanvas(region.width * pixelsPerMm, region.height * pixelsPerMm);
  const outputContext = getCanvasContext(output);
  const source = alignment.sourceImageData;
  const outputImage = outputContext.createImageData(output.width, output.height);

  for (let outputY = 0; outputY < output.height; outputY += 1) {
    const pageY = region.y + ((outputY + 0.5) / pixelsPerMm);
    for (let outputX = 0; outputX < output.width; outputX += 1) {
      const pageX = region.x + ((outputX + 0.5) / pixelsPerMm);
      const sourcePoint = mapPagePoint(alignment.transform, pageX, pageY);
      const outputOffset = ((outputY * output.width) + outputX) * 4;
      outputImage.data[outputOffset] = sampleChannel(
        source.data,
        source.width,
        source.height,
        sourcePoint.x,
        sourcePoint.y,
        0,
      );
      outputImage.data[outputOffset + 1] = sampleChannel(
        source.data,
        source.width,
        source.height,
        sourcePoint.x,
        sourcePoint.y,
        1,
      );
      outputImage.data[outputOffset + 2] = sampleChannel(
        source.data,
        source.width,
        source.height,
        sourcePoint.x,
        sourcePoint.y,
        2,
      );
      outputImage.data[outputOffset + 3] = 255;
    }
  }

  outputContext.putImageData(outputImage, 0, 0);
  return output;
}

function prepareOcrRegion(canvas: HTMLCanvasElement, blankThreshold: number) {
  const context = getCanvasContext(canvas);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const luminanceValues: number[] = [];
  for (let offset = 0; offset < image.data.length; offset += 16) {
    luminanceValues.push(
      (image.data[offset] * 0.2126) +
      (image.data[offset + 1] * 0.7152) +
      (image.data[offset + 2] * 0.0722),
    );
  }
  luminanceValues.sort((first, second) => first - second);
  const background = luminanceValues[
    Math.floor(luminanceValues.length * 0.8)
  ] ?? 255;
  const inkThreshold = Math.min(210, Math.max(80, background - 30));
  let darkPixels = 0;
  let minInkX = canvas.width;
  let maxInkX = -1;
  let minInkY = canvas.height;
  let maxInkY = -1;

  for (let offset = 0; offset < image.data.length; offset += 4) {
    const luminance = (image.data[offset] * 0.2126) +
      (image.data[offset + 1] * 0.7152) +
      (image.data[offset + 2] * 0.0722);
    const value = luminance < inkThreshold ? 0 : 255;
    if (value === 0) {
      darkPixels += 1;
      const pixelIndex = offset / 4;
      const pixelX = pixelIndex % canvas.width;
      const pixelY = Math.floor(pixelIndex / canvas.width);
      minInkX = Math.min(minInkX, pixelX);
      maxInkX = Math.max(maxInkX, pixelX);
      minInkY = Math.min(minInkY, pixelY);
      maxInkY = Math.max(maxInkY, pixelY);
    }
    image.data[offset] = value;
    image.data[offset + 1] = value;
    image.data[offset + 2] = value;
    image.data[offset + 3] = 255;
  }
  context.putImageData(image, 0, 0);

  const inkRatio = darkPixels / (canvas.width * canvas.height);
  const isBlank = inkRatio < blankThreshold;
  const cropPadding = 8;
  const cropX = isBlank ? 0 : Math.max(0, minInkX - cropPadding);
  const cropY = isBlank ? 0 : Math.max(0, minInkY - cropPadding);
  const cropRight = isBlank ? canvas.width : Math.min(canvas.width, maxInkX + cropPadding + 1);
  const cropBottom = isBlank ? canvas.height : Math.min(canvas.height, maxInkY + cropPadding + 1);
  const cropWidth = Math.max(1, cropRight - cropX);
  const cropHeight = Math.max(1, cropBottom - cropY);
  const padded = createCanvas(cropWidth + 24, cropHeight + 24);
  const paddedContext = getCanvasContext(padded);
  paddedContext.fillStyle = '#ffffff';
  paddedContext.fillRect(0, 0, padded.width, padded.height);
  paddedContext.drawImage(
    canvas,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    12,
    12,
    cropWidth,
    cropHeight,
  );
  return {
    canvas: padded,
    inkRatio,
    isBlank,
  } satisfies PreparedAttendanceOcrRegion;
}

function getStudentRowTopMm(pageRowIndex: number) {
  return ATTENDANCE_TEMPLATE_TABLE_TOP_MM +
    ATTENDANCE_TEMPLATE_HEADER_HEIGHT_MM +
    (pageRowIndex * ATTENDANCE_TEMPLATE_ROW_HEIGHT_MM);
}

// Crops one handwritten P/A/L/E cell without including its printed grid borders.
export function extractAttendanceStatusRegion(
  alignment: AttendancePageAlignment,
  pageRowIndex: number,
) {
  const region = {
    x: ATTENDANCE_TEMPLATE_PAGE_MARGIN_MM +
      ATTENDANCE_TEMPLATE_STUDENT_COLUMN_WIDTH_MM +
      1,
    y: getStudentRowTopMm(pageRowIndex) + 0.8,
    width: ATTENDANCE_TEMPLATE_STATUS_COLUMN_WIDTH_MM - 2,
    height: ATTENDANCE_TEMPLATE_ROW_HEIGHT_MM - 1.6,
  };
  return prepareOcrRegion(
    extractMappedRegion(alignment, region, CELL_PIXELS_PER_MM),
    0.0025,
  );
}

// Crops one handwritten remarks cell separately so status recognition stays constrained.
export function extractAttendanceRemarksRegion(
  alignment: AttendancePageAlignment,
  pageRowIndex: number,
) {
  const region = {
    x: ATTENDANCE_TEMPLATE_PAGE_MARGIN_MM +
      ATTENDANCE_TEMPLATE_STUDENT_COLUMN_WIDTH_MM +
      ATTENDANCE_TEMPLATE_STATUS_COLUMN_WIDTH_MM +
      1,
    y: getStudentRowTopMm(pageRowIndex) + 0.8,
    width: ATTENDANCE_TEMPLATE_REMARKS_COLUMN_WIDTH_MM - 2,
    height: ATTENDANCE_TEMPLATE_ROW_HEIGHT_MM - 1.6,
  };
  return prepareOcrRegion(
    extractMappedRegion(alignment, region, CELL_PIXELS_PER_MM),
    0.001,
  );
}
