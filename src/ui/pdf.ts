// הפיכת המסמך ללקוח לקובץ PDF (A4), כדי לצרף אותו להזמנה בפיירברי.
export async function sheetToPdf(el: HTMLElement): Promise<{ base64: string; blob: Blob }> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const W = 210, H = 297, margin = 8, w = W - 2 * margin, pxPerMm = canvas.width / w, pageH = Math.floor((H - 2 * margin) * pxPerMm);
  for (let y = 0, page = 0; y < canvas.height; y += pageH, page++) {
    const h = Math.min(pageH, canvas.height - y), part = document.createElement('canvas'); part.width = canvas.width; part.height = h;
    part.getContext('2d')!.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
    if (page) pdf.addPage();
    pdf.addImage(part.toDataURL('image/jpeg', 0.9), 'JPEG', margin, margin, w, h / pxPerMm);
  }
  const blob = pdf.output('blob'), base64 = pdf.output('datauristring').split(',')[1];
  return { base64, blob };
}
