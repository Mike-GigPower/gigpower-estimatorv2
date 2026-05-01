import PDFDocument from "pdfkit/js/pdfkit.standalone";
import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";
import {
  groupLabourByDate,
  shouldGroupLabourByDate,
  sortLabourByDate,
} from "@/src/lib/estimator/pdfRows";

export const runtime = "nodejs";

function money(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";

  return value.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
  });
}

function checkPage(doc: PDFKit.PDFDocument, needed = 60) {
  if (doc.y + needed > 760) {
    doc.addPage();
    doc.y = 50;
    return true;
  }

  return false;
}

function formatPdfDate(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string) {
  checkPage(doc, 45);

  doc.moveDown(0.8);
  doc.fontSize(13).fillColor("#111").text(title, 40, doc.y, {
  width: 515,
  align: "left",
});

  doc
    .moveTo(40, doc.y + 4)
    .lineTo(555, doc.y + 4)
    .strokeColor("#fcb900")
    .lineWidth(1)
    .stroke();

  doc.moveDown(0.7);
  doc.fillColor("#111");
}

function rowText(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number) {
  doc.fontSize(8).fillColor("#777").text(label, x, y, { width: 90 });
  doc.fontSize(9).fillColor("#111").text(value || "-", x + 70, y, { width: 170 });
}

function labourHeader(doc: PDFKit.PDFDocument, grouped = false) {
  checkPage(doc, 35);

  const y = doc.y;

  doc.rect(40, y, 515, 18).fill("#111");
  doc.fillColor("#fcb900").fontSize(8);

  if (grouped) {
    doc.text("Role", 46, y + 5, { width: 125 });
   doc.text("Qty", 176, y + 5, { width: 35, align: "right" });
doc.text("Start", 235, y + 5, { width: 50, align: "center" });
    doc.text("Duration", 270, y + 5, { width: 60, align: "right" });
    doc.text("Notes", 338, y + 5, { width: 130, align: "center" });
    doc.text("Cost (ex GST)", 470, y + 5, { width: 78, align: "right" });
  } else {
    doc.text("Date", 46, y + 5, { width: 70 });
    doc.text("Role", 116, y + 5, { width: 105 });
    doc.text("Qty", 224, y + 5, { width: 35, align: "right" });
    doc.text("Start", 267, y + 5, { width: 45 });
    doc.text("Duration", 317, y + 5, { width: 60, align: "right" });
    doc.text("Notes", 383, y + 5, { width: 80, align: "center" });
    doc.text("Cost (ex GST)", 480, y + 5, { width: 68, align: "right" });
  }

  doc.y = y + 24;
  doc.fillColor("#111");
}

function labourLine(
  doc: PDFKit.PDFDocument,
  line: any,
  labourResultById: Map<string, any>,
  grouped = false
) {
  checkPage(doc, 35);

  const y = doc.y;
  const notes = line.notes || "";
  const resultLine = labourResultById.get(String(line.id));
  const lineCostExGst = resultLine?.costExGst ?? 0;

  doc.fontSize(8).fillColor("#111");

  if (grouped) {
    doc.text(line.role || "-", 46, y, { width: 125 });

doc.text(String(line.qty || 0), 176, y, {
  width: 35,
  align: "right",
});

doc.text(line.startTime || "-", 235, y, { width: 50, align: "center" });

doc.text(`${line.durationHours || 0} hrs`, 270, y, {
  width: 60,
  align: "right",
});

doc.text(notes, 338, y, { width: 115 });

doc.text(money(lineCostExGst), 455, y, {
  width: 93,
  align: "right",
});

    const rowHeight = Math.max(
      doc.heightOfString(notes, { width: 115 }),
      12
    );

    doc
      .moveTo(40, y + rowHeight + 5)
      .lineTo(555, y + rowHeight + 5)
      .strokeColor("#e6e6e6")
      .lineWidth(0.5)
      .stroke();

    doc.y = y + rowHeight + 10;
    return;
  }

  doc.text(line.shiftDate || "-", 46, y, { width: 70 });

doc.text(line.role || "-", 116, y, { width: 105 });

doc.text(String(line.qty || 0), 224, y, {
  width: 35,
  align: "right",
});

doc.text(line.startTime || "-", 267, y, { width: 45 });

doc.text(`${line.durationHours || 0} hrs`, 317, y, {
  width: 60,
  align: "right",
});

doc.text(notes, 383, y, { width: 80 });

doc.text(money(lineCostExGst), 465, y, {
  width: 83,
  align: "right",
});

  const rowHeight = Math.max(
    doc.heightOfString(notes, { width: 80 }),
    12
  );

  doc
    .moveTo(40, y + rowHeight + 5)
    .lineTo(555, y + rowHeight + 5)
    .strokeColor("#e6e6e6")
    .lineWidth(0.5)
    .stroke();

  doc.y = y + rowHeight + 10;
}

