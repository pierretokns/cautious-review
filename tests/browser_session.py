"""Synthetic session diagnostics only. No real Greenhouse requests or account."""
import json, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
checks, calls, errors, unexpected = [], [], [], []
HTML = '''<!doctype html><html><body><h1>Synthetic review</h1>
<button id="fetch">Read application</button><button id="xhr">Read attachment</button>
<script>
window.originalFetch=window.fetch;window.originalXhrSend=XMLHttpRequest.prototype.send;
document.querySelector('#fetch').onclick=async()=>{
 const r=await fetch('/api/applications/987654321?candidate_id=123456789&token=secret-query',{
  method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer secret-header'},
  body:JSON.stringify({candidate_id:123456789,name:'private-applicant',resume_text:'private-resume',token:'secret-body'})});
 window.lastResponse=await r.json();
};
document.querySelector('#xhr').onclick=()=>{
 const x=new XMLHttpRequest();x.open('GET','/api/attachments/111222333');
 x.onload=()=>{window.xhrResult=JSON.parse(x.responseText)};x.send();
};
</script></body></html>'''

def check(value, label):
 assert value, label
 checks.append(label)

with sync_playwright() as p, tempfile.TemporaryDirectory() as profile:
 ctx=p.chromium.launch_persistent_context(profile,channel='chromium',headless=True,
  accept_downloads=True,viewport={'width':1400,'height':1200},
  args=[f'--disable-extensions-except={ROOT / "dist"}',f'--load-extension={ROOT / "dist"}','--no-sandbox'])
 def route(r):
  u=r.request.url
  if u.startswith('https://app.greenhouse.io/api/'):
   calls.append(r.request.method)
   r.fulfill(status=200,content_type='application/json',body=json.dumps({
    'application':{'id':987654321,'candidate_id':123456789,'name':'private-applicant','resume_text':'private-resume'},
    'access_token':'secret-response','url':'https://private.invalid/secret-url'}));return
  if u.startswith('https://app.greenhouse.io/applications/review/'):
   r.fulfill(status=200,content_type='text/html',body=HTML);return
  if u.startswith('chrome-extension://'):r.continue_();return
  unexpected.append(u);r.abort()
 ctx.route('**/*',route)
 page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('https://app.greenhouse.io/applications/review/99')
 panel=page.locator('#cautious-review')
 panel.locator('#session-diagnostics summary').click()
 page.locator('#fetch').click()
 page.wait_for_function('window.lastResponse?.application?.id===987654321')
 check(panel.locator('#session-export').is_disabled(),'No recording before explicit start')
 check(len(calls)==1,'Diagnostics did not initiate requests')
 page.evaluate("window.postMessage({channel:'cautious-review-session-diagnostics',command:'start'},location.origin)")
 page.wait_for_timeout(100)
 check(page.evaluate('window.fetch===window.originalFetch'),'Page-forged start cannot activate recording')
 check(page.evaluate('window.fetch===window.originalFetch && XMLHttpRequest.prototype.send===window.originalXhrSend'),'Network methods remain untouched while off')
 panel.locator('#session-start').click()
 page.locator('#fetch').click()
 page.wait_for_function("document.querySelector('#cautious-review').shadowRoot.querySelector('#session-status').textContent.includes('1 sanitized')")
 page.evaluate('()=>{window.cachedActiveFetch=window.fetch;window.cachedActiveOpen=XMLHttpRequest.prototype.open;window.cachedActiveSend=XMLHttpRequest.prototype.send;}')
 page.locator('#xhr').click()
 page.wait_for_function("document.querySelector('#cautious-review').shadowRoot.querySelector('#session-status').textContent.includes('2 sanitized')")
 check(page.evaluate('window.lastResponse.application.id')==987654321,'Fetch response remains unchanged')
 check(page.evaluate('window.xhrResult.application.id')==987654321,'XHR response remains unchanged')
 check(len(calls)==3,'Only user-triggered synthetic requests occurred')
 panel.locator('#session-stop').click()
 page.wait_for_function('window.fetch===window.originalFetch && XMLHttpRequest.prototype.send===window.originalXhrSend')
 check(True,'Stop restores original network methods')
 check(page.evaluate("async()=>{const r=await window.cachedActiveFetch('/api/applications/987654321');return (await r.json()).application.id===987654321}"),'Cached fetch wrapper still works after stop')
 check(page.evaluate("()=>new Promise(resolve=>{const x=new XMLHttpRequest();window.cachedActiveOpen.call(x,'GET','/api/attachments/111222333');x.onload=()=>resolve(JSON.parse(x.responseText).application.id===987654321);window.cachedActiveSend.call(x)})"),'Cached XHR wrappers still work after stop')
 page.locator('#fetch').click();page.wait_for_function('window.lastResponse?.application?.id===987654321')
 check('2 sanitized' in panel.locator('#session-status').inner_text(),'Stopping prevents new observations')
 with page.expect_download() as download:
  panel.locator('#session-export').click()
 data=Path(download.value.path()).read_text();report=json.loads(data)
 check(len(report['observations'])==2,'Local export contains fetch and XHR schemas')
 for private in ['987654321','123456789','111222333','private-applicant','private-resume','secret-query','secret-header','secret-body','secret-response','secret-url']:
  check(private not in data,'Export excludes '+private)
 check(all(o['status']==200 for o in report['observations']),'Response status preserved')
 check('/api/applications/' in data,'Structural endpoint template retained')
 # A hostile page must not smuggle free-form strings through the isolated UI.
 panel.locator('#session-start').click()
 page.evaluate("window.postMessage({channel:'cautious-review-session-diagnostics',kind:'observation',observation:{method:'GET',pathTemplate:'/private-applicant',queryKeys:['private-applicant'],requestSchema:{types:['private-resume']},responseSchema:{types:['secret-response']}}},location.origin)")
 page.wait_for_timeout(100)
 check(panel.locator('#session-export').is_disabled(),'Forged unsafe bridge observation rejected')
 panel.locator('#session-clear').click()
 check(panel.locator('#session-export').is_disabled(),'Clear removes in-memory diagnostics')
 panel.locator('#session-start').click()
 page.evaluate("async()=>{for(let i=0;i<110;i++)await fetch('/api/applications/987654321')}")
 page.wait_for_function("document.querySelector('#cautious-review').shadowRoot.querySelector('#session-status').textContent.includes('100 sanitized')")
 check(panel.locator('#session-start').is_enabled(),'Observation cap stops recording automatically')
 check(page.evaluate('window.fetch===window.originalFetch'),'Observation cap restores network methods')
 panel.locator('#session-clear').click()
 page.clock.install()
 panel.locator('#session-start').click()
 page.wait_for_function('window.fetch!==window.originalFetch')
 page.clock.fast_forward(600001)
 page.wait_for_function("document.querySelector('#cautious-review').shadowRoot.querySelector('#session-start').disabled===false")
 check(page.evaluate('window.fetch===window.originalFetch'),'Ten-minute cap stops and restores network methods')
 check(not errors,'No renderer errors: '+str(errors))
 check(not unexpected,'No unexpected network requests: '+str(unexpected))
 ctx.close()
print(json.dumps({'status':'passed','checks':len(checks),'assertions':checks,'validation':'Synthetic only; no real Greenhouse session or endpoint validation'},indent=2))
