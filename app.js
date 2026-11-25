(()=>{
"use strict";
const $=id=>document.getElementById(id),make=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=String(txt);return e;};
const types=["사진","책","장소","프로젝트","음악","유튜브","개인 위키","타임라인"];
const archiveMap={"사진":"photos","책":"books","장소":"places","프로젝트":"projects","음악":"music","유튜브":"youtube","개인 위키":"wiki","타임라인":"timeline"};
const sections={home:"홈",now:"현재 상태",practice:"시간기록",records:"기록들",community:"소통",contact:"소셜·이메일"};
const defaults=()=>({version:2,levels:["일반 방문자","일반 회원","친구","특별 회원"],sectionLevels:{home:1,now:1,practice:1,records:1,community:1,contact:2},practiceLevel:1,statusLevel:1,contactLevel:2,previewLevel:1,statuses:["쉬는 중","피아노 연습 중","공부 중","수업 중","이동 중","독서 중","외출 중","작업 중","수면 중"],currentStatus:"쉬는 중",statusAt:null,timer:{kind:"피아노 연습",active:false,startedAt:null,elapsedMs:0},sessions:[],watch:[],entries:[],social:{instagram:"",youtube:"",blog:""},contact:{email:""}});
let state;try{state={...defaults(),...JSON.parse(localStorage.getItem("sia-space-local-v2")||"null")};}catch{state=defaults();}
if(!Array.isArray(state.levels)||state.levels.length<2)state=defaults();
state.levels=state.levels.slice(0,10);state.sessions=Array.isArray(state.sessions)?state.sessions:[];state.watch=Array.isArray(state.watch)?state.watch:[];state.entries=Array.isArray(state.entries)?state.entries:[];state.statuses=Array.isArray(state.statuses)&&state.statuses.length?state.statuses:defaults().statuses;
state.timer=state.timer&&typeof state.timer==="object"?state.timer:defaults().timer;
if(!state.timer.active||!Number.isFinite(state.timer.startedAt)||state.timer.startedAt>Date.now()){state.timer.active=false;state.timer.startedAt=null;}
state.social=state.social||defaults().social;state.contact={email:String(state.contact?.email||"")};
const historicalSections=state.sectionLevels||{};
state.sectionLevels={...defaults().sectionLevels,...historicalSections};
if(!Object.hasOwn(historicalSections,"home")&&historicalSections.about)state.sectionLevels.home=historicalSections.about;
for(const slug of Object.values(archiveMap))if(!Object.hasOwn(historicalSections,slug)&&historicalSections.collections)state.sectionLevels[slug]=historicalSections.collections;
if(!Object.hasOwn(historicalSections,"records")){
 const oldRules=["watch",...Object.values(archiveMap)].map(slug=>Number(historicalSections[slug])).filter(n=>Number.isFinite(n)&&n>=1);
 state.sectionLevels.records=oldRules.length?Math.min(...oldRules):1;
}
delete state.locationLevel;
delete state.sectionLevels.location;
const snapshot=()=>JSON.parse(JSON.stringify(state));
let savedSnapshot=snapshot();
const save=({localOnly=false}={})=>{
 state.contact={email:String(state.contact?.email||"")};
 delete state.locationLevel;if(state.sectionLevels)delete state.sectionLevels.location;
 const before=savedSnapshot,after=snapshot();
 try{localStorage.setItem("sia-space-local-v2",JSON.stringify(after));}
 catch{toast("저장 공간이 부족합니다.");return;}
 savedSnapshot=after;
 if(!localOnly&&window.SIA_IDENTITY?.admin){
  document.dispatchEvent(new CustomEvent("sia:local-change",{detail:{before,after}}));
 }
};
const date=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-"),today=()=>date(new Date());
const time=ms=>{let s=Math.floor(Math.max(0,ms)/1000);return [Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(x=>String(x).padStart(2,"0")).join(":");};
const duration=ms=>time(ms);
const id=()=>Math.random().toString(36).slice(2)+Date.now(),level=n=>n+"등급 · "+(state.levels[n-1]||"등급");
let month=new Date();month.setDate(1);let selected=today(),editingWatch=null,editingEntry=null;
function toast(s){const el=$("toast");el.textContent=s;el.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.hidden=true,3500);}
window.SIA_NOTIFY=toast;
function options(el,values,current){el.replaceChildren(...values.map(v=>new Option(v[0],String(v[1]))));if(current!==undefined)el.value=String(current);}
function levelOptions(){document.querySelectorAll(".level-options").forEach(el=>{let v=el.value;options(el,state.levels.map((name,i)=>[(i+1)+"등급 · "+name,i+1]),v||1);});}
function settings(){
 levelOptions();
 options($("statusSelect"),state.statuses.map(v=>[v,v]),state.currentStatus);
 $("currentStatus").textContent=$("heroStatus").textContent=state.currentStatus;
 $("statusUpdated").textContent=state.statusAt?"마지막 변경: "+new Date(state.statusAt).toLocaleString("ko-KR"):"아직 변경한 적 없음";
 $("statusAudience").textContent=level(state.statusLevel);$("practiceAudience").textContent=level(state.practiceLevel);
 ["statusLevel","practiceLevel","contactLevel","previewLevel"].forEach(key=>$(key).value=state[key]);
 $("headerLevel").textContent=state.previewLevel+"등급";
 $("statusOptionsEditor").replaceChildren();
 state.statuses.forEach(status=>{const row=make("div","setting-row");row.append(make("span","",status));const b=make("button","btn small","삭제");b.disabled=state.statuses.length===1;b.onclick=()=>{state.statuses=state.statuses.filter(v=>v!==status);if(state.currentStatus===status)state.currentStatus=state.statuses[0];save();settings();};row.append(b);$("statusOptionsEditor").append(row);});
 $("gradePreview").replaceChildren();$("levelEditor").replaceChildren();
 state.levels.forEach((name,i)=>{
  const r=make("div","access-row");r.append(make("b","","Lv."+(i+1)),make("span","",name),make("small","",i===0?"공개 방문자":"권한별 접근"),make("i","",i+1<=state.previewLevel?"✓":"◌"));$("gradePreview").append(r);
  const row=make("div","setting-row"),label=make("label","",(i+1)+"등급"),input=make("input","input");input.value=name;input.maxLength=30;input.setAttribute("aria-label",(i+1)+"등급 이름");input.onchange=()=>{if(!input.value.trim()){input.value=name;return;}state.levels[i]=input.value.trim();save();settings();};row.append(label,input);$("levelEditor").append(row);
 });
 $("addLevel").disabled=state.levels.length>=10;
 $("sectionEditor").replaceChildren();
 Object.entries(sections).forEach(([key,label])=>{const row=make("div","setting-row"),sel=make("select","select");
  options(sel,state.levels.map((n,i)=>[(i+1)+"등급 이상",i+1]),state.sectionLevels[key]||1);
  sel.onchange=()=>{state.sectionLevels[key]=Number(sel.value);save();toast("등급 설정을 변경했습니다. 자동으로 서버에 반영됩니다.");};row.append(make("label","",label),sel);$("sectionEditor").append(row);
 });
 $("socialInstagram").value=state.social.instagram||"";$("socialYoutube").value=state.social.youtube||"";$("socialBlog").value=state.social.blog||"";
 $("contactEmail").value=state.contact.email||"";
 renderSocial();renderContact();renderSummary();
}
$("addLevel").onclick=()=>{if(state.levels.length>=10)return;state.levels.push("새 등급 "+(state.levels.length+1));save();settings();};
["statusLevel","practiceLevel","contactLevel","previewLevel"].forEach(key=>$(key).onchange=()=>{state[key]=Number($(key).value);save();settings();});
$("saveStatus").onclick=()=>{state.currentStatus=$("statusSelect").value;state.statusAt=Date.now();save();settings();toast("상태를 서버에 저장하는 중입니다.");};
$("newStatusForm").onsubmit=e=>{e.preventDefault();const v=$("newStatusInput").value.trim();if(!v||state.statuses.includes(v)||state.statuses.length>=30)return;state.statuses.push(v);$("newStatusInput").value="";save();settings();};
const elapsed=()=>Math.max(0,(Number(state.timer.elapsedMs)||0)+(state.timer.active?Math.max(0,Date.now()-state.timer.startedAt):0));
function timerRender(){
 $("timerDisplay").textContent=time(elapsed());$("timerState").textContent=state.timer.active?"측정 중":elapsed()?"일시정지":"준비됨";
 $("timerKind").value=state.timer.kind;$("timerKind").disabled=state.timer.active||elapsed()>0;
 $("timerStart").textContent=elapsed()?"이어서 시작":"시작";$("timerStart").disabled=state.timer.active;
 $("timerPause").disabled=!state.timer.active;$("timerFinish").disabled=elapsed()<1000;
}
$("timerKind").onchange=e=>{if(state.timer.active||elapsed()>0){e.target.value=state.timer.kind;return;}state.timer.kind=e.target.value;save();};
$("timerStart").onclick=()=>{if(state.timer.active)return;state.timer.active=true;state.timer.startedAt=Date.now();save();timerRender();};
$("timerPause").onclick=()=>{state.timer.elapsedMs=elapsed();state.timer.active=false;state.timer.startedAt=null;save();timerRender();};
$("timerFinish").onclick=()=>{
 const ms=elapsed();if(ms<1000)return;if(!confirm(state.timer.kind+" "+duration(ms)+"을 오늘 기록으로 저장할까요?"))return;
 state.sessions.push({id:id(),date:today(),kind:state.timer.kind,elapsedMs:ms,created:Date.now()});
 state.timer={kind:state.timer.kind,active:false,startedAt:null,elapsedMs:0};save();timerRender();calendar();renderSummary();toast("시간 기록을 서버에 저장하는 중입니다.");
};
setInterval(()=>{if(state.timer.active)timerRender();},1000);
function renderSummary(){
 const sum=a=>a.reduce((t,v)=>t+Number(v.elapsedMs||0),0),all=state.sessions,items=[["오늘의 피아노",sum(all.filter(s=>s.date===today()&&s.kind==="피아노 연습"))],["오늘의 순공",sum(all.filter(s=>s.date===today()&&s.kind==="순공"))],["이번 달 합계",sum(all.filter(s=>s.date?.startsWith(today().slice(0,7))))]];
 $("timerSummary").replaceChildren(...items.map(([name,n])=>{const e=make("div","summary-tile");e.append(make("span","",name),make("b","",duration(n)));return e;}));
}
function calendar(){
 $("calendarTitle").textContent=month.getFullYear()+"년 "+(month.getMonth()+1)+"월";
 $("selectedDateTitle").textContent=selected+" 기록";const grid=$("calendarGrid");grid.replaceChildren();
 ["일","월","화","수","목","금","토"].forEach(v=>grid.append(make("div","weekday",v)));
 const first=new Date(month.getFullYear(),month.getMonth(),1),count=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
 for(let j=0;j<first.getDay();j++)grid.append(make("div","day dim"));
 for(let i=1;i<=count;i++){
  const d=date(new Date(month.getFullYear(),month.getMonth(),i)),total=state.sessions.filter(v=>v.date===d).reduce((a,v)=>a+Number(v.elapsedMs||0),0),b=make("button","day");
  if(d===selected)b.classList.add("selected");if(d===today())b.classList.add("today");
  b.append(make("span","day-number",i));if(total>0)b.append(make("span","day-time",duration(total)));b.setAttribute("aria-label",d);b.onclick=()=>{selected=d;calendar();};grid.append(b);
 }
 const list=$("selectedDateRecords");list.replaceChildren();
 const found=state.sessions.filter(s=>s.date===selected);
 if(!found.length)list.append(make("li","muted","기록이 없습니다."));
 found.forEach(x=>{const li=make("li");li.append(make("div","record-title",x.kind+" · "+duration(x.elapsedMs)));
 const b=make("button","link-button owner-only","삭제");b.onclick=()=>{if(!confirm("이 기록을 삭제할까요?"))return;state.sessions=state.sessions.filter(v=>v.id!==x.id);save();calendar();renderSummary();};li.append(b);list.append(li);});
}
$("prevMonth").onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()-1,1);calendar();};
$("nextMonth").onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()+1,1);calendar();};
const previousRecordFilters={
 watch:"watch",photos:"사진",books:"책",places:"장소",
 projects:"프로젝트",music:"음악",youtube:"유튜브",
 wiki:"개인 위키",timeline:"타임라인",collections:"all"
};
function recordsFilterFromHash(){
 const hash=decodeURIComponent(location.hash.slice(1)).toLowerCase();
 if(Object.hasOwn(previousRecordFilters,hash))$("recordsFilter").value=previousRecordFilters[hash];
}
function cards(_kind){
 const filter=$("recordsFilter").value||"all";
 const search=$("recordsSearch").value.trim().toLowerCase();
 let items=[...state.watch,...state.entries];
 if(filter==="watch")items=items.filter(x=>x.kind==="영화"||x.kind==="드라마");
 else if(filter!=="all")items=items.filter(x=>x.kind===filter);
 if(search)items=items.filter(x=>(x.title+" "+(x.body||"")+" "+(x.placeAddress||"")).toLowerCase().includes(search));
 const credit=$("tmdbAttribution");
 if(credit)credit.hidden=!(filter==="all"||filter==="watch")||!items.some(x=>x.posterSource==="tmdb");
 renderCards($("recordsList"),items);
}
function renderCards(target,items){
 target.replaceChildren();
 const matched=items.slice().sort((a,b)=>Number(b.created)-Number(a.created));
 if(!matched.length){target.append(make("p","list-empty","해당 분류에 등록된 기록이 없습니다."));return;}
 matched.forEach(x=>{
  const watch=x.kind==="영화"||x.kind==="드라마";
  const card=make("article","entry-card");
  if(watch&&validUrl(x.posterUrl)){const cover=make("div","poster-cover"),img=make("img");img.src=x.posterUrl;img.alt=x.title+" 포스터";img.loading="lazy";cover.append(img);card.append(cover);}
  if(!watch&&x.kind==="유튜브"&&videoId(x.url)){const f=make("iframe");f.src="https://www.youtube-nocookie.com/embed/"+videoId(x.url);f.title=x.title;f.loading="lazy";f.allowFullscreen=true;card.append(f);}
  if(!watch&&x.imagePath&&window.SIA_RECORD_PHOTOS){
    window.SIA_RECORD_PHOTOS.mountCard(card,x.imagePath,x.title);
  }else if(!watch&&x.kind==="사진"&&validUrl(x.url)){
    const box=make("div","entry-illustration"),img=make("img");img.src=x.url;img.loading="lazy";img.alt=x.title;box.append(img);card.append(box);
  }
  card.append(make("span","eyebrow",x.kind==="개인 위키"?"개인 기록":x.kind),make("h3","",x.title),make("p","record-meta",(x.date||new Date(x.created).toLocaleDateString("ko-KR"))+" · "+level(x.minLevel||1)));
  if(!watch&&x.kind==="장소"&&x.placeAddress)card.append(make("p","record-address","📍 "+x.placeAddress));
  if(x.body)card.append(make("p","record-note",x.body));
  if(watch&&validUrl(x.posterSourceUrl)){const origin=make("a","poster-credit",x.posterSource==="tvmaze"?"TVmaze 작품 정보 ↗":x.posterSource==="itunes"?"Apple TV 작품 정보 ↗":"포스터 출처 ↗");origin.href=x.posterSourceUrl;origin.target="_blank";origin.rel="noopener noreferrer";card.append(origin);}
  if(!watch&&validUrl(x.url)){const a=make("a","link-button",x.kind==="장소"?"지도에서 보기 ↗":"링크 열기 ↗");a.href=x.url;a.target="_blank";a.rel="noopener noreferrer";card.append(a);}
  const foot=make("footer"),edit=make("button","link-button owner-only","수정"),del=make("button","link-button owner-only","삭제");
  edit.onclick=()=>openForm(watch?"watch":"entries",x);
  del.onclick=()=>{
    if(!confirm("이 기록을 삭제할까요?"))return;
    if(watch)state.watch=state.watch.filter(v=>v.id!==x.id);
    else state.entries=state.entries.filter(v=>v.id!==x.id);
    save();cards();
  };
  foot.append(edit,del);card.append(foot);target.append(card);
 });
}
function validUrl(v){try{return new URL(v).protocol==="https:";}catch{return false;}}
function videoId(v){try{const u=new URL(v);if(u.protocol!=="https:")return null;let val=null;if(["youtube.com","www.youtube.com","m.youtube.com"].includes(u.hostname))val=u.searchParams.get("v");else if(u.hostname==="youtu.be")val=u.pathname.split("/")[1];return /^[a-zA-Z0-9_-]{11}$/.test(val)?val:null;}catch{return null;}}
function categories(){cards();}
function openForm(kind,x,chosenCategory){
 const watch=kind==="watch",form=$(watch?"watchForm":"entryForm");
 const other=$(watch?"entryForm":"watchForm");
 other.hidden=true;
 form.hidden=false;
 if(watch){
  editingWatch=x?.id||null;
  $("watchFormTitle").textContent=x?"감상 기록 수정":"감상 기록 추가";
  $("watchTitle").value=x?.title||"";
  $("watchKind").value=x?.kind||chosenCategory||"영화";
  $("watchDate").value=x?.date||today();
  $("watchLevel").value=x?.minLevel||Math.max(1,Number(state.sectionLevels.records||1),Number(state.sectionLevels.watch||1));
  $("watchNote").value=x?.body||"";$("watchPoster").value=x?.posterUrl||"";
  $("watchPosterSource").value=x?.posterSource||"";$("watchPosterSourceUrl").value=x?.posterSourceUrl||"";
  $("posterResults").replaceChildren();
 } else {
  editingEntry=x?.id||null;
  $("entryFormTitle").textContent=x?"기록 수정":"기록 추가";
  $("entryTitle").value=x?.title||"";
  const kindLabel=x?.kind||chosenCategory||"사진";
  $("entryKind").value=kindLabel;
  $("entryUrl").value=x?.url||"";
  const oldSection=archiveMap[kindLabel];
  $("entryLevel").value=x?.minLevel||Math.max(1,Number(state.sectionLevels.records||1),Number(state.sectionLevels[oldSection]||1));
  $("entryPlaceAddress").value=x?.placeAddress||"";
  $("entryPlaceAddressField").hidden=kindLabel!=="장소";
  $("entryBody").value=x?.body||"";
  window.SIA_RECORD_PHOTOS?.initForm(x?.imagePath||"");
 }
 form.scrollIntoView({behavior:"smooth",block:"center"});
}
types.forEach(v=>$("entryKind").append(new Option(v==="개인 위키"?"개인 기록":v,v)));
$("entryKind").addEventListener("change",()=>{
 const type=$("entryKind").value;
 $("entryPlaceAddressField").hidden=type!=="장소";
 if(!editingEntry)$("entryLevel").value=String(Math.max(1,Number(state.sectionLevels.records||1),Number(state.sectionLevels[archiveMap[type]]||1)));
});
document.addEventListener("sia:naver-place-selected",event=>{
 if(!window.SIA_IDENTITY?.admin)return;
 const place=event.detail||{};
 if(typeof place.title!=="string"||!place.title.trim())return;
 openForm("entries",null,"장소");
 $("entryTitle").value=place.title.trim().slice(0,120);
 $("entryUrl").value=place.mapUrl||"";
 $("entryPlaceAddress").value=String(place.address||"").slice(0,300);
 $("entryPlaceAddressField").hidden=false;
 $("entryBody").value="";
});
$("recordAddButton").onclick=()=>{
 const selected=$("recordNewCategory").value;
 openForm(selected==="영화"||selected==="드라마"?"watch":"entries",null,selected);
 if(selected==="장소")$("naverPlaceTools").open=true;
};
$("recordsFilter").onchange=()=>{
 if($("recordsFilter").value==="장소"&&window.SIA_IDENTITY?.admin)$("naverPlaceTools").open=true;
 cards();
};
$("recordsSearch").oninput=()=>cards();
document.addEventListener("sia:record-photo-ready",()=>cards());
document.querySelector('#mainNav a[href="#records"]')?.addEventListener("click",()=>{
 $("recordsFilter").value="all";cards();
});
window.addEventListener("hashchange",()=>{recordsFilterFromHash();cards();});
recordsFilterFromHash();
$("watchCancel").onclick=()=>{$("watchForm").hidden=true;editingWatch=null;};
$("entryCancel").onclick=()=>{$("entryForm").hidden=true;editingEntry=null;};
$("watchForm").onsubmit=e=>{
 e.preventDefault();const old=state.watch.find(x=>x.id===editingWatch);
 const entry={id:old?.id||id(),created:old?.created||Date.now(),title:$("watchTitle").value.trim(),kind:$("watchKind").value,date:$("watchDate").value,minLevel:Number($("watchLevel").value),body:$("watchNote").value.trim(),posterUrl:$("watchPoster").value.trim(),posterSource:$("watchPosterSource").value,posterSourceUrl:$("watchPosterSourceUrl").value};
 if(!entry.title||!entry.date)return;
 if(entry.posterUrl&&!validUrl(entry.posterUrl))return toast("포스터는 https:// 주소만 등록할 수 있습니다.");
 state.watch=state.watch.filter(x=>x.id!==editingWatch);state.watch.push(entry);
 save();$("watchForm").hidden=true;editingWatch=null;
 $("recordsFilter").value="watch";cards();
 toast("감상 기록을 서버에 저장하는 중입니다.");
 if(location.hash!=="#records")location.hash="#records";
};
$("entryForm").onsubmit=async e=>{
 e.preventDefault();
 const submit=e.currentTarget.querySelector('button[type="submit"]');
 if(submit?.disabled)return;
 const old=state.entries.find(x=>x.id===editingEntry),url=$("entryUrl").value.trim();
 if(url&&!validUrl(url))return toast("https:// 링크만 등록할 수 있습니다.");
 const entry={id:old?.id||id(),created:old?.created||Date.now(),title:$("entryTitle").value.trim(),kind:$("entryKind").value,url,minLevel:Number($("entryLevel").value),body:$("entryBody").value.trim(),placeAddress:$("entryKind").value==="장소"?$("entryPlaceAddress").value.trim():"",imagePath:old?.imagePath||""};
 if(!entry.title)return toast("기록 제목을 입력해 주세요.");
 if(!window.SIA_IDENTITY?.admin)return toast("기록 추가는 관리자 계정으로 로그인해야 합니다.");
 submit.disabled=true;
 try{
  entry.imagePath=await window.SIA_RECORD_PHOTOS?.prepareUpload(entry.id,old?.imagePath||"")??entry.imagePath;
  state.entries=state.entries.filter(x=>x.id!==editingEntry);state.entries.push(entry);
  save();$("entryForm").hidden=true;editingEntry=null;
  $("recordsFilter").value=entry.kind;cards();
  toast("기록과 첨부 사진을 서버에 저장하는 중입니다.");
  if(location.hash!=="#records")location.hash="#records";
 }catch(error){
  toast("사진 첨부를 저장하지 못했습니다: "+String(error.message||error));
 }finally{submit.disabled=false;}
};
function socialUrl(v,allowed){try{const u=new URL(v);return u.protocol==="https:"&&allowed.some(host=>u.hostname===host||u.hostname.endsWith("."+host))?u.href:null;}catch{return null;}}
function renderSocial(){
 const box=$("socialButtons");box.replaceChildren();
 [["instagram","인스타그램",["instagram.com"]],["youtube","유튜브",["youtube.com","youtu.be"]],["blog","네이버 블로그",["blog.naver.com"]]].forEach(([key,name,hosts])=>{
  const url=socialUrl(state.social[key],hosts);if(url){const a=make("a","social-link",name+" ↗");a.href=url;a.target="_blank";a.rel="noopener noreferrer";box.append(a);}
 });if(!box.children.length)box.append(make("p","muted","아직 연결된 소셜미디어가 없습니다."));
}
$("socialForm").onsubmit=e=>{
 e.preventDefault();const vals={instagram:$("socialInstagram").value.trim(),youtube:$("socialYoutube").value.trim(),blog:$("socialBlog").value.trim()};
 for(const [k,hosts] of Object.entries({instagram:["instagram.com"],youtube:["youtube.com","youtu.be"],blog:["blog.naver.com"]})){if(vals[k]&&!socialUrl(vals[k],hosts))return toast("해당 서비스의 올바른 https:// 주소를 입력하세요.");}
 state.social=vals;save();renderSocial();toast("소셜 링크를 서버에 저장하는 중입니다.");
};
function renderContact(){
 const box=$("contactButtons");box.replaceChildren();
 if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.contact.email||"")){const a=make("a","social-link","이메일 보내기 ↗");a.href="mailto:"+state.contact.email;box.append(a);}
 if(!box.children.length)box.append(make("p","muted","아직 공개된 이메일 주소가 없습니다."));
}
$("contactForm").onsubmit=e=>{e.preventDefault();state.contact={email:$("contactEmail").value.trim()};state.contactLevel=Number($("contactLevel").value);save();renderContact();toast("이메일 설정을 서버에 저장하는 중입니다. 자동으로 서버에 반영됩니다.");};
$("exportData").onclick=()=>{
 const blob=new Blob([JSON.stringify({app:"SIA SPACE",exportedAt:new Date().toISOString(),data:state},null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=make("a");a.href=url;a.download="sia-space-backup-"+today()+".json";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$("importData").onchange=async e=>{
 const f=e.target.files?.[0];if(!f)return;
 try{if(f.size>4000000)throw Error("파일이 너무 큽니다.");const obj=JSON.parse(await f.text());if(obj.app!=="SIA SPACE"||obj.data?.version!==2)throw Error("백업 형식이 다릅니다.");if(!confirm("현재 기록을 대체할까요?"))return;
  const imported=obj.data;if(!Array.isArray(imported.levels)||!Array.isArray(imported.sessions)||!Array.isArray(imported.watch)||!Array.isArray(imported.entries))throw Error("백업 데이터 형식 오류");
  state={...defaults(),...imported};state.levels=state.levels.slice(0,10);state.timer={...defaults().timer};save({localOnly:true});settings();calendar();cards("watch");cards("entries");timerRender();toast("백업을 불러왔습니다.");
 }catch(err){toast(err.message||"백업을 읽을 수 없습니다.");}finally{e.target.value="";}
};
// Mobile/tablet navigation is handled only in script.js to avoid double toggling.
window.SIA_BRIDGE={
 snapshot:()=>JSON.parse(JSON.stringify(state)),
 hydrate:(patch)=>{
 state={...state,...patch};
 state.sectionLevels={...defaults().sectionLevels,...state.sectionLevels};
 delete state.locationLevel;if(state.sectionLevels)delete state.sectionLevels.location;
 save({localOnly:true});settings();timerRender();calendar();categories();cards("watch");
 document.dispatchEvent(new Event("sia:menu-data-updated"));
},
 mergeLocalRecords:(backup)=>{
  if(!window.SIA_IDENTITY?.admin)return null;
  const counts={entries:0,watch:0,sessions:0};
  for(const type of Object.keys(counts)){
   const local=Array.isArray(backup?.[type])?backup[type]:[];
   const have=new Set(state[type].map(x=>String(x.id)));
   for(const item of local){
    if(!item||typeof item.id!=="string"||!item.id||have.has(String(item.id)))continue;
    if(type!=="sessions"&&(!item.title||!item.kind))continue;
    if(type==="sessions"&&(!item.kind||!item.date||!Number.isFinite(Number(item.elapsedMs))))continue;
    state[type].push(item);have.add(String(item.id));counts[type]++;
   }
  }
  if(Object.values(counts).some(Boolean)){
   save();
   calendar();renderSummary();cards();
   document.dispatchEvent(new Event("sia:menu-data-updated"));
  }
  return counts;
 }
};
settings();timerRender();calendar();categories();cards("watch");
})();