function getLabourLineCostExGst(
  line: any,
  labourResultById: Map<string, any>
) {
  const resultLine = labourResultById.get(String(line.id));
  const cost = resultLine?.costExGst;

  return typeof cost === "number" && Number.isFinite(cost) ? cost : 0;
}

function labourDayTotal(
  doc: PDFKit.PDFDocument,
  totalExGst: number
) {
  checkPage(doc, 28);

  const y = doc.y + 2;

  doc
    .fontSize(8)
    .fillColor("#111")
    .font("Helvetica-Bold")
    .text("Day total ex GST", 355, y, {
      width: 105,
      align: "right",
    });

  doc.text(money(totalExGst), 470, y, {
    width: 78,
    align: "right",
  });

  doc.font("Helvetica");
  doc.y = y + 18;
}

function nonLabourHeader(doc: PDFKit.PDFDocument) {
  checkPage(doc, 35);

  const y = doc.y;

  doc.rect(40, y, 515, 18).fill("#111");
  doc.fillColor("#fcb900").fontSize(8).font("Helvetica-Bold");

  doc.text("Item", 46, y + 5, { width: 250 });
  doc.text("Qty", 310, y + 5, { width: 50, align: "center" });
  doc.text("Cost (ex GST)", 420, y + 5, { width: 128, align: "right" });

  doc.font("Helvetica");
  doc.y = y + 24;
  doc.fillColor("#111");
}

function nonLabourLine(
  doc: PDFKit.PDFDocument,
  line: any,
  nonLabourResultById: Map<string, any>
) {
  checkPage(doc, 30);

  const y = doc.y;
  const resultLine = nonLabourResultById.get(String(line.id));
  const lineAmountExGst = resultLine?.lineAmountExGst ?? 0;

  doc.fontSize(8).fillColor("#111").font("Helvetica");

  doc.text(line.description || "-", 46, y, { width: 250 });
  doc.text(String(line.qty || 0), 310, y, {
    width: 50,
    align: "center",
  });
  doc.text(money(lineAmountExGst), 420, y, {
    width: 128,
    align: "right",
  });

  doc
    .moveTo(40, y + 17)
    .lineTo(555, y + 17)
    .strokeColor("#e6e6e6")
    .lineWidth(0.5)
    .stroke();

  doc.y = y + 24;
}

