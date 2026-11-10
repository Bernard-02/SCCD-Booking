/** 把 A4 白底元素擷取成 PDF，一個元素一頁。jspdf／html2canvas 用到才動態載入，不進初始 bundle */
export async function elementsToPdf(els: HTMLElement[]) {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  for (let i = 0; i < els.length; i++) {
    // 關掉 Chrome 的全形標點擠壓：html2canvas 照擠壓後的位置畫完整字形，「】（請」的括號會疊到下一個字
    els[i].style.setProperty('text-spacing-trim', 'space-all')
    const canvas = await html2canvas(els[i], {
      scale: 2, // 約 192 DPI，純文字白底已足夠清晰
      useCORS: true,
      backgroundColor: '#ffffff'
    } as Parameters<typeof html2canvas>[1])
    if (i > 0) pdf.addPage()
    const h = (canvas.height * pageW) / canvas.width
    const fit = Math.min(1, pageH / h) // 內容超過一頁時整頁等比縮小，不裁切
    // JPEG（白底不需透明）+ compress：檔案由數十 MB 降到約 1MB
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, pageW * fit, h * fit)
  }
  return pdf
}
