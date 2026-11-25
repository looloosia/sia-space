(() => {
"use strict";
// Publish only the changed rows in Supabase. Never overwrite unrelated server data.
const client=window.SIA_SUPABASE;
if(!client)return;
const queueKey="sia-space-pending-autosave-v1";
const $=id=>document.getElementById(id);
const permitted={
 member_levels:"level_number",page_visibility:"slug",site_branding:"id",
 site_presence:"id",contact_methods:"kind",content_items:"id",practice_sessions:"id"
};
const equals=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const safeDate=value=>new Date(value||Date.now()).toISOString();
const levels=obj=>Array.isArray(obj?.levels)?obj.levels:[];
const entries=obj=>[...(obj?.watch||[]),...(obj?.entries||[])];
const contacts=obj=>({email:obj?.contact?.email||"",...obj?.social});
const mapById=list=>new Map(list.filter(x=>x&&x.id).map(x=>[String(x.id),x]));
const getAdmin=()=>Boolean(window.SIA_IDENTITY?.admin);
let queue=[],busy=false,failed=false;
try{
 const stored=JSON.parse(localStorage.getItem(queueKey)||"[]");
 if(Array.isArray(stored))queue=stored.filter(x=>x&&typeof x==="object"&&x.type&&(
    (["upsert","delete","update","all-practice-level"].includes(x.type)&&permitted[x.table])||
    x.type==="photo"
 )).slice(0,500);
}catch{queue=[];}
function persist(){
 try {
  if(queue.length)localStorage.setItem(queueKey,JSON.stringify(queue));
  else localStorage.removeItem(queueKey);
 }catch(error){
  console.warn("Automatic sync queue could not be saved locally.",error);
 }
}
function ui(message,kind="info"){
 const label=$("autoSyncStatus"),retry=$("autoSyncRetry");
 if(label){label.textContent=message;label.dataset.syncState=kind;}
 if(retry)retry.hidden=queue.length===0 || (busy&&!failed);
 const status=$("heroImageStatus");
 if(status && kind==="error" && queue[0]?.type==="photo")
  status.textContent=message;
 if(kind==="error")window.SIA_NOTIFY?.(message);
 else if(kind==="success")window.SIA_NOTIFY?.("서버에 자동 저장됐습니다.");
}
function plan(before,after){
 const ops=[];
 const oldLevels=levels(before),newLevels=levels(after);
 newLevels.forEach((name,i)=>{
  if(name!==oldLevels[i])ops.push({type:"upsert",table:"member_levels",row:{level_number:i+1,name}});
 });
 const oldPages=before?.sectionLevels||{},newPages=after?.sectionLevels||{};
 for(const [slug,value] of Object.entries(newPages)){
  if(["location","about","collections"].includes(slug))continue;
  if(Number(oldPages[slug])!==Number(value)){
   ops.push({type:"upsert",table:"page_visibility",row:{slug,min_level:Number(value)}});
  }
 }
 if(!equals(before?.statuses,after?.statuses)){
  ops.push({type:"update",table:"site_branding",row:{status_options:after.statuses,updated_at:new Date().toISOString()}});
 }
 if(before?.currentStatus!==after?.currentStatus||before?.statusLevel!==after?.statusLevel||before?.statusAt!==after?.statusAt){
  ops.push({type:"update",table:"site_presence",row:{
   activity:after.currentStatus||"쉬는 중",
   min_level:Number(after.statusLevel||1),
   changed_at:safeDate(after.statusAt)
  }});
 }
 const oldLinks=contacts(before),newLinks=contacts(after),levelChanged=before?.contactLevel!==after?.contactLevel;
 for(const kind of ["email","instagram","youtube","blog"]){
  const from=String(oldLinks[kind]||""),to=String(newLinks[kind]||"");
  if(from===to&&!levelChanged)continue;
  if(to){
   ops.push({type:"upsert",table:"contact_methods",row:{kind,destination:to,min_level:Number(after.contactLevel||2)}});
  }else if(from){
   ops.push({type:"delete",table:"contact_methods",key:"kind",value:kind});
  }
 }
 const previousItems=mapById(entries(before)),nextItems=mapById(entries(after));
 for(const [id,item] of nextItems){
  if(equals(previousItems.get(id),item))continue;
  ops.push({type:"upsert",table:"content_items",row:{
   id,category:item.kind,title:item.title,body:item.body||"",
   link_url:item.url||"",poster_url:item.posterUrl||"",
   poster_source:item.posterSource||"",poster_source_url:item.posterSourceUrl||"",
   watched_on:item.date||null,min_level:Number(item.minLevel||1),
   place_address:item.kind==="장소"?(item.placeAddress||""):"",
   image_path:item.imagePath||"",
   created_at:safeDate(item.created)
  }});
 }
 for(const id of previousItems.keys())if(!nextItems.has(id))
  ops.push({type:"delete",table:"content_items",key:"id",value:id});

 const practiceChanged=before?.practiceLevel!==after?.practiceLevel;
 if(practiceChanged)ops.push({type:"all-practice-level",table:"practice_sessions",level:Number(after.practiceLevel||1)});
 const previousSessions=mapById(before?.sessions||[]),newSessions=mapById(after?.sessions||[]);
 for(const [id,item] of newSessions){
  if(equals(previousSessions.get(id),item))continue;
  ops.push({type:"upsert",table:"practice_sessions",row:{
   id,kind:item.kind,practiced_on:item.date,
   duration_seconds:Math.floor(Number(item.elapsedMs||0)/1000),
   min_level:Number(after.practiceLevel||1),
   created_at:safeDate(item.created)
  }});
 }
 for(const id of previousSessions.keys())if(!newSessions.has(id))
  ops.push({type:"delete",table:"practice_sessions",key:"id",value:id});
 return ops;
}
async function execute(op){
 if(!getAdmin())throw Error("관리자 로그인이 필요합니다.");
 if(op.type==="photo"){
  let imageUrl=op.url||"", uploadedFrom=null;
  if(imageUrl==="@local"){
   const data=localStorage.getItem("sia-space-hero-photo-v1")||"";
   if(!data.startsWith("data:image/"))throw Error("사진 파일을 다시 선택해 주세요.");
   uploadedFrom=data;
   const blob=await fetch(data).then(res=>res.blob());
   if(blob.size>5242880)throw Error("대표 사진 용량이 5MB를 초과합니다.");
   const filePath="hero/cover-"+crypto.randomUUID()+".jpg";
   const {error}=await client.storage.from("sia-hero").upload(filePath,blob,{contentType:"image/jpeg",upsert:false});
   if(error)throw error;
   imageUrl=client.storage.from("sia-hero").getPublicUrl(filePath).data.publicUrl;
   op.url=imageUrl;persist(); // upload need not repeat on retry
  }
  if(imageUrl && !/^https:\/\//.test(imageUrl))throw Error("https 이미지 주소만 허용됩니다.");
  const {data,error}=await client.from("site_branding")
    .update({hero_image_url:imageUrl,updated_at:new Date().toISOString()})
    .eq("id",1).select("id").single();
  if(error)throw error;
  if(!data)throw Error("대표 사진 저장을 확인하지 못했습니다.");
  if(uploadedFrom && localStorage.getItem("sia-space-hero-photo-v1")===uploadedFrom){
   localStorage.setItem("sia-space-hero-photo-v1",imageUrl);
   document.dispatchEvent(new CustomEvent("sia:photo-sync",{detail:{url:imageUrl}}));
  }
  return;
 }
 if(!Object.hasOwn(permitted,op.table))throw Error("허용되지 않은 테이블입니다.");
 if(op.type==="all-practice-level"){
  const {error}=await client.from("practice_sessions").update({min_level:op.level})
    .gte("duration_seconds",0);
  if(error)throw error;return;
 }
 const key=permitted[op.table];
 if(op.type==="upsert"){
  if(!op.row||!(key in op.row))throw Error("저장할 항목의 식별자가 없습니다.");
  const {data,error}=await client.from(op.table).upsert(op.row).select(key).single();
  if(error)throw error;
  if(!data)throw Error("변경 저장을 확인하지 못했습니다.");
 }else if(op.type==="update"){
  if(!op.row)throw Error("변경 사항이 없습니다.");
  const {data,error}=await client.from(op.table).update(op.row).eq("id",1).select("id").single();
  if(error)throw error;
  if(!data)throw Error("설정 저장을 확인하지 못했습니다.");
 }else if(op.type==="delete"){
  if(op.key!==key)throw Error("삭제할 항목의 식별자가 잘못됐습니다.");
  const {error}=await client.from(op.table).delete().eq(key,op.value);
  if(error)throw error;
 }else throw Error("알 수 없는 저장 요청입니다.");
 if(op.table==="page_visibility"){
  window.SIA_MENU_RULES={...window.SIA_MENU_RULES,[op.row.slug]:op.row.min_level};
  window.SIA_MENU_READY=true;
  document.dispatchEvent(new CustomEvent("sia:menu-rules",{detail:{visibility:window.SIA_MENU_RULES}}));
 }
}
async function flush(){
 if(busy||!getAdmin()||!queue.length)return;
 busy=true;failed=false;
 ui("서버에 자동 저장 중입니다… ("+queue.length+"건)");
 while(queue.length&&getAdmin()){
  try{
   await execute(queue[0]);
   queue.shift();persist();
  }catch(error){
   failed=true;
   console.error("SIA SPACE auto-publish failed:",error);
   ui("서버 자동 저장 실패: "+String(error.message||error)+". 다시 시도할 수 있습니다.","error");
   break;
  }
 }
 busy=false;
 if(!failed&&queue.length===0){
  ui("모든 변경사항이 서버에 자동 저장됐습니다.","success");
  document.dispatchEvent(new Event("sia:autosave-drained"));
 } else if(!failed&&queue.length)ui("로그인 후 남은 저장을 재개할 수 있습니다.");
 const button=$("autoSyncRetry");if(button)button.hidden=queue.length===0;
}
function addOperations(ops){
 if(!getAdmin()||!ops.length)return;
 queue.push(...ops);
 // Never silently discard unsaved changes, even if a network outage creates a long queue.
 if(queue.length>500)console.warn("자동 저장 대기 항목이 많습니다:",queue.length);
 persist();
 ui("서버에 자동 저장 중입니다… ("+queue.length+"건)");
 flush();
}
document.addEventListener("sia:local-change",event=>{
 try{addOperations(plan(event.detail?.before||{},event.detail?.after||{}));}
 catch(error){ui("자동 저장 준비 실패: "+String(error.message||error),"error");}
});
document.addEventListener("sia:photo-local-change",event=>{
 if(!getAdmin())return;
 const original=String(event.detail?.url||"");
 if(original && !original.startsWith("data:image/") && !original.startsWith("https://")){
  ui("지원하지 않는 사진 주소입니다.","error");return;
 }
 addOperations([{type:"photo",url:original.startsWith("data:image/")?"@local":original}]);
});
document.addEventListener("sia:auth",()=>{if(getAdmin())flush();});
$("autoSyncRetry")?.addEventListener("click",()=>{failed=false;flush();});
window.SIA_AUTOSAVE={retry:flush,hasPending:()=>queue.length>0,isBusy:()=>busy};
if(queue.length)ui("서버에 저장하지 못한 변경사항 "+queue.length+"건이 있습니다. 관리자 로그인 후 재시도합니다.");
if(queue.length&&getAdmin())flush();
})();