// pdfjs-dist is heavy, so it is imported lazily — only when a user actually
// uploads a PDF — which also keeps it out of the main bundle.
let pdfjsPromise = null;

async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((mod) => {
      const api = mod.default || mod;
      if (api.GlobalWorkerOptions) {
        api.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs`;
      }
      return api;
    });
  }
  return pdfjsPromise;
}

export async function extractTextFromPdf(file) {
  try {
    const api = await loadPdfjs();
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = api.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(' ');
      fullText += pageText + ' ';
    }
    return fullText;
  } catch (e) {
    console.error(e);
    throw new Error(`Failed to parse PDF: ${e.message}`);
  }
}

export function formatFileSize(bytes) {
  if (bytes === 0) return 'N/A';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
