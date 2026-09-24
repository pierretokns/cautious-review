"""Synthetic browser-session read contract; never contacts a real Greenhouse account."""
import json, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
checks=[];calls=[];errors=[];unexpected=[]
def check(value,label):
 assert value,label
 checks.append(label)
def pdf():
 text='BT /F1 12 Tf 50 750 Td (Built Kubernetes services and Python evaluation pipelines.) Tj ET'
 objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',f'<< /Length {len(text)} >>\nstream\n{text}\nendstream']
 body=b'%PDF-1.4\n';offsets=[0]
 for i,obj in enumerate(objects,1):
  offsets.append(len(body));body+=f'{i} 0 obj\n{obj}\nendobj\n'.encode()
 start=len(body);body+=b'xref\n0 6\n0000000000 65535 f \n'
 for offset in offsets[1:]:body+=f'{offset:010} 00000 n \n'.encode()
 return body+f'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{start}\n%%EOF'.encode()
with sync_playwright() as p,tempfile.TemporaryDirectory() as profile:
 ctx=p.chromium.launch_persistent_context(profile,channel='chromium',headless=True,viewport={'width':1400,'height':1100},args=[f'--disable-extensions-except={ROOT / "dist"}',f'--load-extension={ROOT / "dist"}','--no-sandbox'])
 mode='normal'
 def route(r):
  u=r.request.url
  if u.startswith('https://app.greenhouse.io/attachment_previews/'):
   calls.append((r.request.method,u))
   source='https://grnhse-dochouse-prod.s3.amazonaws.com/synthetic.pdf?signature=synthetic-secret'
   if mode=='foreign':source='https://evil.invalid/private.pdf'
   if mode=='stale':page.evaluate("history.replaceState({},'', '/people/22/applications/12/redesign')")
   from urllib.parse import quote
   r.fulfill(status=200,content_type='application/json',body=json.dumps({'source':'https://app.greenhouse.io/viewer?document_url='+quote(source,safe='')}));return
  if u.startswith('https://grnhse-dochouse-prod.s3.amazonaws.com/synthetic.pdf'):
   calls.append((r.request.method,'approved-storage'))
   check('authorization' not in r.request.headers and 'cookie' not in r.request.headers,'Document download has no session or Harvest credentials')
   r.fulfill(status=200,content_type='application/pdf',body=pdf());return
  if u.startswith('https://app.greenhouse.io/people/'):
   extra='<a href="/attachments/82">Resume</a>' if 'ambiguous' in u else ''
   r.fulfill(status=200,content_type='text/html',body=f'<html><body><h1>Synthetic candidate</h1><a href="/attachments/81">View Resume</a>{extra}</body></html>');return
  if u.startswith('chrome-extension://'):r.continue_();return
  unexpected.append(u);r.abort()
 ctx.route('**/*',route)
 page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 source='https://app.greenhouse.io/people/21/applications/11/redesign'
 page.goto(source)
 panel=page.locator('#cautious-review');panel.locator('#session-read-resume').wait_for()
 check(not calls,'No session reads before explicit click')
 page.evaluate("document.querySelector('#cautious-review').shadowRoot.querySelector('#session-read-resume').click()")
 check(not calls,'Page script cannot trigger session read')
 with ctx.expect_page() as opened:panel.locator('#session-read-resume').click()
 reader=opened.value;reader.on('pageerror',lambda e:errors.append(str(e)));reader.wait_for_load_state()
 check('synthetic-secret' not in reader.url,'Signed document URL stays out of reader address')
 reader.locator('#load').click()
 reader.wait_for_function("()=>document.querySelector('#status').textContent.includes('Résumé text extracted locally')")
 check('Kubernetes' in reader.locator('#resume-text').inner_text(),'Session preview retrieves and locally extracts real PDF fixture without Harvest')
 check('candidate 21, application 11' in reader.locator('#identity').inner_text(),'Candidate/application identity displayed separately from unknown job/stage')
 reader.locator('#criteria').fill('Kubernetes\nRust');reader.locator('#analyze').click()
 check('Not established in this text' in reader.locator('#evidence').inner_text(),'No-admin reader keeps missing evidence unknown')
 reader.locator('#query').fill('container infrastructure');reader.locator('#search').click()
 reader.wait_for_function("()=>document.querySelector('#status').textContent.includes('Local hybrid retrieval complete')",timeout=60000)
 check('Kubernetes' in reader.locator('#search-results').inner_text(),'No-admin reader runs bundled local semantic search')
 check(all(method=='GET' for method,_ in calls),'Session reader issued only GET requests')
 check(not any('harvest' in url for _,url in calls),'Reader needed no Harvest request or credential')
 reader.reload();reader.locator('#load').click()
 reader.wait_for_function("()=>document.querySelector('#status').textContent.includes('Could not read')")
 check(True,'Reader handoff cannot be replayed')
 before=len(calls);page.goto(source+'?ambiguous=1');panel.locator('#session-read-resume').click()
 page.wait_for_function("document.querySelector('#cautious-review').shadowRoot.querySelector('#session-read-status').textContent.includes('No unique')")
 check(len(calls)==before,'Multiple résumé links fail closed without request')
 mode='foreign';page.goto(source);panel.locator('#session-read-resume').click()
 page.wait_for_function("document.querySelector('#cautious-review').shadowRoot.querySelector('#session-read-status').textContent.includes('Could not read')")
 check(not unexpected,'Foreign attachment URL rejected before network')
 mode='stale';page.goto(source);panel.locator('#session-read-resume').click()
 page.wait_for_function("document.querySelector('#cautious-review').shadowRoot.querySelector('#session-read-status').textContent.includes('changed while loading')")
 check(True,'Navigation change while preview loads fails closed')
 check(not errors,'No renderer errors: '+str(errors))
 check(not unexpected,'No unexpected network: '+str(unexpected))
 ctx.close()
print(json.dumps({'status':'passed','checks':len(checks),'assertions':checks,'validation':'Public-source-derived synthetic contract only; no real-account validation'},indent=2))
