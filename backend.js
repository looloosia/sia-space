(()=>{
"use strict";
const $=id=>document.getElementById(id),status=s=>{$("cloudStatus").textContent=s;const adminStatus=$("adminPublishStatus");if(adminStatus)adminStatus.textContent=s;};
const config=window.SIA_CONFIG||{},url=config.supabaseUrl||"",key=config.supabasePublishableKey||"";
const ready=Boolean(url&&key);
if(!ready){status("아직 서버가 연결되지 않았습니다. Supabase 연결 정보를 입력하면 로그인·게시 기능이 활성화됩니다.");return;}
if(!/^https:\/\/[a-z0-9.-]+\.supabase\.co\/?$/i.test(url)||!window.supabase?.createClient){status("Supabase 연결 정보나 라이브러리를 확인하세요.");return;}
const client=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
$("localNotice").textContent="서버 연결 모드입니다. 회원 등급에 따른 서버 조회는 활성화할 수 있지만, 관리자의 변경사항은 저장 시 서버에 자동 반영됩니다.";
window.SIA_SUPABASE=client;
let user=null,admin=false,approved=false,memberLevel=1,loading=false,adminLoaded=false,lastCloudSuccess=0;
const snapshotBackupKey="sia-space-local-precloud-backup-v2";
const unsyncedBackupKey="sia-space-device-only-records-v1";
function deviceBackup(){
 try {
  const raw=localStorage.getItem(unsyncedBackupKey);
  const parsed=raw?JSON.parse(raw):null;
  if(!parsed||typeof parsed!=="object")return {entries:[],watch:[],sessions:[]};
  return {entries:Array.isArray(parsed.entries)?parsed.entries:[],watch:Array.isArray(parsed.watch)?parsed.watch:[],sessions:Array.isArray(parsed.sessions)?parsed.sessions:[]};
 }catch{return {entries:[],watch:[],sessions:[]};}
}
function showDeviceBackup(){
 const backup=deviceBackup(),count=backup.entries.length+backup.watch.length+backup.sessions.length;
 const button=$("restoreDeviceRecords");
 if(button)button.hidden=!admin||!count;
 const summary=$("deviceRecordsBackupStatus");
 if(summary)summary.textContent=count?"이 기기에만 있었던 기록 "+count+"개가 별도로 보관돼 있습니다. 필요한 기록만 확인 후 서버에 합칠 수 있습니다.":"이 기기에서 별도로 보관된 기록이 없습니다.";
 return count;
}
function archiveDeviceOnlyRecords(old,remote){
 if(!admin)return 0;
 const prior=deviceBackup(),merged={},counts={};
 for(const type of ["entries","watch","sessions"]){
  const remoteIDs=new Set((remote[type]||[]).map(x=>String(x.id)));
  const past=new Map((prior[type]||[]).filter(x=>x?.id&&!remoteIDs.has(String(x.id))).map(x=>[String(x.id),x]));
  const priorUnique=past.size;
  for(const item of (old[type]||[])){
   if(item?.id&&!remoteIDs.has(String(item.id))&&!past.has(String(item.id)))past.set(String(item.id),item);
  }
  merged[type]=[...past.values()];
  counts[type]=past.size-priorUnique;
 }
 if(JSON.stringify(merged)!==JSON.stringify(prior)){
  try{
   const total=merged.entries.length+merged.watch.length+merged.sessions.length;
   if(total)localStorage.setItem(unsyncedBackupKey,JSON.stringify(merged));
   else localStorage.removeItem(unsyncedBackupKey);
  }catch(error){
   console.error("기기 전용 기록 백업 실패",error);
   throw Error("기기 기록 백업에 실패해 서버 자료를 덮어쓰지 않았습니다. 브라우저 저장 공간을 확인해 주세요.");
  }
 }
 showDeviceBackup();
 return Object.values(counts).reduce((a,b)=>a+Math.max(0,b),0);
}
function hasPendingAutosave(){
 if(window.SIA_AUTOSAVE?.hasPending())return true;
 try{
  const pending=JSON.parse(localStorage.getItem("sia-space-pending-autosave-v1")||"[]");
  return Array.isArray(pending)&&pending.length>0;
 }catch{return false;}
}
function applyIdentity(){
 document.documentElement.classList.toggle("sia-admin",admin);
 document.documentElement.classList.toggle("sia-visitor",!admin);
 $("settingsNav").textContent=admin?"사이트 설정":user?"내 계정":"로그인·회원가입";
 $("restoreLocalDraft").hidden=!(admin&&localStorage.getItem(snapshotBackupKey));
 showDeviceBackup();
}
const loadingButton=(id,isLoading)=>{$(id).disabled=isLoading;};
async function query(q){const {data,error}=await q;if(error)throw error;return data;}
const rows=table=>query(client.from(table).select("*").limit(5000));
function view(){
 applyIdentity();
 $("authModeToggle").hidden=!!user;
 $("cloudLoginForm").hidden=!!user || window.SIA_SIGNUP_MODE===true;
 $("cloudSignupForm").hidden=!!user || window.SIA_SIGNUP_MODE!==true;
 $("cloudLogout").hidden=!user;$("cloudAdminTools").hidden=!admin;
 $("cloudPublish").disabled=!admin;
 $("cloudViewerRefresh").hidden=false;
 if(user)status(admin?"관리자 로그인: "+user.email+" · 자동 저장 활성화":approved?"회원 로그인: "+user.email+" · "+memberLevel+"등급":"회원가입 승인 대기: "+user.email+" · 현재 1등급");
 else status("서버 연결됨 · 방문자 (1등급). 관리자가 허용한 자료만 표시됩니다.");
 window.SIA_IDENTITY={user:user?{id:user.id,email:user.email}:null,admin,approved,memberLevel};
 document.dispatchEvent(new Event("sia:auth"));
}
async function who(){
 window.SIA_MENU_READY=false;
 document.documentElement.classList.remove("sia-public-loaded");
 const {data,error}=await client.auth.getUser();user=error?null:data.user;
 adminLoaded=false;
 let profile=null;if(user){profile=await query(client.from("member_profiles").select("member_level,is_admin,is_approved").eq("id",user.id).maybeSingle());}
 admin=Boolean(profile?.is_admin);
 approved=Boolean(profile?.is_approved)||admin;
 memberLevel=approved?(profile?.member_level||1):1;
 if(admin)document.documentElement.classList.remove("cloud-authorizing");
 view();
}
function reconcileVisibility(visibility){
 // The route controller displays either the selected menu or an explicit access-denied message.
 // Database RLS is the actual content boundary; the frontend does not reveal denied records.
 window.SIA_MENU_RULES={...visibility};
 window.SIA_MENU_READY=true;
 document.dispatchEvent(new CustomEvent("sia:menu-rules",{detail:{visibility:window.SIA_MENU_RULES}}));
}
function updateSyncStatus(message,state="info"){
 for(const id of ["recordsSyncStatus","practiceSyncStatus"]){
  const element=$(id);
  if(element){element.textContent=message;element.dataset.syncState=state;}
 }
}
async function loadCloud({force=false}={}){
 updateSyncStatus("서버 자료를 불러오는 중입니다…","loading");
 if(loading)return;loading=true;status("서버 자료를 불러오는 중입니다.");
 try{
  const old=window.SIA_BRIDGE.snapshot();
  // Existing local records are not evidence of unsaved changes. Always fetch the
  // authoritative server snapshot, except while explicit autosave operations are pending.
  if(admin&&hasPendingAutosave()){
    const message="이 기기의 서버 자동 저장이 남아 있습니다. 저장이 끝나면 서버 자료를 다시 불러옵니다.";
    status(message);updateSyncStatus(message,"pending");return;
  }
  const [levels,pages,brand,presence,content,sessions,contacts]=await Promise.all([
   rows("member_levels"),rows("page_visibility"),rows("site_branding"),rows("site_presence"),rows("content_items"),rows("practice_sessions"),rows("contact_methods")
  ]);
  const branding=brand.find(x=>x.id===1)||{},pre=presence.find(x=>x.id===1);
  const pageRules=Object.fromEntries(pages.map(p=>[p.slug,p.min_level]));
  const publicContent=content.map(x=>({
   id:x.id,title:x.title,kind:x.category,date:x.watched_on||"",body:x.body||"",url:x.link_url||"",
   posterUrl:x.poster_url||"",posterSource:x.poster_source||"",posterSourceUrl:x.poster_source_url||"",
   minLevel:x.min_level,placeAddress:x.place_address||"",created:Date.parse(x.created_at)||Date.now()
  }));
  const s={...old,levels:levels.sort((a,b)=>a.level_number-b.level_number).map(l=>l.name),
   sectionLevels:{...old.sectionLevels,...pageRules},
   statuses:Array.isArray(branding.status_options)&&branding.status_options.length?branding.status_options:old.statuses,
   currentStatus:pre?.activity||"비공개",statusAt:pre?.changed_at?Date.parse(pre.changed_at):null,
   statusLevel:pre?.min_level||pageRules.now||1,
   practiceLevel:sessions[0]?.min_level||pageRules.practice||1,
   contactLevel:contacts[0]?.min_level||pageRules.contact||2,
   previewLevel:memberLevel,
   entries:publicContent.filter(x=>!["영화","드라마"].includes(x.kind)),
   watch:publicContent.filter(x=>["영화","드라마"].includes(x.kind)),
   sessions:sessions.map(x=>({id:x.id,date:x.practiced_on,kind:x.kind,elapsedMs:1000*x.duration_seconds,created:Date.parse(x.created_at)||Date.now()})),
   social:{instagram:contacts.find(x=>x.kind==="instagram")?.destination||"",youtube:contacts.find(x=>x.kind==="youtube")?.destination||"",blog:contacts.find(x=>x.kind==="blog")?.destination||""},
   contact:{email:contacts.find(x=>x.kind==="email")?.destination||""}
  };
  if(s.levels.length<2)s.levels=old.levels;
  const archived=archiveDeviceOnlyRecords(old,s);
  window.SIA_BRIDGE.hydrate(s);
  try{if(branding.hero_image_url)window.localStorage.setItem("sia-space-hero-photo-v1",branding.hero_image_url);else window.localStorage.removeItem("sia-space-hero-photo-v1");}catch{}
  document.dispatchEvent(new CustomEvent("sia:photo-sync",{detail:{url:branding.hero_image_url||""}}));
  reconcileVisibility(pageRules);
  document.documentElement.classList.add("sia-public-loaded");
  document.documentElement.classList.remove("cloud-authorizing");
  if(admin)adminLoaded=true;
  lastCloudSuccess=Date.now();
  view();
  const serverCount=s.watch.length+s.entries.length;
  const youtubeCount=s.entries.filter(x=>x.kind==="유튜브").length;
  const summary="서버 갱신 완료 · 기록 "+serverCount+"개 (유튜브 "+youtubeCount+"개) · 시간기록 "+s.sessions.length+"개";
  updateSyncStatus(summary+(archived?" · 기기 전용 "+archived+"개 별도 보관":""),"success");
  status((admin?"관리자":"방문자")+" · "+summary);
 }catch(err){
  const message="서버 불러오기 실패: "+String(err.message||err);
  status(message);updateSyncStatus(message,"error");
  document.dispatchEvent(new Event("sia:menu-error"));
 }
 finally{loading=false;}
}
async function upsert(table,items){
 if(!items.length)return;
 for(let i=0;i<items.length;i+=100)await query(client.from(table).upsert(items.slice(i,i+100)));
}
async function replaceRows(table,keyField,items){
 const existing=await query(client.from(table).select(keyField).limit(5000));
 await upsert(table,items);
 const want=new Set(items.map(x=>String(x[keyField]))),removed=existing.map(x=>x[keyField]).filter(id=>!want.has(String(id)));
 for(let i=0;i<removed.length;i+=100)await query(client.from(table).delete().in(keyField,removed.slice(i,i+100)));
}
async function pushCloud(){
 if(!admin||loading)return;
 if(!adminLoaded){
  const [existingItems,existingSessions,existingContacts,existingBrand]=await Promise.all([
   query(client.from("content_items").select("id").limit(1)),
   query(client.from("practice_sessions").select("id").limit(1)),
   query(client.from("contact_methods").select("kind").limit(1)),
   query(client.from("site_branding").select("hero_image_url").eq("id",1).maybeSingle())
  ]);
  if(existingItems.length||existingSessions.length||existingContacts.length||existingBrand?.hero_image_url){
   status("서버에 기존 자료가 있습니다. 모든 비공개 자료를 먼저 불러온 뒤 게시해야 합니다.");
   return;
  }
  adminLoaded=true;
 }
 if(!confirm("이 브라우저의 등급·공개 범위·기록을 서버에 게시합니다. 서버의 기존 기록 중 여기 없는 항목은 삭제됩니다. 먼저 JSON 백업을 권장합니다. 계속할까요?"))return;
 loading=true;loadingButton("cloudPublish",true);status("서버에 게시 중입니다.");
 try{
  const s=window.SIA_BRIDGE.snapshot();
  const levels=s.levels.slice(0,10).map((name,i)=>({level_number:i+1,name}));
  await replaceRows("member_levels","level_number",levels);
  await upsert("page_visibility",Object.entries(s.sectionLevels).filter(([slug])=>!["about","collections","location"].includes(slug)).map(([slug,min_level])=>({slug,min_level:Number(min_level)})));
  const contacts=[...(s.contact.email?[{kind:"email",destination:s.contact.email,min_level:s.contactLevel}]:[]),...Object.entries(s.social).filter(([,v])=>Boolean(v)).map(([kind,destination])=>({kind,destination,min_level:s.contactLevel}))];
  await replaceRows("contact_methods","kind",contacts);
  let heroImageUrl=localStorage.getItem("sia-space-hero-photo-v1")||"";
  if(heroImageUrl.startsWith("data:image/")){
   const image=await fetch(heroImageUrl).then(r=>r.blob());
   if(image.size>5242880)throw Error("대표 사진이 5MB를 초과합니다.");
   const path="hero/cover-"+Date.now()+".jpg";
   await query(client.storage.from("sia-hero").upload(path,image,{contentType:"image/jpeg",upsert:false}));
   heroImageUrl=client.storage.from("sia-hero").getPublicUrl(path).data.publicUrl;
   localStorage.setItem("sia-space-hero-photo-v1",heroImageUrl);
   document.dispatchEvent(new CustomEvent("sia:photo-sync",{detail:{url:heroImageUrl}}));
  }
  await upsert("site_branding",[{
   id:1,hero_image_url:heroImageUrl, social_instagram:"",social_youtube:"",
   social_blog:"",status_options:s.statuses,updated_at:new Date().toISOString()
  }]);
  await upsert("site_presence",[{id:1,activity:s.currentStatus||"쉬는 중",min_level:Number(s.statusLevel||1),changed_at:new Date(s.statusAt||Date.now()).toISOString()}]);
  const items=[...s.watch,...s.entries].map(x=>({
   id:String(x.id),category:x.kind,title:x.title,body:x.body||"",link_url:x.url||"",poster_url:x.posterUrl||"",
   poster_source:x.posterSource||"",poster_source_url:x.posterSourceUrl||"",watched_on:x.date||null,
   min_level:Number(x.minLevel||1),place_address:x.kind==="장소"?(x.placeAddress||""):"",created_at:new Date(x.created||Date.now()).toISOString()
  }));
  await replaceRows("content_items","id",items);
  const sessions=s.sessions.map(x=>({
   id:String(x.id),kind:x.kind,practiced_on:x.date,duration_seconds:Math.floor(Number(x.elapsedMs||0)/1000),
   min_level:Number(s.practiceLevel||1),created_at:new Date(x.created||Date.now()).toISOString()
  }));
  await replaceRows("practice_sessions","id",sessions);
  reconcileVisibility(s.sectionLevels);
  status("서버 게시를 완료했습니다. 메뉴별 공개 등급과 게시물 접근 제한이 데이터베이스에 적용됐습니다.");
 }catch(err){status("서버 게시 실패: "+String(err.message||err)+" · 일부 자료만 게시되었을 수 있습니다.");}
 finally{loading=false;loadingButton("cloudPublish",false);}
}
$("cloudLoginForm").addEventListener("submit",async e=>{
 e.preventDefault();const btn=e.currentTarget.querySelector("button[type=submit]");btn.disabled=true;status("로그인 중입니다.");
 try{
  const {error}=await client.auth.signInWithPassword({email:$("cloudEmail").value.trim(),password:$("cloudPassword").value});
  if(error)throw error;$("cloudPassword").value="";await who();
  status(admin?"관리자 로그인 성공 · 저장 시 서버 자동 반영됩니다.":"회원 로그인 성공 · 등급에 맞는 서버 기록을 불러오는 중입니다.");
  if(!admin)await loadCloud({force:true});
  else if(!hasPendingAutosave())await loadCloud({force:false});
 }catch(err){status("로그인 실패: "+String(err.message||err));}
 finally{btn.disabled=false;}
});
$("cloudLogout").addEventListener("click",async()=>{
 if(window.SIA_AUTOSAVE?.hasPending()){
  await window.SIA_AUTOSAVE.retry();
  if(window.SIA_AUTOSAVE.hasPending()){
   status("아직 서버에 저장되지 않은 변경사항이 있습니다. 관리자 설정의 '실패한 저장 재시도'를 사용하세요.");
   return;
  }
 }
 if(!confirm("로그아웃하면 이 브라우저의 기록을 서버의 공개 자료로 바꿉니다. 복원 중인 백업 데이터가 있다면 먼저 확인하세요. 계속할까요?"))return;
 document.documentElement.classList.remove("sia-admin","sia-public-loaded");
 document.documentElement.classList.add("sia-visitor","cloud-authorizing");
 await client.auth.signOut();user=null;admin=false;approved=false;memberLevel=1;adminLoaded=false;
 window.SIA_BRIDGE.hydrate({entries:[],watch:[],sessions:[],contact:{email:""},currentStatus:"비공개",statusAt:null,previewLevel:1});
 document.documentElement.classList.add("cloud-authorizing");view();await loadCloud({force:true});
});
$("cloudViewerRefresh").onclick=async()=>{if(!confirm("현재 브라우저 기록을 서버에서 불러온 내용으로 바꾸고 싶나요? 로컬 기록은 먼저 JSON 백업하세요."))return;await loadCloud({force:true});};
$("restoreLocalDraft").onclick=()=>{
 if(!admin)return;
 const raw=localStorage.getItem(snapshotBackupKey);
 if(!raw){status("이전에 보관된 로컬 기록이 없습니다.");return;}
 if(!confirm("서버에 아직 없는 예전 로컬 기록만 추가할까요? 이미 서버에 있는 기록은 덮어쓰거나 삭제하지 않습니다."))return;
 try{
  const data=JSON.parse(raw);
  if(data.version!==2||!Array.isArray(data.entries)||!Array.isArray(data.watch)||!Array.isArray(data.sessions))throw Error("백업 데이터 형식이 올바르지 않습니다.");
  const restored=window.SIA_BRIDGE.mergeLocalRecords?.(data);
  if(!restored)throw Error("기존 로컬 기록을 복구할 수 없습니다.");
  status("예전 로컬 기록 "+(restored.entries+restored.watch+restored.sessions)+"개를 안전하게 합치고 서버 저장을 요청했습니다.");
 }catch(e){status("복구 실패: "+String(e.message||e));}
};
$("cloudLoad").onclick=async()=>{if(!confirm("현재 브라우저 데이터를 서버 내용으로 바꿉니다. 저장하지 않은 기록이 있으면 JSON 백업 후 진행하세요. 계속할까요?"))return;await loadCloud({force:true});};
$("cloudPublish").onclick=pushCloud;
for(const id of ["refreshRecordsFromServer","refreshPracticeFromServer"]){
 const button=$(id);
 if(button)button.addEventListener("click",async()=>{
  if(hasPendingAutosave()){
   updateSyncStatus("서버에 저장 중인 작업을 먼저 완료해 주세요.","pending");
   return;
  }
  button.disabled=true;
  try{await loadCloud({force:true});}
  finally{button.disabled=false;}
 });
}
$("restoreDeviceRecords")?.addEventListener("click",()=>{
 if(!admin)return;
 const backup=deviceBackup();
 const count=backup.entries.length+backup.watch.length+backup.sessions.length;
 if(!count)return;
 if(!confirm("이 기기에만 남아 있던 기록 "+count+"개를 서버 기록에 추가할까요? 기존 서버 기록은 삭제하지 않고, 이미 있는 ID는 건너뜁니다."))return;
 const result=window.SIA_BRIDGE.mergeLocalRecords?.(backup);
 if(!result)return status("기기 전용 기록을 복원할 수 없습니다.");
 const merged=result.entries+result.watch+result.sessions;
 status("누락됐던 기기 전용 기록 "+merged+"개의 서버 저장을 요청했습니다. 관리자 설정의 자동 저장 상태를 확인해 주세요.");
}); 
document.addEventListener("sia:autosave-drained",()=>{
 if(admin&&!adminLoaded&&!loading)loadCloud({force:true});
});
window.SIA_SYNC={
 refresh:()=>loadCloud({force:true}),
 getDeviceBackup:deviceBackup,
 hasPending:hasPendingAutosave
};
function refreshWhenReturning(){
 if(document.hidden||loading||!window.SIA_MENU_READY||hasPendingAutosave())return;
 if(Date.now()-lastCloudSuccess<45000)return;
 if(["entryForm","watchForm"].some(id=>{const el=$(id);return el&&!el.hidden;}))return;
 loadCloud({force:false});
}
window.addEventListener("focus",refreshWhenReturning);
document.addEventListener("visibilitychange",refreshWhenReturning);
window.SIA_TMDB_SEARCH=async(title,kind)=>{
 if(!admin)throw Error("TMDB 검색은 관리자 로그인 후 사용할 수 있습니다.");
 const {data,error}=await client.functions.invoke("media-search",{body:{title,kind}});
 if(error)throw error;
 return Array.isArray(data?.results)?data.results:[];
};
(async()=>{
 try{
  await who();
  if(!admin)await loadCloud({force:true});
  else if(!hasPendingAutosave())await loadCloud({force:false});
 }catch(err){status("서버 연결 오류: "+String(err.message||err));}
})();
})();