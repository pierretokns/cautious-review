import test from 'node:test';import assert from 'node:assert/strict';
import {passages,cosine,MODEL} from '../dist/semantic.js';
test('semantic chunks preserve exact source offsets including unicode',()=>{const text='Résumé 👩🏽‍💻 built Kubernetes. '.repeat(100);const chunks=passages(text);assert.ok(chunks.length>1);for(const c of chunks)assert.equal(c.quote,text.slice(c.start,c.end));assert.equal(chunks.at(-1).end,text.length);});
test('cosine returns deterministic normalized similarity',()=>{assert.equal(cosine([1,0],[1,0]),1);assert.equal(cosine([1,0],[0,1]),0);assert.equal(cosine([0,0],[0,0]),0);assert.throws(()=>cosine([1],[1,2]));});
test('embedding model is pinned to immutable revision and quantization',()=>assert.equal(MODEL,'Xenova/all-MiniLM-L6-v2@751bff37182d3f1213fa05d7196b954e230abad9:q8'));
