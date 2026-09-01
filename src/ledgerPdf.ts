/**
 * ledgerPdf.ts
 *
 * Generates the milk-ledger PDF entirely in JavaScript using pdf-lib.
 * No WebView, no native printing pipeline — runs instantly on both
 * Android and iOS inside the Expo managed workflow.
 */
import { File, Paths } from 'expo-file-system';
import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';

import {
  formatLedgerDate,
  formatQty,
  formatRupees,
  monthYearUpper,
} from './format';
import type { LedgerRow } from './types';
// ---------------------------------------------------------------------------
// Layout constants (all in PDF "points": 1pt = 1/72 inch)
// ---------------------------------------------------------------------------
const PAGE_W = 595; // A4 width
const PAGE_H = 842; // A4 height
const MARGIN = 36; // 0.5 inch margin

const COL_DATE = 98;
const COL_NUM = 85; // width for each of the 5 numeric columns
const TABLE_W = COL_DATE + COL_NUM * 5; // 523 (fills page between margins)
const TABLE_X = (PAGE_W - TABLE_W) / 2; // 36 (centered)

const ROW_H = 22;
const HEADER_H = 26;

const FONT_TITLE = 18;
const FONT_SUB = 15;
const FONT_HEAD = 9.5;
const FONT_BODY = 10;

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------
const C_BLACK = rgb(0, 0, 0); // Pure black
const C_INK = rgb(0.1, 0.1, 0.1);
const C_MUTED = rgb(0.35, 0.35, 0.35);
const C_LINE = rgb(0.75, 0.72, 0.68);
const C_HEAD_BG = rgb(0.95, 0.94, 0.89);
const C_TOTAL_BG = rgb(1, 0.96, 0.76);
const C_WHITE = rgb(1, 1, 1);

// ---------------------------------------------------------------------------
// Tiny helper to clip text that's too wide for a cell
// ---------------------------------------------------------------------------
function clip(text: string, maxChars: number): string {
  return text.length > maxChars ? text.slice(0, maxChars - 1) + '…' : text;
}

