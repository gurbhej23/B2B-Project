import PDFDocument from 'pdfkit';
import { IInvoiceDocument } from './invoice.model';
import { amountInWordsINR } from '../../utils/number-to-words';

export interface CompanyInvoiceConfig {
  companyName: string;
  addressLine: string;
  stateLine: string;
  contactNo: string;
  gstin: string;
  stateCode: string;
  bankName: string;
  accountNo: string;
  ifscCode: string;
}

export const VERIFIED_COMPANY_CONFIG: CompanyInvoiceConfig = {
  companyName: 'NECESSITY INDIA PRIVATE LIMITED',
  addressLine: 'D-182 1ST FLOOR PHASE 8 B, MOHALI',
  stateLine: 'PUNJAB',
  contactNo: '9876076067',
  gstin: '03AAICN2021R1ZF',
  stateCode: '03',
  bankName: 'UCO Bank',
  accountNo: '01340510001998',
  ifscCode: 'UCBA0000134',
};

export class InvoicePdfGenerator {
  /**
   * Generates a tax invoice PDF stream matching the Necessity India official invoice layout.
   */
  static generateInvoicePdf(
    invoice: IInvoiceDocument,
    retailerDetails?: any,
    company: CompanyInvoiceConfig = VERIFIED_COMPANY_CONFIG
  ): PDFKit.PDFDocument {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 25,
      info: {
        Title: `Tax Invoice - ${invoice.invoiceNumber}`,
        Author: company.companyName,
        Subject: `Tax Invoice #${invoice.invoiceNumber}`,
      },
    });

    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 25;
    const contentWidth = pageWidth - margin * 2; // 545.28

    // Outer border
    doc.rect(margin, margin, contentWidth, pageHeight - margin * 2).strokeColor('#222222').lineWidth(0.8).stroke();

    let currentY = margin + 10;

    // Header top row: GSTIN & Original Copy
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
    doc.text(`GSTIN : ${company.gstin}`, margin + 10, currentY);
    doc.text('Original Copy', margin + contentWidth - 80, currentY, { width: 70, align: 'right' });

    currentY += 12;

    // Center TAX INVOICE or PROFORMA INVOICE
    const isProforma = (invoice as any).status === 'draft';
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text(isProforma ? 'PROFORMA INVOICE' : 'TAX INVOICE', margin, currentY, { width: contentWidth, align: 'center' });

    currentY += 14;

    // Company Title & Address
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text(company.companyName, margin, currentY, { width: contentWidth, align: 'center' });

    currentY += 14;
    doc.fontSize(8).font('Helvetica');
    doc.text(company.addressLine, margin, currentY, { width: contentWidth, align: 'center' });

    currentY += 10;
    doc.text(`${company.stateLine} CONTACT NO: ${company.contactNo}`, margin, currentY, {
      width: contentWidth,
      align: 'center',
    });

    currentY += 14;

    // Divider line between header and party details
    doc.moveTo(margin, currentY).lineTo(margin + contentWidth, currentY).stroke();

    // Two-column section: Party Details (Left) and Invoice Details (Right)
    const partySectionTop = currentY;
    const midX = margin + contentWidth * 0.52;

    // Vertical separator
    const partySectionHeight = 110;
    doc.moveTo(midX, partySectionTop).lineTo(midX, partySectionTop + partySectionHeight).stroke();

    // Left Column: Party Details
    const leftPad = margin + 8;
    let leftY = partySectionTop + 6;

    doc.fontSize(8).font('Helvetica-Bold').text('Party Details :', leftPad, leftY);
    leftY += 12;

    const bName = invoice.retailerBusinessName || retailerDetails?.businessName || 'Valued Trade Customer';
    doc.fontSize(8.5).font('Helvetica-Bold').text(bName.toUpperCase(), leftPad, leftY, { width: midX - leftPad - 5 });
    leftY += 12;

    const bAddr = retailerDetails?.billingAddress || {};
    const street = bAddr.street || retailerDetails?.address || '';
    if (street) {
      doc.fontSize(7.5).font('Helvetica').text(street.toUpperCase(), leftPad, leftY, { width: midX - leftPad - 5 });
      leftY += 10;
    }

    const cityStatePin = [bAddr.city, bAddr.state, bAddr.pincode].filter(Boolean).join(' , ');
    if (cityStatePin) {
      doc.fontSize(7.5).font('Helvetica').text(cityStatePin.toUpperCase(), leftPad, leftY, { width: midX - leftPad - 5 });
      leftY += 12;
    }

    const gstin = invoice.retailerGstin || retailerDetails?.gstin || 'Unregistered / Non-GST';
    doc.fontSize(8).font('Helvetica-Bold').text('GSTIN / UIN : ', leftPad, leftY, { continued: true });
    doc.font('Helvetica').text(gstin.toUpperCase());

    // Right Column: Invoice Details
    const rightPad = midX + 8;
    let rightY = partySectionTop + 6;

    const issueDateStr = new Date(invoice.issueDate).toLocaleDateString('en-GB'); // DD-MM-YYYY
    const stateName = bAddr.state || 'Punjab';
    const placeOfSupplyCode = bAddr.stateCode || (stateName.toLowerCase().includes('punjab') ? '03' : '04');

    const renderMetaRow = (label: string, val: string) => {
      doc.fontSize(7.5).font('Helvetica-Bold').text(label, rightPad, rightY, { width: 85 });
      doc.font('Helvetica').text(`: ${val}`, rightPad + 85, rightY);
      rightY += 10.5;
    };

    renderMetaRow('Invoice No.', invoice.invoiceNumber);
    renderMetaRow('Dated', issueDateStr);
    renderMetaRow('Place of Supply', `${stateName} (${placeOfSupplyCode})`);
    renderMetaRow('Reverse Charge', 'N');
    renderMetaRow('GR/RR No.', '—');
    renderMetaRow('Transport', '—');
    renderMetaRow('Vehicle No.', '—');
    renderMetaRow('Station', stateName);
    renderMetaRow('E-Way Bill No.', '—');

    currentY = partySectionTop + partySectionHeight;
    doc.moveTo(margin, currentY).lineTo(margin + contentWidth, currentY).stroke();

    // Table Columns Configuration
    // Total width = 545.28
    const cols = [
      { id: 'sn', label: 'S.N.', x: margin, w: 22, align: 'center' },
      { id: 'item', label: 'Item Name', x: margin + 22, w: 237, align: 'left' },
      { id: 'gst', label: 'Gst Slab', x: margin + 259, w: 42, align: 'center' },
      { id: 'qty', label: 'Qty. Unit', x: margin + 301, w: 52, align: 'center' },
      { id: 'mrp', label: 'MRP', x: margin + 353, w: 45, align: 'right' },
      { id: 'price', label: 'Price', x: margin + 398, w: 48, align: 'right' },
      { id: 'dis', label: 'Dis.', x: margin + 446, w: 38, align: 'right' },
      { id: 'amt', label: 'Amount (Rs.)', x: margin + 484, w: 61, align: 'right' },
    ];

    // Table Header Row
    const tableHeaderY = currentY;
    const headerRowHeight = 15;

    doc.fontSize(7).font('Helvetica-Bold').fillColor('#000000');
    cols.forEach((col) => {
      doc.text(col.label, col.x + 2, tableHeaderY + 4, {
        width: col.w - 4,
        align: col.align as any,
      });
    });

    currentY = tableHeaderY + headerRowHeight;
    doc.moveTo(margin, currentY).lineTo(margin + contentWidth, currentY).stroke();

    // Draw vertical column grid lines for table
    const tableStartLineY = currentY;

    // Render Items
    let totalPcs = 0;
    const items = invoice.items || [];
    const itemRowHeight = 14;

    items.forEach((item, idx) => {
      const rowY = currentY;
      const unitPriceRupees = ((Number(item.unitPricePaise) || 0) / 100).toFixed(2);
      const lineTotalRupees = ((Number(item.totalPaise) || 0) / 100).toFixed(2);
      const gstPercent = `${Number(item.gstRatePercent) || 0}%`;
      const qtyNum = Number(item.quantity) || 1;
      const qtyStr = `${qtyNum.toFixed(2)} Pcs.`;
      totalPcs += qtyNum;

      // Estimate MRP from line total or standard markup
      const mrpRupees = (((Number(item.unitPricePaise) || 0) * 1.4) / 100).toFixed(2);

      doc.fontSize(7).font('Helvetica');
      doc.text(String(idx + 1) + '.', cols[0].x + 2, rowY + 3, { width: cols[0].w - 4, align: 'center' });
      doc.text((item.name || 'Item').toUpperCase(), cols[1].x + 4, rowY + 3, { width: cols[1].w - 6, align: 'left', ellipsis: true });
      doc.text(gstPercent, cols[2].x + 2, rowY + 3, { width: cols[2].w - 4, align: 'center' });
      doc.text(qtyStr, cols[3].x + 2, rowY + 3, { width: cols[3].w - 4, align: 'center' });
      doc.text(mrpRupees, cols[4].x + 2, rowY + 3, { width: cols[4].w - 4, align: 'right' });
      doc.text(unitPriceRupees, cols[5].x + 2, rowY + 3, { width: cols[5].w - 4, align: 'right' });
      doc.text('0.00 %', cols[6].x + 2, rowY + 3, { width: cols[6].w - 4, align: 'right' });
      doc.text(lineTotalRupees, cols[7].x + 2, rowY + 3, { width: cols[7].w - 4, align: 'right' });

      currentY += itemRowHeight;
    });

    // Pad space if items are few to keep invoice look consistent
    const minRowsHeight = Math.max(160, items.length * itemRowHeight);
    const tableEndLineY = tableStartLineY + minRowsHeight;

    // Draw vertical column separators
    cols.forEach((col, idx) => {
      if (idx > 0) {
        doc.moveTo(col.x, tableHeaderY).lineTo(col.x, tableEndLineY).stroke();
      }
    });

    currentY = tableEndLineY;
    doc.moveTo(margin, currentY).lineTo(margin + contentWidth, currentY).stroke();

    // Subtotal Row & Round Off
    const totalRupees = (Number(invoice.totalPaise) || 0) / 100;
    const integerTotal = Math.max(0, Math.round(totalRupees));
    const roundOff = (integerTotal - totalRupees).toFixed(2);

    const subtotalText = totalRupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const grandTotalText = integerTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Subtotal
    doc.fontSize(7.5).font('Helvetica-Bold');
    doc.text(subtotalText, cols[7].x + 2, currentY + 3, { width: cols[7].w - 4, align: 'right' });
    currentY += 12;

    // Round Off
    doc.fontSize(7).font('Helvetica');
    doc.text('Less : Rounded Off (-)', cols[3].x, currentY + 2, { width: cols[4].w + cols[5].w + cols[6].w, align: 'right' });
    doc.text(roundOff, cols[7].x + 2, currentY + 2, { width: cols[7].w - 4, align: 'right' });
    currentY += 12;

    doc.moveTo(margin, currentY).lineTo(margin + contentWidth, currentY).stroke();

    // Grand Total Row
    doc.fontSize(8).font('Helvetica-Bold');
    doc.text('Grand Total', margin + 120, currentY + 4);
    doc.text(`${totalPcs.toFixed(2)} Pcs.`, cols[3].x, currentY + 4, { width: cols[3].w, align: 'center' });
    doc.text(`Rs. ${grandTotalText}`, cols[7].x + 2, currentY + 4, { width: cols[7].w - 4, align: 'right' });

    currentY += 16;
    doc.moveTo(margin, currentY).lineTo(margin + contentWidth, currentY).stroke();

    // GST Tax Summary Table
    const isIntraState = bAddr.stateCode === '03' || (bAddr.state || '').toLowerCase().includes('punjab');
    const taxTableTop = currentY;

    // Compute Tax Breakdown by Slab
    const taxBySlab: Record<number, { taxable: number; tax: number }> = {};
    items.forEach((item) => {
      const rate = Number(item.gstRatePercent) || 0;
      if (!taxBySlab[rate]) {
        taxBySlab[rate] = { taxable: 0, tax: 0 };
      }
      taxBySlab[rate].taxable += (Number(item.taxableAmountPaise) || 0) / 100;
      taxBySlab[rate].tax += ((Number(item.cgstPaise) || 0) + (Number(item.sgstPaise) || 0) + (Number(item.igstPaise) || 0)) / 100;
    });

    const taxColWidths = isIntraState ? [45, 65, 55, 55, 60] : [55, 80, 75, 70];
    const taxTableWidth = isIntraState ? 280 : 280;

    doc.fontSize(7).font('Helvetica-Bold');
    let taxColX = margin + 8;

    if (isIntraState) {
      doc.text('Tax Rate', taxColX, currentY + 3);
      taxColX += taxColWidths[0];
      doc.text('Taxable Amt.', taxColX, currentY + 3);
      taxColX += taxColWidths[1];
      doc.text('CGST Amt.', taxColX, currentY + 3);
      taxColX += taxColWidths[2];
      doc.text('SGST Amt.', taxColX, currentY + 3);
      taxColX += taxColWidths[3];
      doc.text('Total Tax', taxColX, currentY + 3);
    } else {
      doc.text('Tax Rate', taxColX, currentY + 3);
      taxColX += taxColWidths[0];
      doc.text('Taxable Amt.', taxColX, currentY + 3);
      taxColX += taxColWidths[1];
      doc.text('IGST Amt.', taxColX, currentY + 3);
      taxColX += taxColWidths[2];
      doc.text('Total Tax', taxColX, currentY + 3);
    }

    currentY += 12;

    let totalTaxable = 0;
    let totalTaxAmt = 0;

    Object.keys(taxBySlab).forEach((slabStr) => {
      const slab = Number(slabStr);
      const data = taxBySlab[slab];
      totalTaxable += data.taxable;
      totalTaxAmt += data.tax;

      doc.fontSize(7).font('Helvetica');
      let rowX = margin + 8;

      doc.text(`${slab}%`, rowX, currentY + 2);
      rowX += taxColWidths[0];
      doc.text(data.taxable.toFixed(2), rowX, currentY + 2);
      rowX += taxColWidths[1];

      if (isIntraState) {
        doc.text((data.tax / 2).toFixed(2), rowX, currentY + 2);
        rowX += taxColWidths[2];
        doc.text((data.tax / 2).toFixed(2), rowX, currentY + 2);
        rowX += taxColWidths[3];
        doc.text(data.tax.toFixed(2), rowX, currentY + 2);
      } else {
        doc.text(data.tax.toFixed(2), rowX, currentY + 2);
        rowX += taxColWidths[2];
        doc.text(data.tax.toFixed(2), rowX, currentY + 2);
      }

      currentY += 10;
    });

    // Total tax row
    doc.fontSize(7).font('Helvetica-Bold');
    let totX = margin + 8;
    doc.text('Total', totX, currentY + 2);
    totX += taxColWidths[0];
    doc.text(totalTaxable.toFixed(2), totX, currentY + 2);
    totX += taxColWidths[1];

    if (isIntraState) {
      doc.text((totalTaxAmt / 2).toFixed(2), totX, currentY + 2);
      totX += taxColWidths[2];
      doc.text((totalTaxAmt / 2).toFixed(2), totX, currentY + 2);
      totX += taxColWidths[3];
      doc.text(totalTaxAmt.toFixed(2), totX, currentY + 2);
    } else {
      doc.text(totalTaxAmt.toFixed(2), totX, currentY + 2);
      totX += taxColWidths[2];
      doc.text(totalTaxAmt.toFixed(2), totX, currentY + 2);
    }

    currentY += 14;
    doc.moveTo(margin, currentY).lineTo(margin + contentWidth, currentY).stroke();

    // Amount in Words
    const words = amountInWordsINR(integerTotal);
    doc.fontSize(8).font('Helvetica-Bold').text(words, margin + 8, currentY + 4);

    currentY += 16;
    doc.moveTo(margin, currentY).lineTo(margin + contentWidth, currentY).stroke();

    // Bank Details Row
    doc.fontSize(8).font('Helvetica-Bold').text(
      `Bank Details : ${company.bankName} :A/C No.${company.accountNo} IFSC CODE-${company.ifscCode}`,
      margin + 8,
      currentY + 4
    );

    currentY += 16;
    doc.moveTo(margin, currentY).lineTo(margin + contentWidth, currentY).stroke();

    // Bottom Section: Terms & Conditions (Left) and Signatures (Right)
    const termsTop = currentY;
    const termsMidX = margin + contentWidth * 0.48;

    doc.moveTo(termsMidX, termsTop).lineTo(termsMidX, pageHeight - margin).stroke();

    // Terms (Left)
    doc.fontSize(7).font('Helvetica-Bold').text('Terms & Conditions', margin + 8, termsTop + 4);
    doc.fontSize(6.5).font('Helvetica');
    doc.text('E.& O.E.', margin + 8, termsTop + 13);
    doc.text('1. Goods once sold will not be taken back.', margin + 8, termsTop + 22);
    doc.text('2. Interest @ 18% p.a. will be charged if the payment', margin + 8, termsTop + 30);
    doc.text('is not made with in the stipulated time.', margin + 8, termsTop + 38);
    doc.text(`3. Subject to '${company.stateLine}' Jurisdiction only.`, margin + 8, termsTop + 46);

    // Signatures (Right)
    doc.fontSize(7.5).font('Helvetica-Bold').text("Receiver's Signature :", termsMidX + 10, termsTop + 4);

    doc.fontSize(8).font('Helvetica-Bold').text(
      `For ${company.companyName}`,
      termsMidX + 10,
      termsTop + 24,
      { width: contentWidth * 0.52 - 20, align: 'center' }
    );

    doc.fontSize(8).font('Helvetica-Bold').text(
      'Authorised Signatory',
      termsMidX + 10,
      pageHeight - margin - 16,
      { width: contentWidth * 0.52 - 20, align: 'center' }
    );

    return doc;
  }
}

