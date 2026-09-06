import { PDFDocument, PDFHexString, PDFName } from 'pdf-lib';
import { vi } from 'vitest';
import type { PDFData } from '../js/workflow/types';

vi.mock('../js/utils/load-pdf-document.js', () => ({
  loadPdfDocument: (bytes: Uint8Array | ArrayBuffer) =>
    PDFDocument.load(bytes, { ignoreEncryption: true, throwOnInvalidObject: false }),
}));

import { ReversePagesNode } from '../js/workflow/nodes/reverse-pages-node';
import { RemoveAnnotationsNode } from '../js/workflow/nodes/remove-annotations-node';
import { AddBlankPageNode } from '../js/workflow/nodes/add-blank-page-node';

async function input(doc: PDFDocument, filename = 'fixture.pdf'): Promise<PDFData> {
  return { type: 'pdf', document: doc, bytes: new Uint8Array(await doc.save()), filename };
}

function single(output: Record<string, unknown>): PDFData {
  const pdf = output.pdf as PDFData;
  expect(pdf.type).toBe('pdf');
  return pdf;
}

describe('enabled workflow nodes execute against synthetic PDFs', () => {
  it('reverses actual page order and preserves a loadable PDF', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([101, 201]); doc.addPage([202, 302]); doc.addPage([303, 403]);
    const result = single(await new ReversePagesNode().data({ pdf: [await input(doc)] }));
    const loaded = await PDFDocument.load(result.bytes);
    expect(loaded.getPages().map(page => page.getWidth())).toEqual([303, 202, 101]);
    expect(result.filename).toBe('fixture_reversed.pdf');
  });

  it('removes page annotation dictionaries from actual output bytes', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([200, 300]);
    const annotation = doc.context.obj({
      Type: 'Annot', Subtype: 'Text', Rect: [10, 10, 30, 30],
      Contents: PDFHexString.fromText('Synthetic annotation'),
    });
    page.node.set(PDFName.of('Annots'), doc.context.obj([doc.context.register(annotation)]));
    const source = await input(doc);
    const before = await PDFDocument.load(source.bytes);
    expect(before.getPages()[0].node.Annots()).toBeDefined();
    const result = single(await new RemoveAnnotationsNode().data({ pdf: [source] }));
    const loaded = await PDFDocument.load(result.bytes);
    expect(loaded.getPages()[0].node.Annots()).toBeUndefined();
    expect(result.filename).toBe('fixture_clean.pdf');
  });

  it('inserts the requested blank-page count after a real page', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([200, 300]); doc.addPage([400, 500]);
    const node = new AddBlankPageNode();
    (node.controls.blankPosition as { value: string }).value = 'after';
    (node.controls.afterPage as { value: number }).value = 1;
    (node.controls.count as { value: number }).value = 2;
    const result = single(await node.data({ pdf: [await input(doc)] }));
    const loaded = await PDFDocument.load(result.bytes);
    expect(loaded.getPageCount()).toBe(4);
    expect(loaded.getPages().map(page => page.getSize())).toEqual([
      { width: 200, height: 300 }, { width: 200, height: 300 },
      { width: 200, height: 300 }, { width: 400, height: 500 },
    ]);
    expect(result.filename).toBe('fixture_blank.pdf');
  });
});