export async function POST(request: Request) {
  const body = await request.json();
  const { input, result, config } = body;
  const labourResultById = new Map<string, any>(
  (result?.labourLines || []).map((line: any) => [String(line.id), line])
);

const nonLabourResultById = new Map<string, any>(
  (result?.nonLabourLines || []).map((line: any) => [String(line.id), line])
);

  const doc = new PDFDocument({
    size: "A4",
    margin: 40,
  });

  const chunks: Buffer[] = [];

  doc.on("data", (chunk) => chunks.push(chunk));

  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
  
 

// Header
const headerY = 25;
const headerHeight = 80;

// Black background
doc
  .rect(0, headerY, 595, headerHeight)
  .fill("#111");

// Logo (larger + centred vertically in band)
try {
  const logoUrl = `${
    process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
  }/brand/gp-white-logo.png`;

  const res = await fetch(logoUrl);
  const arrayBuffer = await res.arrayBuffer();

  doc.image(arrayBuffer, 40, headerY + 10, { width: 130 });
} catch (e) {
  console.warn("Logo failed to load:", e);
}

// QUOTE label
doc
  .font("Helvetica-Bold")
  .fontSize(14)
  .fillColor("#ffffff")
  .text("ESTIMATE #", 350, headerY + 18, {
    width: 205,
    align: "right",
  });

// Quote number (highlight)
doc
  .font("Helvetica-Bold")
  .fontSize(12)
  .fillColor("#fcb900")
  .text(input.quoteNumber || "-", 350, headerY + 38, {
    width: 205,
    align: "right",
  });

// Gold divider
doc
  .moveTo(40, headerY + headerHeight)
  .lineTo(555, headerY + headerHeight)
  .strokeColor("#fcb900")
  .lineWidth(2)
  .stroke();

// Move content down
doc.y = headerY + headerHeight + 15;


sectionTitle(doc, "Customer and Event Details");

const detailsY = doc.y;

doc.fontSize(9).fillColor("#111").font("Helvetica");

// Use fallbacks to match your actual model
doc.text(
  `Company: ${input.companyName || "-"}`,
  40,
  detailsY
);

doc.text(`Contact: ${input.contact || input.contactName || "-"}`, 40, detailsY + 16);

doc.text(`Email: ${input.email || input.contactEmail || "-"}`, 40, detailsY + 32);

doc.text(
  `Phone: ${input.contactPhone || "-"}`,
  40,
  detailsY + 48
);

doc.text(`Venue: ${input.venue || "-"}`, 40, detailsY + 64);

// Right side
doc.text(`Quote Date: ${input.quoteDate || "-"}`, 340, detailsY);
doc.text(`Valid Until: ${input.validUntil || "-"}`, 340, detailsY + 16);
doc.text(`Status: ${input.status || "Draft"}`, 340, detailsY + 32);

doc.y = detailsY + 88;

  // Labour
const labourLines = input.labour || [];
const grouped = shouldGroupLabourByDate(labourLines);



sectionTitle(doc, "Labour");

if (!labourLines.length) {
  doc.fontSize(9).fillColor("#555").text("No labour lines included.");
} else if (grouped) {
  const groups = groupLabourByDate(labourLines);
  let headerPrintedOnCurrentPage = false;

  Object.entries(groups).forEach(([date, lines]) => {
    const pageBrokeBeforeDate = checkPage(doc, 55);

    if (pageBrokeBeforeDate) {
      headerPrintedOnCurrentPage = false;
    }

    doc
      .fontSize(10)
      .fillColor("#111")
      .font("Helvetica-Bold")
      .text(formatPdfDate(date), 40, doc.y, { width: 515 });

    doc.font("Helvetica");
    doc.moveDown(0.4);

    if (!headerPrintedOnCurrentPage) {
      labourHeader(doc, true);
      headerPrintedOnCurrentPage = true;
    }

    lines.forEach((line: any) => {
      const pageBrokeBeforeLine = checkPage(doc, 35);

      if (pageBrokeBeforeLine) {
        labourHeader(doc, true);
        headerPrintedOnCurrentPage = true;
      }

      labourLine(doc, line, labourResultById, true);
    });

    const dayTotalExGst = (lines as any[]).reduce(
      (sum, line) => sum + getLabourLineCostExGst(line, labourResultById),
      0
    );

    labourDayTotal(doc, dayTotalExGst);

    doc.moveDown(0.4);
  });
} else {
  labourHeader(doc, false);

  sortLabourByDate(labourLines).forEach((line: any) =>
    labourLine(doc, line, labourResultById, false)
  );
}

  // Non-labour
  const nonLabourLines = (input.nonLabour || []).filter((line: any) => {
  const hasDescription = line.description && line.description.trim() !== "";
  const hasQty = Number(line.qty || 0) > 0;
  const hasAmount = Number(line.amountExGst || 0) > 0;

  return hasDescription && (hasQty || hasAmount);
});

  

if (nonLabourLines.length > 0) {
  sectionTitle(doc, "Non-labour Items");

  nonLabourHeader(doc);

  nonLabourLines.forEach((line: any) =>
    nonLabourLine(doc, line, nonLabourResultById)
  );

  doc.moveDown(0.6);
}

const hasNonLabour = nonLabourLines.length > 0;

  // Totals
sectionTitle(doc, "Totals");

const totalsY = doc.y;
const totalsBoxHeight = hasNonLabour ? 92 : 76;

doc.rect(340, totalsY, 215, totalsBoxHeight).fill("#111");

doc.fillColor("#ffffff").fontSize(9);

doc.text("Labour ex GST", 355, totalsY + 14);
doc.text(money(result?.totals?.labourExGst), 455, totalsY + 14, {
  width: 85,
  align: "right",
});

let gstY = totalsY + 30;

if (hasNonLabour) {
  doc.text("Non-labour ex GST", 355, totalsY + 30);
  doc.text(money(result?.totals?.nonLabourExGst), 455, totalsY + 30, {
    width: 85,
    align: "right",
  });

  gstY = totalsY + 46;
}

doc.text("GST", 355, gstY);
doc.text(money(result?.totals?.gst), 455, gstY, {
  width: 85,
  align: "right",
});

doc.fillColor("#fcb900").fontSize(12);

const totalY = gstY + 22;

doc.text("Total inc GST", 355, totalY);
doc.text(money(result?.totals?.grandTotalIncGst), 455, totalY, {
  width: 85,
  align: "right",
});

doc.y = totalsY + totalsBoxHeight + 18;

  // Terms
const terms = config?.termsAndConditions || "";

if (terms.trim().length > 0) {
  doc.addPage();
  doc.y = 50;

  sectionTitle(doc, "Terms and Conditions");

  doc
    .fontSize(7.5)
    .fillColor("#333")
    .font("Helvetica")
    .text(terms, 40, doc.y, {
      width: 515,
      align: "left",
      lineGap: 1.2,
    });

  doc.moveDown(0.8);
}
  // Footer
const footerY = 760;

doc
  .fontSize(8)
  .fillColor("#777")
  .font("Helvetica-Bold")
  .text("GigPower - The Entertainment Labour Specialists", 40, footerY, {
    align: "center",
    width: 515,
  });

doc
  .font("Helvetica")
  .text("Gig Power Pty Ltd ABN: 92 052 306 706", 40, footerY + 12, {
    align: "center",
    width: 515,
  });

doc.text("Factory 9, 88 Dynon Road, West mMlbourne VIC 3003", 40, footerY + 24, {
  align: "center",
  width: 515,
});

  doc.end();

  const pdfBuffer = await done;

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="quote-${
        input.quoteNumber || "estimate"
      }.pdf"`,
    },
  });
}