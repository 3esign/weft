import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { freshReportPath, membranePathSha256, validateMembraneGeometry } from '../membrane_contract.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'weft-limit16-'));
try{
  const geo={
    summary:{name:'typed-path-regression',tileCount:1,N:2,H:0.4,
      args:{lh:0.2,bead:0.42,firstLayerBead:0.48,firstLayerSpeed:12,w:3,e:0.7,
        r0:9,K:14,foundation:1.3,temp:220,bed:60,maxbridge:16.2,maxcantilever:4.8}},
    foundation:{paths:[[[-10,0],[10,0]]]},
    layers:[
      {k:0,zBot:0,zTop:0.2,contours:[],paths:[{tile:1,row:0,col:0,role:'support',pts:[[0,-5],[0,5]]}]},
      {k:1,zBot:0.2,zTop:0.4,contours:[],paths:[{tile:1,row:0,col:0,role:'bridge',
        pts:[[-2,0],[-1.5,0],[-1,0],[-0.5,0],[0,0],[0.5,0],[1,0],[1.5,0],[2,0]]}]}
    ]
  };
  const geoPath=path.join(TMP,'geometry.json');
  fs.writeFileSync(geoPath,JSON.stringify(geo));
  const run=spawnSync(process.execPath,[path.join(ROOT,'make_suma.mjs'),'--geo',geoPath,'--out',TMP,
    '--name','typed_path','--machine','ender','--dry'],{cwd:ROOT,encoding:'utf8',env:process.env});
  assert.equal(run.status,0,run.stderr||run.stdout);
  const built=JSON.parse(fs.readFileSync(path.join(TMP,'typed_path_report.json'),'utf8')).report;
  assert.equal(built.machine,'Creality Ender-3 V4');
  assert.deepEqual(built.bed_mm,[220,220]);
  assert.equal(built.globalZLevels,2);
  assert.equal(built.expectedZLevels,2);
  assert.equal(built.logicalCells,1);
  assert.equal(built.rawPaths,2);
  assert.equal(built.fitsPlate,true);

  const sparse=structuredClone(geo);
  sparse.summary.name='sparse-bridge-must-refuse';
  sparse.layers[1].paths[0].pts=[[-2,0],[2,0]];
  const sparsePath=path.join(TMP,'sparse.json');
  fs.writeFileSync(sparsePath,JSON.stringify(sparse));
  const refused=spawnSync(process.execPath,[path.join(ROOT,'make_suma.mjs'),'--geo',sparsePath,'--out',TMP,
    '--name','sparse','--machine','ender','--dry'],{cwd:ROOT,encoding:'utf8',env:process.env});
  assert.notEqual(refused.status,0,'two-point bridge incorrectly passed the final-artifact sampling contract');
  assert.match(refused.stderr+refused.stdout,/typed bridge.*sampled every 4\.00 mm/s);

  const capBase=structuredClone(geo);
  capBase.summary.name='membrane-contract-regression';
  capBase.layers[1].caps=[{tile:1,span_mm:4,pts:[[2,0],[0,2],[-2,0],[0,-2],[2,0],[1.5,0],[0,0]]}];
  const capPath=path.join(TMP,'cap.json');
  assert.throws(()=>validateMembraneGeometry(capBase,{rootDir:ROOT}),/membrane contract missing/);

  const missingOut=path.join(TMP,'missing-out');
  fs.writeFileSync(capPath,JSON.stringify(capBase));
  const missing=spawnSync(process.execPath,[path.join(ROOT,'make_suma.mjs'),'--geo',capPath,'--out',missingOut,
    '--name','cap_missing','--machine','ender','--dry'],{cwd:ROOT,encoding:'utf8',env:process.env});
  assert.notEqual(missing.status,0,'cap without a physical process contract was accepted');
  assert.match(missing.stderr+missing.stdout,/membrane contract missing/);
  assert.equal(fs.existsSync(missingOut),false,'membrane preflight created an output directory');

  const processName='single-layer-inward-spiral/test-fixture-v1';
  capBase.layers[1].caps[0].process=processName;
  capBase.layers[1].caps[0].physicalStatus='experimental';
  capBase.layers[1].caps[0].evidence=null;
  assert.throws(()=>validateMembraneGeometry(capBase,{rootDir:ROOT}),/requires --allow-experimental-membrane/);
  assert.doesNotThrow(()=>validateMembraneGeometry(capBase,{rootDir:ROOT,allowExperimental:true}));
  fs.writeFileSync(capPath,JSON.stringify(capBase));
  const noOptInOut=path.join(TMP,'no-opt-in-out');
  const noOptIn=spawnSync(process.execPath,[path.join(ROOT,'make_suma.mjs'),'--geo',capPath,'--out',noOptInOut,
    '--name','cap_no_optin','--machine','ender','--dry'],{cwd:ROOT,encoding:'utf8',env:process.env});
  assert.notEqual(noOptIn.status,0,'experimental membrane was accepted without explicit operator opt-in');
  assert.match(noOptIn.stderr+noOptIn.stdout,/requires --allow-experimental-membrane/);
  assert.equal(fs.existsSync(noOptInOut),false,'experimental refusal created an output directory');

  capBase.layers[1].caps[0].physicalStatus='failed';
  capBase.layers[1].caps[0].evidence='specimens/2026-09-03_MERA_A2L_4x4_v1_physical/outcomes.md';
  assert.throws(
    ()=>validateMembraneGeometry(capBase,{rootDir:ROOT,allowExperimental:true}),
    /physically failed/,
    'failed membrane was overridden by the experimental flag');
  fs.writeFileSync(capPath,JSON.stringify(capBase));
  const climberFailedOut=path.join(TMP,'climber-failed-out');
  const climberFailed=spawnSync(process.execPath,[path.join(ROOT,'make_climber.mjs'),'--geo',capPath,
    '--out',climberFailedOut,'--name','climber_failed','--machine','ender','--dry',
    '--allow-experimental-membrane'],{cwd:TMP,encoding:'utf8',env:process.env});
  assert.notEqual(climberFailed.status,0,'make_climber bypassed a physically failed cap');
  assert.match(climberFailed.stderr+climberFailed.stdout,/physically failed/);
  assert.equal(fs.existsSync(climberFailedOut),false,'climber preflight created an output directory');

  capBase.layers[1].caps[0].physicalStatus='qualified';
  delete capBase.layers[1].caps[0].evidence;
  assert.throws(()=>validateMembraneGeometry(capBase,{rootDir:ROOT,machine:'ender'}),/no evidence receipt/);
  capBase.layers[1].caps[0].evidence='does-not-exist.json';
  assert.throws(()=>validateMembraneGeometry(capBase,{rootDir:ROOT,machine:'ender'}),/not an existing regular file/);
  capBase.layers[1].caps[0].evidence='specimens';
  assert.throws(()=>validateMembraneGeometry(capBase,{rootDir:ROOT,machine:'ender'}),/not an existing regular file/);
  const outsideReceipt=path.join(TMP,'outside-receipt.md');
  fs.writeFileSync(outsideReceipt,'not repository evidence');
  capBase.layers[1].caps[0].evidence=outsideReceipt;
  assert.throws(()=>validateMembraneGeometry(capBase,{rootDir:ROOT,machine:'ender'}),/must stay inside WEFT root/);

  const qualifiedArtifact=path.join(TMP,'qualified-artifact.gcode');
  const qualifiedPhotos=path.join(TMP,'qualified-photos.json');
  const qualifiedReceipt=path.join(TMP,'qualified-receipt.json');
  fs.writeFileSync(qualifiedArtifact,'synthetic artifact used only by the regression fixture');
  fs.writeFileSync(qualifiedPhotos,JSON.stringify({schema:'test-only-photo-manifest'}));
  const receipt={
    schema:'weft.membrane-qualification.v1',
    decision:'qualified',
    observed:'pass',
    process:processName,
    span_mm:4,
    path_sha256:membranePathSha256(capBase.layers[1].caps[0].pts),
    machine:'ender',
    bead_mm:0.42,
    layer_height_mm:0.2,
    artifact:'qualified-artifact.gcode',
    artifact_sha256:createHash('sha256').update(fs.readFileSync(qualifiedArtifact)).digest('hex'),
    photos_manifest:'qualified-photos.json'
  };
  fs.writeFileSync(qualifiedReceipt,JSON.stringify(receipt));
  capBase.layers[1].caps[0].evidence='qualified-receipt.json';
  assert.doesNotThrow(()=>validateMembraneGeometry(capBase,{rootDir:TMP,machine:'ender'}));
  receipt.process='unrelated-process';
  fs.writeFileSync(qualifiedReceipt,JSON.stringify(receipt));
  assert.throws(
    ()=>validateMembraneGeometry(capBase,{rootDir:TMP,machine:'ender'}),
    /does not bind this cap: process/);
  receipt.process=processName;
  receipt.artifact_sha256='0'.repeat(64);
  fs.writeFileSync(qualifiedReceipt,JSON.stringify(receipt));
  assert.throws(
    ()=>validateMembraneGeometry(capBase,{rootDir:TMP,machine:'ender'}),
    /artifact hash mismatch/);

  const capAsPath=structuredClone(geo);
  capAsPath.layers[1].paths[0].role='cap';
  assert.throws(()=>validateMembraneGeometry(capAsPath,{rootDir:ROOT}),/must use layer\.caps/);
  const rawCapPath=path.join(TMP,'raw-cap.json');
  const rawCapOut=path.join(TMP,'raw-cap-out');
  fs.writeFileSync(rawCapPath,JSON.stringify(capAsPath));
  const rawCap=spawnSync(process.execPath,[path.join(ROOT,'make_suma.mjs'),'--geo',rawCapPath,
    '--out',rawCapOut,'--name','raw_cap','--machine','ender','--dry'],
    {cwd:TMP,encoding:'utf8',env:process.env});
  assert.notEqual(rawCap.status,0,'lay.paths role=cap bypassed the membrane contract');
  assert.match(rawCap.stderr+rawCap.stdout,/must use layer\.caps/);
  assert.equal(fs.existsSync(rawCapOut),false,'raw-cap refusal created an output directory');

  const capAsContour=structuredClone(geo);
  capAsContour.layers[1].contours=[{role:'cap'}];
  assert.throws(()=>validateMembraneGeometry(capAsContour,{rootDir:ROOT}),/must use layer\.caps/);
  const contourCapPath=path.join(TMP,'contour-cap.json');
  const contourCapOut=path.join(TMP,'contour-cap-out');
  fs.writeFileSync(contourCapPath,JSON.stringify(capAsContour));
  const contourCap=spawnSync(process.execPath,[path.join(ROOT,'make_suma.mjs'),'--geo',contourCapPath,
    '--out',contourCapOut,'--name','contour_cap','--machine','ender','--dry'],
    {cwd:TMP,encoding:'utf8',env:process.env});
  assert.notEqual(contourCap.status,0,'contours role=cap bypassed the membrane contract');
  assert.match(contourCap.stderr+contourCap.stdout,/must use layer\.caps/);
  assert.equal(fs.existsSync(contourCapOut),false,'contour-cap refusal created an output directory');

  capBase.layers[1].caps[0].physicalStatus='experimental';
  capBase.layers[1].caps[0].evidence=null;
  fs.writeFileSync(capPath,JSON.stringify(capBase));
  const optedOut=path.join(TMP,'opted-out');
  const opted=spawnSync(process.execPath,[path.join(ROOT,'make_suma.mjs'),'--geo',capPath,'--out',optedOut,
    '--name','cap_opted','--machine','ender','--dry','--allow-experimental-membrane'],
    {cwd:TMP,encoding:'utf8',env:process.env});
  assert.equal(opted.status,0,opted.stderr||opted.stdout);
  const capReport=JSON.parse(fs.readFileSync(path.join(optedOut,'cap_opted_report.json'),'utf8')).report;
  assert.equal(capReport.experimentalMembraneOverride,true);
  assert.equal(capReport.caps[0].process,processName);
  assert.equal(capReport.caps[0].physicalStatus,'experimental');
  assert.equal(capReport.caps[0].evidence,null);
  assert.equal(capReport.caps[0].span_mm,4);

  const capOnly=structuredClone(geo);
  capOnly.layers[1]={k:1,zBot:0.2,zTop:0.4,w:3,tab:0.7,web:'staple',phase:'test',
    contours:[],caps:[{kind:'test',span_mm:4,pts:[[2,0],[0,2],[-2,0],[0,-2],[2,0],[0,0]],
      process:processName,physicalStatus:'experimental',evidence:null}]};
  const capOnlyPath=path.join(TMP,'cap-only.json');
  const capOnlyOut=path.join(TMP,'cap-only-out');
  fs.writeFileSync(capOnlyPath,JSON.stringify(capOnly));
  const capOnlyRun=spawnSync(process.execPath,[path.join(ROOT,'make_climber.mjs'),'--geo',capOnlyPath,
    '--out',capOnlyOut,'--name','cap_only','--machine','ender','--dry',
    '--allow-experimental-membrane'],{cwd:TMP,encoding:'utf8',env:process.env});
  assert.equal(capOnlyRun.status,0,capOnlyRun.stderr||capOnlyRun.stdout);
  const capOnlyReport=JSON.parse(fs.readFileSync(path.join(capOnlyOut,'cap_only_report.json'),'utf8')).report;
  assert.equal(capOnlyReport.caps.length,1,'make_climber silently dropped a cap-only layer');
  assert.equal(capOnlyReport.caps[0].span_mm,4);
  assert.equal(capOnlyReport.caps[0].physicalStatus,'experimental');

  const historic=path.join(TMP,'historic_report.json');
  fs.writeFileSync(historic,'historic receipt');
  assert.throws(()=>freshReportPath(TMP,'historic'),/refusing to overwrite existing build report/);
  assert.equal(fs.readFileSync(historic,'utf8'),'historic receipt');

  const builder=fs.readFileSync(path.join(ROOT,'make_suma.mjs'),'utf8');
  for(const flag of ['--maxbridge','--maxcantilever','--allow','--minanchor','--max-cap-radius'])
    assert.ok(builder.includes(`'${flag}'`),`gate does not forward ${flag}`);
  const climberBuilder=fs.readFileSync(path.join(ROOT,'make_climber.mjs'),'utf8');
  assert.match(climberBuilder,/process\.env\.WEFT_PYTHON\|\|'python3'/,
    'make_climber does not accept the active Python executable');
  const cli=fs.readFileSync(path.join(ROOT,'weft.py'),'utf8');
  assert.match(cli,/builder_env\['WEFT_PYTHON'\] = sys\.executable/,
    'WEFT CLI does not pass its active Python executable to the builder');
  const defaultRunner=fs.readFileSync(path.join(ROOT,'tests','run_all.mjs'),'utf8');
  for(const required of ['limit16.test.mjs','mcp.test.mjs','run_tests.mjs'])
    assert.ok(defaultRunner.includes(required),`default test runner omits ${required}`);
  for(const [producer,status] of [
    ['plate_geometry.py','failed'],
    ['limit16_geometry.py','failed'],
    ['suma_geometry.py','experimental'],
    ['climber_geometry.py','experimental'],
    ['vase_geometry.py','experimental']
  ]){
    const source=fs.readFileSync(path.join(ROOT,producer),'utf8');
    assert.match(source,new RegExp(`physicalStatus['"]?\\s*:\\s*['"]${status}`),
      `${producer} emits caps without explicit ${status} status`);
    assert.match(source,/single-layer-inward-spiral\//,
      `${producer} emits caps without a versioned process identity`);
  }
  const limit16Source=fs.readFileSync(path.join(ROOT,'limit16_geometry.py'),'utf8');
  assert.match(limit16Source,/specimens\/LIMIT16_2026-09-04_RESULTS\.md/,
    'LIMIT16 failed membrane does not cite its physical evidence');
  console.log('PASS limit16: Ender coordinates, typed paths, sparse-bridge refusal, membrane qualification, global Z and bounded gate controls');
}finally{
  fs.rmSync(TMP,{recursive:true,force:true});
}