// ---------------------------------------------------------------------------
// Draw a single table row (all contents centered in cells)
// ---------------------------------------------------------------------------
function drawRow(
  page: PDFPage,
  y: number,
  cells: string[],
  font: PDFFont,
  bold: PDFFont,
  isHeader = false,
  isTotal = false
) {
  const x0 = TABLE_X;
  const h = isHeader ? HEADER_H : ROW_H;
  const fontSize = isHeader ? FONT_HEAD : FONT_BODY;
  const textFont = isHeader || isTotal ? bold : font;
  const textColor = isHeader ? C_MUTED : C_BLACK;
  const bgColor = isHeader ? C_HEAD_BG : isTotal ? C_TOTAL_BG : C_WHITE;

  // Background
  page.drawRectangle({
    x: x0,
    y: y - h,
    width: TABLE_W,
    height: h,
    color: bgColor,
  });

  // Bottom border
  page.drawLine({
    start: { x: x0, y: y - h },
    end: { x: x0 + TABLE_W, y: y - h },
    thickness: 0.5,
    color: C_LINE,
  });

  // Column widths
  const widths = [COL_DATE, COL_NUM, COL_NUM, COL_NUM, COL_NUM, COL_NUM];

  let cx = x0;
  cells.forEach((cell, i) => {
    const w = widths[i] ?? COL_NUM;
    const textW = textFont.widthOfTextAtSize(cell, fontSize);
    // Center text inside cell
    const textX = cx + (w - textW) / 2;
    const textY = y - h + (h - fontSize) / 2 + 1.5;

    page.drawText(clip(cell, 20), {
      x: textX,
      y: textY,
      size: fontSize,
      font: textFont,
      color: textColor,
    });

    // Vertical divider
    page.drawLine({
      start: { x: cx + w, y },
      end: { x: cx + w, y: y - h },
      thickness: 0.4,
      color: C_LINE,
    });

    cx += w;
  });

  // Left border
  page.drawLine({
    start: { x: x0, y },
    end: { x: x0, y: y - h },
    thickness: 0.4,
    color: C_LINE,
  });
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export async function buildAndSaveLedgerPdf(params: {
  start: string;
  end: string;
  farmerName: string;
  farmerAddress: string;
  rows: LedgerRow[];
}): Promise<string> {
  const { start, end, farmerName, farmerAddress, rows } = params;

  // ---- Title ---------------------------------------------------------------
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  const title = sameMonth
    ? `MILK SALE  ${monthYearUpper(start)}`
    : `MILK SALE  ${formatLedgerDate(start)} – ${formatLedgerDate(end)}`;

  const farmerLine = [farmerName, farmerAddress]
    .filter((p) => p.trim().length > 0)
    .join(', ') || 'Farmer name and address not set';

  // ---- Totals --------------------------------------------------------------
  const morningTotal = rows.reduce((s, r) => s + (r.morning_litres ?? 0), 0);
  const afternoonTotal = rows.reduce((s, r) => s + (r.afternoon_litres ?? 0), 0);
  const litresTotal = rows.reduce((s, r) => s + r.total, 0);
  const amountTotal = rows.reduce((s, r) => s + r.amount, 0);
  const rate = rows[0]?.rate ?? 0;

  // ---- PDF document --------------------------------------------------------
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // We may need multiple pages if there are many rows.
  // Reserve space: margin-top + title + subtitle + table-header
  const reservedTop = MARGIN + FONT_TITLE + 10 + FONT_SUB + 18 + HEADER_H;
  const usableH = PAGE_H - reservedTop - MARGIN; // usable body height per page
  const rowsPerPage = Math.floor(usableH / ROW_H);

  const totalPages = Math.ceil(rows.length / rowsPerPage) || 1;

  for (let p = 0; p < totalPages; p++) {
    const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    const pageRows = rows.slice(p * rowsPerPage, (p + 1) * rowsPerPage);
    const isLastPage = p === totalPages - 1;

    let curY = PAGE_H - MARGIN;

    // -- Title & Address (first page only) ---------------------------------
    if (p === 0) {
      const titleW = bold.widthOfTextAtSize(title, FONT_TITLE);
      page.drawText(title, {
        x: (PAGE_W - titleW) / 2,
        y: curY - FONT_TITLE,
        size: FONT_TITLE,
        font: bold,
        color: C_BLACK,
      });
      curY -= FONT_TITLE + 10;

      const subW = bold.widthOfTextAtSize(farmerLine, FONT_SUB);
      page.drawText(farmerLine, {
        x: (PAGE_W - subW) / 2,
        y: curY - FONT_SUB,
        size: FONT_SUB,
        font: bold,
        color: C_BLACK,
      });
      curY -= FONT_SUB + 18;
    } else {
      // Continuation header
      const contTitle = `${title} (cont.)`;
      const contW = bold.widthOfTextAtSize(contTitle, FONT_SUB);
      page.drawText(contTitle, {
        x: (PAGE_W - contW) / 2,
        y: curY - FONT_SUB,
        size: FONT_SUB,
        font: bold,
        color: C_BLACK,
      });
      curY -= FONT_SUB + 14;
    }

    // -- Table header --------------------------------------------------------
    drawRow(
      page,
      curY,
      ['Date', 'Morning(L)', 'Afternoon(L)', 'Total(L)', 'Rate(Rs.)', 'Amount(Rs.)'],
      font,
      bold,
      true
    );
    curY -= HEADER_H;

    // Top border of table
    page.drawLine({
      start: { x: TABLE_X, y: curY + HEADER_H },
      end: { x: TABLE_X + TABLE_W, y: curY + HEADER_H },
      thickness: 0.5,
      color: C_LINE,
    });

    // -- Data rows -----------------------------------------------------------
    for (const row of pageRows) {
      drawRow(
        page,
        curY,
        [
          formatLedgerDate(row.date),
          formatQty(row.morning_litres),
          formatQty(row.afternoon_litres),
          formatQty(row.total),
          formatQty(row.rate),
          formatQty(row.amount),
        ],
        font,
        bold
      );
      curY -= ROW_H;
    }

    // -- Total row (last page only) -----------------------------------------
    if (isLastPage) {
      drawRow(
        page,
        curY,
        [
          'TOTAL',
          formatQty(morningTotal),
          formatQty(afternoonTotal),
          formatQty(litresTotal),
          formatQty(rate),
          formatRupees(amountTotal),
        ],
        font,
        bold,
        false,
        true
      );
      curY -= ROW_H;

      // Bottom border
      page.drawLine({
        start: { x: TABLE_X, y: curY },
        end: { x: TABLE_X + TABLE_W, y: curY },
        thickness: 0.5,
        color: C_LINE,
      });
    }

    // -- Page number ---------------------------------------------------------
    const pageNum = `Page ${p + 1} of ${totalPages}`;
    const pnW = font.widthOfTextAtSize(pageNum, 8);
    page.drawText(pageNum, {
      x: (PAGE_W - pnW) / 2,
      y: MARGIN / 2,
      size: 8,
      font,
      color: C_MUTED,
    });
  }

  // ---- Serialize & save to cache ------------------------------------------
  const pdfBytes = await pdfDoc.save();

  const dateLabel = sameMonth
    ? monthYearUpper(start)
    : `${formatLedgerDate(start).replace(/\//g, '-')}_${formatLedgerDate(end).replace(/\//g, '-')}`;
  const nameLabel = farmerName.trim() || 'Farmer';
  const rawFileName = `Milk Sale ${dateLabel}, ${nameLabel}.pdf`;
  const fileName = rawFileName.replace(/[/\\?%*:|"<>]/g, '_');

  const file = new File(Paths.cache, fileName);
  if (file.exists) {
    try {
      file.delete();
    } catch {}
  }
  file.write(pdfBytes);

  return file.uri;
}
