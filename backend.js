(()=>{
"use strict";
const $=id=>document.getElementById(id),status=s=>{$("cloudStatus").textContent=s;};
const config=window.SIA_CONFIG||{},url=config.supabaseUrl||"",key=config.supabasePublishableKey||"";
const ready=Boolean(url&&key);
if(!ready){status("아직 서버가 연결되지 않았습니다. Supabase 연결 정보를 입력하면 로그인·게시 기능이 활성화됩니다.");return;}
if(!/^https:\/\/[a-z0-9.-]+\.supabase\.co\/?$/i.test(url)||!window.supabase?.createClient){status("Supabase 연결 정보나 라이브러리를 확인하세요.");return;}
const client=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
window.SIA_SUPABASE=client;
let user=null,admin=false,memberLevel=1,loading=false,adminLoaded=false;
const loadingButton=(id,isLoading)=>{$(id).disabled=isLoading;};
async function query(q){const {data,error}=await q;if(error)throw error;return data;}
const rows=table=>query(client.from(table).select("*").limit(5000));
function view(){
 $("cloudLoginForm").hidden=!!user;$("cloudLogout").hidden=!user;$("cloudAdminTools").hidden=!admin;
 $("cloudPublish").disabled=!adminLoaded;
 if(user)status((admin?"관리자":"회원")+" 로그인: "+user.email+" · "+memberLevel+"등급"+(admin?" · 서버 게시 가능":" · 열람 전용"));
 else status("서버 연결됨 · 방문자 (1등급). 관리자가 허용한 자료만 표시됩니다.");
}
async function who(){
 const {data,error}=await client.auth.getUser();user=error?null:data.user;
 adminLoaded=false;
 let profile=null;if(user){profile=await query(client.from("member_profiles").select("member_level,is_admin").eq("id",user.id).maybeSingle());}
 memberLevel=profile?.member_level||1;admin=Boolean(profile?.is_admin);
 view();
}
function reconcileVisibility(visibility){
 document.querySelectorAll("[data-section]").forEach(section=>{
  const required=visibility[section.dataset.section]||1;
  section.hidden=!admin&&memberLevel<required;
 });
}
async function loadCloud({force=false}={}){
 if(loading)return;loading=true;status("서버 자료를 불러오는 중입니다.");
 try{
  const old=window.SIA_BRIDGE.snapshot();
  const hasLocal=Boolean(old.entries.length||old.watch.length||old.sessions.length||old.contact.phone||old.contact.email);
  if(hasLocal&&!force){status("이 브라우저에 기존 기록이 있어 자동 덮어쓰기를 건너뛰었습니다. 관리자 로그인 후 백업하고 서버 기록을 불러오세요.");return;}
  const [levels,pages,brand,presence,content,sessions,contacts]=await Promise.all([
   rows("member_levels"),rows("page_visibility"),rows("site_branding"),rows("site_presence"),rows("content_items"),rows("practice_sessions"),rows("contact_methods")
  ]);
  const branding=brand.find(x=>x.id===1)||{},pre=presence.find(x=>x.id===1);
  const pageRules=Object.fromEntries(pages.map(p=>[p.slug,p.min_level]));
  const publicContent=content.map(x=>({
   id:x.id,title:x.title,kind:x.category,date:x.watched_on||"",body:x.body||"",url:x.link_url||"",
   posterUrl:x.poster_url||"",posterSource:x.poster_source||"",posterSourceUrl:x.poster_source_url||"",
   minLevel:x.min_level,created:Date.parse(x.created_at)||Date.now()
  }));
  const s={...old,levels:levels.sort((a,b)=>a.level_number-b.level_number).map(l=>l.name),
   sectionLevels:{...old.sectionLevels,...pageRules},
   statuses:Array.isArray(branding.status_options)&&branding.status_options.length?branding.status_options:old.statuses,
   currentStatus:pre?.activity||"비공개",statusAt:pre?.changed_at?Date.parse(pre.changed_at):null,
   statusLevel:pre?.min_level||pageRules.now||1,
   practiceLevel:sessions[0]?.min_level||pageRules.practice||1,
   locationLevel:Math.max(2,pageRules.location||4),
   contactLevel:contacts[0]?.min_level||pageRules.contact||2,
   previewLevel:memberLevel,
   entries:publicContent.filter(x=>!["영화","드라마"].includes(x.kind)),
   watch:publicContent.filter(x=>["영화","드라마"].includes(x.kind)),
   sessions:sessions.map(x=>({id:x.id,date:x.practiced_on,kind:x.kind,elapsedMs:1000*x.duration_seconds,created:Date.parse(x.created_at)||Date.now()})),
   social:{instagram:contacts.find(x=>x.kind==="instagram")?.destination||"",youtube:contacts.find(x=>x.kind==="youtube")?.destination||"",blog:contacts.find(x=>x.kind==="blog")?.destination||""},
   contact:{phone:contacts.find(x=>x.kind==="phone")?.destination||"",email:contacts.find(x=>x.kind==="email")?.destination||""}
  };
  if(s.levels.length<2)s.levels=old.levels;
  window.SIA_BRIDGE.hydrate(s);
  try{if(branding.hero_image_url)window.localStorage.setItem("sia-space-hero-photo-v1",branding.hero_image_url);else window.localStorage.removeItem("sia-space-hero-photo-v1");}catch{}
  document.dispatchEvent(new CustomEvent("sia:photo-sync",{detail:{url:branding.hero_image_url||""}}));
  reconcileVisibility(pageRules);
  if(admin)adminLoaded=true;
  view();status((admin?"관리자":"방문자")+" · 서버 기록을 불러왔습니다. "+(admin?"변경 후 '서버에 게시'를 눌러야 반영됩니다.":"")); 
 }catch(err){status("서버 불러오기 실패: "+String(err.message||err));}
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
 if(!adminLoaded){status("서버 기록을 먼저 불러와 권한이 있는 모든 자료를 확인한 후 게시하세요. 기존 비공개 자료의 손실을 막기 위한 제한입니다.");return;}
 if(!confirm("이 브라우저의 등급·공개 범위·기록을 서버에 게시합니다. 서버의 기존 기록 중 여기 없는 항목은 삭제됩니다. 먼저 JSON 백업을 권장합니다. 계속할까요?"))return;
 loading=true;loadingButton("cloudPublish",true);status("서버에 게시 중입니다.");
 try{
  const s=window.SIA_BRIDGE.snapshot();
  const levels=s.levels.slice(0,10).map((name,i)=>({level_number:i+1,name}));
  await replaceRows("member_levels","level_number",levels);
  await upsert("page_visibility",Object.entries(s.sectionLevels).map(([slug,min_level])=>({slug,min_level:Number(min_level)})));
  const contacts=[...(s.contact.phone?[{kind:"phone",destination:s.contact.phone,min_level:s.contactLevel}]:[]),...(s.contact.email?[{kind:"email",destination:s.contact.email,min_level:s.contactLevel}]:[]),...Object.entries(s.social).filter(([,v])=>Boolean(v)).map(([kind,destination])=>({kind,destination,min_level:s.contactLevel}))];
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
   min_level:Number(x.minLevel||1),created_at:new Date(x.created||Date.now()).toISOString()
  }));
  await replaceRows("content_items","id",items);
  const sessions=s.sessions.map(x=>({
   id:String(x.id),kind:x.kind,practiced_on:x.date,duration_seconds:Math.floor(Number(x.elapsedMs||0)/1000),
   min_level:Number(s.practiceLevel||1),created_at:new Date(x.created||Date.now()).toISOString()
  }));
  await replaceRows("practice_sessions","id",sessions);
  status("서버 게시를 완료했습니다. 등급별 접근 제한은 데이터베이스 정책이 적용합니다.");
 }catch(err){status("서버 게시 실패: "+String(err.message||err)+" · 일부 자료만 게시되었을 수 있습니다.");}
 finally{loading=false;loadingButton("cloudPublish",false);}
}
$("cloudLoginForm").addEventListener("submit",async e=>{
 e.preventDefault();const btn=e.currentTarget.querySelector("button[type=submit]");btn.disabled=true;status("로그인 중입니다.");
 try{
  const {error}=await client.auth.signInWithPassword({email:$("cloudEmail").value.trim(),password:$("cloudPassword").value});
  if(error)throw error;$("cloudPassword").value="";await who();
  status(admin?"관리자 로그인 성공 · 서버 기록 불러오기 또는 게시를 선택하세요.":"회원 로그인 성공 · 등급에 맞는 서버 기록을 불러오는 중입니다.");
  if(!admin)await loadCloud();
 }catch(err){status("로그인 실패: "+String(err.message||err));}
 finally{btn.disabled=false;}
});
$("cloudLogout").addEventListener("click",async()=>{
 if(!confirm("로그아웃하면 이 브라우저의 기록을 서버의 공개 자료로 바꿉니다. 저장하지 않은 로컬 기록이 있다면 먼저 백업하세요. 계속할까요?"))return;
 await client.auth.signOut();user=null;admin=false;memberLevel=1;view();await loadCloud({force:true});
});
$("cloudLoad").onclick=async()=>{if(!confirm("현재 브라우저 데이터를 서버 내용으로 바꿉니다. 저장하지 않은 기록이 있으면 JSON 백업 후 진행하세요. 계속할까요?"))return;await loadCloud({force:true});};
$("cloudPublish").onclick=pushCloud;
window.SIA_TMDB_SEARCH=async(title,kind)=>{
 if(!admin)throw Error("TMDB 검색은 관리자 로그인 후 사용할 수 있습니다.");
 const {data,error}=await client.functions.invoke("media-search",{body:{title,kind}});
 if(error)throw error;
 return Array.isArray(data?.results)?data.results:[];
};
(async()=>{
 try{await who();if(!admin)await loadCloud();}catch(err){status("서버 연결 오류: "+String(err.message||err));}
})();
})();