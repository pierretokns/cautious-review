// PDF.js (Apache-2.0) is bundled locally; no worker, font, CMap or model CDN.
export async function extractDocument(bytes:Uint8Array,filename:string):Promise<{text:string;pages:number;tinyText:number}> {
 if(bytes.length>20_000_000)throw Error('File exceeds 20 MB');
 if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-') {
  if(!/\.txt$/i.test(filename))throw Error('Use a PDF or UTF-8 text file. Scanned PDFs require local OCR outside this preview.');
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(text.length>200000)throw Error('Text exceeds 200,000 characters');return {text,pages:1,tinyText:0};
 }
 // @ts-ignore bundled during build
 const pdfjs=await import('./vendor/pdf.mjs');
 pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf.worker.mjs',import.meta.url).href;
 const task=pdfjs.getDocument({data:bytes,isEvalSupported:false,useSystemFonts:true,disableFontFace:true,stopAtErrors:true,useWorkerFetch:false});
 let text='',tinyText=0;
 try{const doc=await task.promise;if(doc.numPages>100)throw Error('PDF exceeds 100 pages');
 for(let i=1;i<=doc.numPages;i++){const page=await doc.getPage(i);const content=await page.getTextContent();for(const item of content.items){if(!('str'in item))continue;text+=item.str+(item.hasEOL?'\n':' ');if(item.str.trim()&&Math.abs(item.height)<8)tinyText++;if(text.length>200000)throw Error('PDF text exceeds 200,000 characters');}text+='\n';page.cleanup();}
 if(text.trim().length<10)throw Error('No extractable text; scanned PDF needs local OCR or pasted text');return {text,pages:doc.numPages,tinyText};
 }finally{await task.destroy();}
}
