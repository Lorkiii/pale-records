// Encodes and validates the non-security page identity strip printed on PALE templates.
import { ATTENDANCE_TEMPLATE_PAGE_WIDTH_MM } from './attendance-template-layout';

export const ATTENDANCE_TEMPLATE_IDENTITY_MODULE_WIDTH_MM = 1.5;
export const ATTENDANCE_TEMPLATE_IDENTITY_STRIP_Y_MM = 192.8;
export const ATTENDANCE_TEMPLATE_IDENTITY_STRIP_HEIGHT_MM = 3;

const IDENTITY_MAGIC = 0xa7;
const IDENTITY_HASH_BYTE_COUNT = 8;
const IDENTITY_PAYLOAD_BYTE_COUNT = 12;
const IDENTITY_TOTAL_BYTE_COUNT = IDENTITY_PAYLOAD_BYTE_COUNT + 1;

export const ATTENDANCE_TEMPLATE_IDENTITY_MODULE_COUNT = IDENTITY_TOTAL_BYTE_COUNT * 8;

export interface AttendanceTemplatePageIdentity {
  reference: string;
  pageNumber: number;
  pageCount: number;
}

function getIdentityStripStartMm() {
  const stripWidth = ATTENDANCE_TEMPLATE_IDENTITY_MODULE_COUNT *
    ATTENDANCE_TEMPLATE_IDENTITY_MODULE_WIDTH_MM;
  return (ATTENDANCE_TEMPLATE_PAGE_WIDTH_MM - stripWidth) / 2;
}

export const ATTENDANCE_TEMPLATE_IDENTITY_STRIP_X_MM = getIdentityStripStartMm();

function calculateIdentityChecksum(bytes: readonly number[]) {
  let checksum = 0;
  for (const byte of bytes) {
    checksum ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      checksum = checksum & 0x80
        ? ((checksum << 1) ^ 0x07) & 0xff
        : (checksum << 1) & 0xff;
    }
  }
  return checksum;
}

function parseReference(reference: string) {
  const match = /^PALT-([0-9])-([A-F0-9]{16})$/.exec(reference);
  if (!match) {
    throw new Error('The PALE template reference cannot be encoded.');
  }
  return {
    version: Number(match[1]),
    hash: match[2],
  };
}

// Serializes one stable reference and page position into checksum-protected modules.
export function encodeAttendanceTemplatePageIdentity(
  reference: string,
  pageNumber: number,
  pageCount: number,
) {
  const { version, hash } = parseReference(reference);
  const bytes = [IDENTITY_MAGIC, version, pageNumber, pageCount];
  for (let index = 0; index < IDENTITY_HASH_BYTE_COUNT; index += 1) {
    bytes.push(Number.parseInt(hash.slice(index * 2, (index * 2) + 2), 16));
  }
  bytes.push(calculateIdentityChecksum(bytes));

  return bytes.flatMap((byte) => Array.from(
    { length: 8 },
    (_, bitIndex) => Boolean(byte & (1 << (7 - bitIndex))),
  ));
}

// Rejects damaged or unrelated strips before they can map data to roster rows.
export function decodeAttendanceTemplatePageIdentity(
  modules: readonly boolean[],
): AttendanceTemplatePageIdentity | null {
  if (modules.length !== ATTENDANCE_TEMPLATE_IDENTITY_MODULE_COUNT) {
    return null;
  }
  const bytes = Array.from({ length: IDENTITY_TOTAL_BYTE_COUNT }, (_, byteIndex) => {
    let value = 0;
    for (let bitIndex = 0; bitIndex < 8; bitIndex += 1) {
      if (modules[(byteIndex * 8) + bitIndex]) {
        value |= 1 << (7 - bitIndex);
      }
    }
    return value;
  });
  const payload = bytes.slice(0, IDENTITY_PAYLOAD_BYTE_COUNT);
  if (
    payload[0] !== IDENTITY_MAGIC ||
    bytes.at(-1) !== calculateIdentityChecksum(payload)
  ) {
    return null;
  }

  const version = payload[1];
  const pageNumber = payload[2];
  const pageCount = payload[3];
  if (version < 1 || version > 9 || pageNumber < 1 || pageNumber > pageCount) {
    return null;
  }
  const hash = payload
    .slice(4)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return {
    reference: `PALT-${version}-${hash}`,
    pageNumber,
    pageCount,
  };
}
