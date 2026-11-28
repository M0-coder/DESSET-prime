import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import worker from "../internal/contact-platform/worker.mjs";
const load=name=>JSON.parse(readFileSync(new URL("../internal/contact-platform/"+name,import.meta.url),"utf8"));
test("activation handoff remains explicitly closed and requires external evidence",()=>{
 const a=load("activation-readiness.json"),d=load("deployment-contract.json");
 assert.equal(a.decision,"NO_GO");assert.equal(a.productionLocked,true);assert.equal(a.automaticActivation,false);
 assert.deepEqual(Object.keys(a.gates),["registeredController","privacyNotice","retentionAndBackups","departmentOwners","accessAndMfa","trustedIngressAndChallenge","isolatedHostedD1","publicFrontendAndPanelIntegration","schedulerAndJournalRetention","notificationDeliveryAndMonitoring","physicalDeviceAndAccessibility","rollbackRehearsal","exactReleaseCi","ownerReleaseApproval"]);
 for(const g of Object.values(a.gates))assert.deepEqual(g,{status:"PENDING",evidenceRef:null,approvedBy:null});
 assert.equal(d.status,"CANDIDATE_NOT_DEPLOYED");assert.equal(d.publicPackage,false);assert.equal(d.automaticDeployment,false);
 for(const target of [d.staging,d.production]){assert.equal(target.publicIntake,false);assert.equal(target.databaseId,null);assert.equal(target.accessApplicationId,null);assert.equal(target.turnstileSiteKey,null);}
 assert.equal(d.production.adminEnabled,false);assert.equal(d.production.notificationsEnabled,false);assert.equal(d.accessReadiness.verified,false);
 for(const k of ["metricsEnabled","scheduledPurgeEnabled","notificationsEnabled","maintenanceEnabled","journalMigrationApproved","alertPreviewEnabled"])assert.equal(d.operationsReadiness[k],false,k);
});
test("production export cannot activate even with permissive flags",async()=>{
 const env=new Proxy({}, {get(){throw Error("locked entrypoint must not read any binding");}});
 for(const [method,path] of [["GET","/"],["POST","/api/contact"],["GET","/admin/queue"],["POST","/admin/transition"],["GET","/__alert_preview"],["GET","/admin/maintenance"]]){
  const r=await worker.fetch(new Request("https://contacto.desset.lat"+path,{method}),env,{});
  assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:"CONTACT_RELEASE_LOCKED"});
 }
 assert.equal(typeof worker.scheduled,"undefined");
});
