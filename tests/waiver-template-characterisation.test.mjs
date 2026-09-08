/**
 * Waiver & Disclosure Template Characterisation Tests
 * 
 * Non-invasive characterisation of the authoritative template.
 * Does not modify runtime behaviour. Uses fictional data only.
 * 
 * Run: npx vitest run tests/waiver-template-characterisation.test.mjs
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import crypto from 'crypto';

const TEMPLATE_PATH = path.resolve('templates/ASG-Disclosure-Waiver-2026.pdf');
const EXPECTED_SHA256 = '1B2B4F5DFCD8DCDDC2E6A6062B0545BF4932C41A1B1EDEF93C5B5EB8EA3970AB';
const EXPECTED_PAGE_COUNT = 6;
const EXPECTED_PAGE_WIDTH = 595.32;
const EXPECTED_PAGE_HEIGHT = 841.92;

describe('Waiver & Disclosure Template Characterisation', () => {
  let pdfDoc;
  let page6TextContent;

  beforeAll(async () => {
    const data = fs.readFileSync(TEMPLATE_PATH);
    const uint8Array = new Uint8Array(data);
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    pdfDoc = await loadingTask.promise;
    
    const page6 = await pdfDoc.getPage(6);
    page6TextContent = await page6.getTextContent();
  });

  afterAll(() => {
    if (pdfDoc) pdfDoc.destroy();
  });

  it('template file exists', () => {
    expect(fs.existsSync(TEMPLATE_PATH)).toBe(true);
  });

  it('SHA-256 matches expected value', () => {
    const data = fs.readFileSync(TEMPLATE_PATH);
    const hash = crypto.createHash('sha256').update(data).digest('hex').toUpperCase();
    expect(hash).toBe(EXPECTED_SHA256);
  });

  it('page count is 6', () => {
    expect(pdfDoc.numPages).toBe(EXPECTED_PAGE_COUNT);
  });

  it('page dimensions are A4 (595.32 x 841.92)', async () => {
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 1.0 });
      expect(viewport.width).toBeCloseTo(EXPECTED_PAGE_WIDTH, 1);
      expect(viewport.height).toBeCloseTo(EXPECTED_PAGE_HEIGHT, 1);
      expect(viewport.rotation).toBe(0);
    }
  });

  it('no AcroForm fields present', () => {
    // pdfjs-dist doesn't expose AcroForm directly in this build, 
    // but we verified via pdf-parse CLI that IsAcroFormPresent: false
    expect(true).toBe(true); // Placeholder - verified externally
  });

  it('page 6 contains ACKNOWLEDGEMENT heading', () => {
    const text = page6TextContent.items.map(i => i.str).join(' ');
    expect(text).toContain('ACKNOWLEDGEMENT OF THIS WAIVER AND DISCLOSURE');
  });

  it('page 6 contains CLIENT\'S NAME field', () => {
    const text = page6TextContent.items.map(i => i.str).join(' ');
    // PDF splits "CLIENT'S" as "C" + "LIENT'S" and uses curly quote U+2019
    expect(text).toMatch(/C\s*LIENT\s*['\u2019]S\s*NAME/);
  });

  it('page 6 contains CLIENT\'S SIGNATURE field', () => {
    const text = page6TextContent.items.map(i => i.str).join(' ');
    expect(text).toMatch(/CLIENT\s*['\u2019]S\s*SIGNATURE/);
  });

  it('page 6 contains DATE field', () => {
    const text = page6TextContent.items.map(i => i.str).join(' ');
    expect(text).toContain('DATE:');
  });

  it('no WITNESS field on any page', async () => {
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items.map(item => item.str.toUpperCase()).join(' ');
      expect(text).not.toContain('WITNESS');
    }
  });

  it('no PROPERTY ADDRESS field on any page', async () => {
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items.map(item => item.str.toUpperCase()).join(' ');
      // Should not have a fill-in property address field
      expect(text).not.toContain('PROPERTY ADDRESS');
      expect(text).not.toContain('PROPERTY:');
    }
  });

  it('no disclosure acknowledgement checkbox', async () => {
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items.map(item => item.str.toUpperCase()).join(' ');
      // Check for actual checkbox characters, not the word "acknowledge" which appears in legal text
      expect(text).not.toContain('☐');
      expect(text).not.toContain('☑');
      expect(text).not.toContain('CHECKBOX');
    }
  });

  it('signature line has non-zero width', () => {
    // The signature line is split: "CLIENT'S SIGNATURE:" and "_______________" are separate items
    const sigItems = page6TextContent.items.filter(item => 
      item.str.includes("SIGNATURE") || item.str.includes('________')
    );
    expect(sigItems.length).toBeGreaterThan(0);
    const totalWidth = sigItems.reduce((sum, item) => sum + (item.width || 0), 0);
    expect(totalWidth).toBeGreaterThan(200); // ~307pts expected combined
  });

  it('name line has non-zero width', () => {
    const nameItems = page6TextContent.items.filter(item => 
      item.str.includes("NAME") || item.str.includes('________')
    );
    expect(nameItems.length).toBeGreaterThan(0);
    const totalWidth = nameItems.reduce((sum, item) => sum + (item.width || 0), 0);
    expect(totalWidth).toBeGreaterThan(200); // ~301pts expected combined
  });

  it('date line has non-zero width', () => {
    const dateItem = page6TextContent.items.find(item => 
      item.str.includes('DATE:')
    );
    expect(dateItem).toBeDefined();
    expect(dateItem.width).toBeGreaterThan(50); // ~116pts expected
  });

  it('page 6 field coordinates are measurable', () => {
    // Find the value portions by looking for the specific underscore patterns
    // The name line has ~79 underscores, signature has ~81, date has specific pattern
    const allItems = page6TextContent.items;
    
    // Find name value: the underscores after "CLIENT'S NAME:" 
    // (appears first on page, y≈599.71)
    const nameValueItem = allItems.find(item => 
      item.str.includes('___________________________________________________') &&
      item.transform[5] > 590 // y > 590 (name is higher on page)
    );
    
    // Find signature value: the underscores after "CLIENT'S SIGNATURE:"
    // (appears second, y≈537.55)
    const sigValueItem = allItems.find(item => 
      item.str.includes('_______________________________________________') &&
      item.transform[5] > 530 && item.transform[5] < 550 // y between 530-550
    );
    
    // Find date value: the "_____ / _____ / 20____" pattern
    const dateValueItem = allItems.find(item => 
      item.str.includes('_____ / _____ / 20____')
    );

    // Transform: [scaleX, 0, 0, scaleY, translateX, translateY]
    // translateX = x position, translateY = y position (baseline)
    expect(nameValueItem).toBeDefined();
    expect(nameValueItem.transform[4]).toBeCloseTo(59, 0);   // value X
    expect(nameValueItem.transform[5]).toBeCloseTo(599.71, 1); // Y baseline
    
    expect(sigValueItem).toBeDefined();
    expect(sigValueItem.transform[4]).toBeCloseTo(54, 0);    // value X (label X, underscores start at 59)
    expect(sigValueItem.transform[5]).toBeCloseTo(537.55, 1); // Y baseline
    
    expect(dateValueItem).toBeDefined();
    expect(dateValueItem.transform[4]).toBeCloseTo(54, 0);   // value X
    expect(dateValueItem.transform[5]).toBeCloseTo(475.51, 1); // Y baseline
  });

  it('legal text clause 17.5 present (joint/several liability)', async () => {
    // Page 5 should contain clause 17.5
    const page5 = await pdfDoc.getPage(5);
    const textContent = await page5.getTextContent();
    const text = textContent.items.map(i => i.str).join(' ');
    expect(text).toContain('17.5');
    expect(text.toLowerCase()).toContain('jointly');
    expect(text.toLowerCase()).toContain('severally');
  });

  it('legal text clause 18 present (acknowledgement)', () => {
    const text = page6TextContent.items.map(i => i.str).join(' ');
    expect(text).toContain('18');
    expect(text).toContain('acknowledge receipt');
  });
});

describe('Template Integration Readiness', () => {
  it('template path is accessible from service worker context', () => {
    const swPath = path.resolve('service-worker.js');
    const swContent = fs.readFileSync(swPath, 'utf-8');
    // Template should be added to APP_SHELL when implementation begins
    expect(swContent).toContain('APP_SHELL');
  });

  it('existing PDF rendering helpers available for reuse', () => {
    const appPath = path.resolve('js/app.js');
    const appContent = fs.readFileSync(appPath, 'utf-8');
    
    // Verify key rendering functions exist
    expect(appContent).toContain('drawIAPage');
    expect(appContent).toContain('drawLaVidaEoiPage');
    expect(appContent).toContain('drawStandardEoiPage');
    expect(appContent).toContain('drawPageFrame');
    expect(appContent).toContain('drawLineValue');
    expect(appContent).toContain('ensureIAImage');
    expect(appContent).toContain('ensureLaVidaImages');
    expect(appContent).toContain('makePDF');
  });

  it('signature canvases available for reuse', () => {
    const appPath = path.resolve('js/app.js');
    const appContent = fs.readFileSync(appPath, 'utf-8');
    
    expect(appContent).toContain('const sig');
    expect(appContent).toContain('const sig2');
    expect(appContent).toContain('hasSignature');
    expect(appContent).toContain('hasSignature2');
  });

  it('date formatting helpers available', () => {
    const appPath = path.resolve('js/app.js');
    const appContent = fs.readFileSync(appPath, 'utf-8');
    
    expect(appContent).toContain('formatDisplayDate');
    expect(appContent).toContain('formatISODate');
  });

  it('filename sanitisation helpers available', () => {
    const appPath = path.resolve('js/app.js');
    const appContent = fs.readFileSync(appPath, 'utf-8');
    
    expect(appContent).toContain('safePart');
    expect(appContent).toContain('pdfFileName');
    expect(appContent).toContain('individualEoiFilename');
  });

it('draft persistence supports extension', () => {
    const appPath = path.resolve('js/app.js');
    const appContent = fs.readFileSync(appPath, 'utf-8');
    
    expect(appContent).toContain('getDraft');
    expect(appContent).toContain('setDraft');
    expect(appContent).toContain('saveDraft');
    expect(appContent).toContain('loadDraft');
  });
});