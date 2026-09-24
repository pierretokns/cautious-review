"""Synthetic Harvest fixtures ONLY. Never uses credentials or calls real Greenhouse."""
import json, tempfile, shutil, os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
TOKEN='eyJhbGciOiJub25lIn0.eyJzdWIiOiI1MSIsImV4cCI6MjAwMDAwMDAwMH0.signature'
checks=[];calls=[];unexpected=[];errors=[]
def check(value,label):
 assert value,label
 checks.append(label)
def pdf_bytes():
 text='BT /F1 12 Tf 50 750 Td (Built Kubernetes services and Python evaluation pipelines.) Tj ET'
 objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',f'<< /Length {len(text)} >>\nstream\n{text}\nendstream']
 body=b'%PDF-1.4\n';offsets=[0]
 for i,obj in enumerate(objects,1):
  offsets.append(len(body));body+=f'{i} 0 obj\n{obj}\nendobj\n'.encode()
 start=len(body);body+=f'xref\n0 6\n0000000000 65535 f \n'.encode()
 for offset in offsets[1:]:body+=f'{offset:010} 00000 n \n'.encode()
 body+=f'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{start}\n%%EOF'.encode();return body
app={'id':11,'candidate_id':21,'job_id':31,'stage_id':71,'prospect':False,'status':'active','last_activity_at':'2026-09-24T12:00:00Z','rejected_at':None}
stage_rows=[{'id':71,'application_id':11,'job_interview_stage_id':41,'current':True,'exited_at':None,'entered_at':'2026-09-24T12:00:00Z'}]
rejection_detail=None
unknown=False
with sync_playwright() as p,tempfile.TemporaryDirectory() as profile:
 ctx=p.chromium.launch_persistent_context(profile,channel='chromium',headless=True,viewport={'width':1400,'height':1100},args=[f'--disable-extensions-except={ROOT / "dist"}',f'--load-extension={ROOT / "dist"}','--no-sandbox'])
 def route(r):
  global unknown,rejection_detail
  u=r.request.url
  if u.startswith('https://harvest.greenhouse.io/v3/'):
   path=u.split('/v3/')[1].split('?')[0];calls.append((r.request.method,path,r.request.headers,r.request.post_data))
   if r.request.method=='POST':
    if unknown:r.abort();return
    if path.endswith('/reject'):
     app['status']='rejected';app['rejected_at']='2026-09-24T13:00:00Z'
     rejection_detail={'id':91,'application_id':11,'rejection_reason_id':json.loads(r.request.post_data)['rejection_reason_id'],'rejected_at':app['rejected_at'],'rejected_by_id':51,'question_custom_fields':[]}
    elif path.endswith('/unreject'):
     app['status']='active';app['rejected_at']=None;rejection_detail=None
    elif path.endswith('/move'):
     target=json.loads(r.request.post_data).get('to_stage_id',42)
     for row in stage_rows:row['current']=False;row['exited_at']='2026-09-24T13:00:00Z'
     stage_rows.append({'id':72,'application_id':11,'job_interview_stage_id':target,'current':True,'exited_at':None,'entered_at':'2026-09-24T13:00:00Z'})
     app['stage_id']=72
    app['last_activity_at']='2026-09-24T13:00:00Z';r.fulfill(status=204,body='');return
   elif path=='users':data=[{'id':51,'name':'Synthetic Reviewer','deactivated':False}]
   elif path=='jobs':data=[{'id':31,'name':'Engineering'}]
   elif path=='job_interview_stages':data=[{'id':41,'job_id':31,'name':'Application Review','sort_order':0,'active':True},{'id':42,'job_id':31,'name':'Screen','sort_order':1,'active':True}]
   elif path=='applications':data=[{**app,'updated_at':app['last_activity_at']}]
   elif path=='application_stages':data=[row.copy() for row in stage_rows if row['current']]
   elif path=='rejection_details':data=[rejection_detail] if rejection_detail else []
   elif path=='rejection_reasons':data=[{'id':61,'name':'Required skills not demonstrated'}]
   elif path=='candidates':data=[{'id':21,'first_name':'Synthetic','last_name':'Candidate'}]
   elif path=='attachments':data=[{'id':81,'application_id':11,'candidate_id':21,'type':'resume','filename':'resume.pdf','url':'https://grnhse-dochouse-prod.s3.amazonaws.com/test.pdf'}]
   else:raise AssertionError(path)
   r.fulfill(status=200,content_type='application/json',body=json.dumps(data));return
  if u=='https://grnhse-dochouse-prod.s3.amazonaws.com/test.pdf':
   check('authorization' not in r.request.headers,'Attachment receives no Harvest credential');r.fulfill(status=200,content_type='application/pdf',body=pdf_bytes());return
  if u.startswith('https://app.greenhouse.io/'):
   body='<html><body><h1>Application Review fixture</h1>'
   if 'owned-form' in u:body+='<form action="/applications/11/reject"><input type="hidden" name="candidate_id" value="21"><input type="hidden" name="job_id" value="31"></form>'
   if 'conflict-form' in u:body+='<form action="/applications/12/reject"></form>'
   r.fulfill(status=200,content_type='text/html',body=body+'</body></html>');return
  if u.startswith('chrome-extension://'):r.continue_();return
  unexpected.append(u);r.abort()
 ctx.route('**/*',route)
 worker=ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event('serviceworker')
 ext=worker.url.split('/')[2]
 page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(f'chrome-extension://{ext}/live.html?source=https%3A%2F%2Fapp.greenhouse.io%2Fapplications%2Freview%2F999%3Fapplication_id%3D11%26candidate_id%3D21')
 def status(text):
  try:page.wait_for_function('s=>document.querySelector("#status").textContent.includes(s)',arg=text,timeout=30000)
  except Exception:
   print('STATUS:',page.locator('#status').inner_text(),'ERRORS:',errors,'CALLS:',[(c[0],c[1]) for c in calls],flush=True);raise
 page.locator('#key').fill(TOKEN);page.locator('#actor').fill('51');page.locator('#connect').click();status('Résumé indexed locally')
 check('Kubernetes' in page.locator('#resume').input_value(),'Automatic PDF retrieval and local extraction')
 check(page.locator('#key').input_value()=='','Credential removed from form')
 check('candidate 21, application 11, job 31, stage 41' in page.locator('#identity').inner_text(),'Harvest verifies full review-route identity')
 page.locator('#criteria').fill('Kubernetes\nRust');page.locator('#analyze').click();status('Source evidence shown')
 check('Not established in this text' in page.locator('#evidence').inner_text(),'Missing evidence stays not established')
 page.locator('#query').fill('container infrastructure');page.locator('#semantic').click();status('Local hybrid retrieval complete')
 check('Kubernetes' in page.locator('#search-results').inner_text(),'Real bundled WASM model retrieves source passage offline')
 check('751bff' in page.locator('#search-results').inner_text(),'Model revision displayed')
 page.locator('#queue').click();status('Decision queued');page.locator('#preview').click();status('Review this exact plan')
 check(not [c for c in calls if c[0]=='POST'],'Preview cannot mutate Greenhouse')
 page.locator('#execute').click();status('Review the plan and type its exact count')
 check(not [c for c in calls if c[0]=='POST'],'Missing explicit confirmation causes zero writes')
 page.locator('#reviewed').check();page.locator('#count').fill('1');page.locator('#execute').click();status('Execution finished')
 writes=[c for c in calls if c[0]=='POST'];check(len(writes)==1 and writes[0][1]=='applications/11/reject','Human-confirmed reject uses supported endpoint')
 check(writes[0][2].get('authorization')=='Bearer '+TOKEN and 'on-behalf-of' not in writes[0][2],'OAuth bearer attribution replaces legacy On-Behalf-Of')
 check(json.loads(writes[0][3])=={'rejection_reason_id':61},'No unreviewed email or request fields')
 check('"status": "succeeded"' in page.locator('#receipts').text_content(),'Durable success receipt displayed: '+page.locator('#receipts').text_content())
 page.locator('#action').select_option('unreject');page.locator('#queue').click();status('Decision queued');page.locator('#preview').click();status('Review this exact plan');page.locator('#reviewed').check();page.locator('#count').fill('1');page.locator('#execute').click();status('Execution finished')
 check(app['status']=='active','Explicit unreject reverses status')
 page.locator('#action').select_option('advance');page.locator('#queue').click();status('Decision queued');page.locator('#preview').click();status('Review this exact plan')
 app['last_activity_at']='2026-09-24T13:30:00Z';page.locator('#reviewed').check();page.locator('#count').fill('1');page.locator('#execute').click();status('Execution finished')
 check(len([c for c in calls if c[0]=='POST'])==2,'Stale preview prevented advance')
 page.locator('#action').select_option('move');page.locator('#stage').select_option('42');page.locator('#queue').click();status('Decision queued');page.locator('#preview').click();status('Review this exact plan');page.locator('#reviewed').check();page.locator('#count').fill('1');unknown=True;page.locator('#execute').click();status('Execution finished')
 move_write=[c for c in calls if c[0]=='POST'][-1];check(move_write[1]=='applications/11/move' and json.loads(move_write[3])=={'from_stage_id':41,'to_stage_id':42},'V3 move sends guarded current interview stage and explicit destination')
 check('"status": "unknown"' in page.locator('#receipts').text_content(),'Lost response recorded unknown')
 before=len([c for c in calls if c[0]=='POST']);page.locator('#queue').click();status('Decision queued');page.locator('#preview').click();status('Review this exact plan');page.locator('#reviewed').check();page.locator('#count').fill('1');page.locator('#execute').click();status('Execution finished')
 check(len([c for c in calls if c[0]=='POST'])==before,'Unknown intent prevents retry')
 page.screenshot(path=str(ROOT/'artifacts/live-preview.png'),full_page=True)
 review=ctx.new_page();review.goto('https://app.greenhouse.io/applications/review/999');panel=review.locator('#cautious-review');panel.get_by_role('button',name='Open Live Review & résumé retrieval').wait_for();check(panel.is_visible(),'Ambiguous review route exposes usable Live Review entry')
 review.goto('https://app.greenhouse.io/applications/review/owned-form')
 with ctx.expect_page() as opened:review.locator('#cautious-review').get_by_role('button',name='Open Live Review & résumé retrieval').click()
 launched=opened.value;launched.wait_for_load_state();check('application_id%3D11' in launched.url,'Owned action form resolves review identity into Live Review')
 review.goto('https://app.greenhouse.io/applications/review/owned-form-conflict-form')
 review.locator('#cautious-review').get_by_role('button',name='Open Live Review & résumé retrieval').click()
 review.wait_for_function("()=>document.querySelector('#cautious-review').shadowRoot.querySelector('#status').textContent.includes('Ambiguous')")
 check(True,'Conflicting owned forms fail closed visibly')
 check(not unexpected,'No external inference or unexpected network: '+str(unexpected))
 check(not errors,'No renderer errors: '+str(errors))
 print(json.dumps({'status':'passed','checks':len(checks),'assertions':checks,'chromium_version':ctx.browser.version if ctx.browser else 'unknown','network':'Synthetic interception only; no real Greenhouse end-to-end validation'},indent=2))
 ctx.close()
