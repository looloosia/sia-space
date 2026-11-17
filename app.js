(()=>{
"use strict";
const $=id=>document.getElementById(id),make=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=String(txt);return e;};
const types=["사진","책","장소","프로젝트","음악","유튜브","개인 위키","타임라인"];
const sections={about:"소개",now:"현재 상태",practice:"연습과 공부",watch:"영화·드라마",collections:"아카이브",community:"소통",contact:"연락처"};
const defaults=()=>({version:2,levels:["일반 방문자","일반 회원","친구","특별 회원"],sectionLevels:{about:1,now:1,practice:1,watch:1,collections:1,community:1,contact:2},practiceLevel:1,statusLevel:1,contactLevel:2,previewLevel:1,statuses:["쉬는 중","피아노 연습 중","공부 중","수업 중","이동 중","독서 중","외출 중","작업 중","수면 중"],currentStatus:"쉬는 중",statusAt:null,timer:{kind:"피아노 연습",active:false,startedAt:null,elapsedMs:0},sessions:[],watch:[],entries:[],social:{instagram:"",youtube:"",blog:""},contact:{phone:"",email:""}});
let state;try{state={...defaults(),...JSON.parse(localStorage.getItem("sia-space-local-v2")||"null")};}catch{state=defaults();}
if(!Array.isArray(state.levels)||state.levels.length<2)state=defaults();
state.levels=state.levels.slice(0,10);state.sessions=Array.isArray(state.sessions)?state.sessions:[];state.watch=Array.isArray(state.watch)?state.watch:[];state.entries=Array.isArray(state.entries)?state.entries:[];state.statuses=Array.isArray(state.statuses)&&state.statuses.length?state.statuses:defaults().statuses;
state.timer=state.timer&&typeof state.timer==="object"?state.timer:defaults().timer;
if(!state.timer.active||!Number.isFinite(state.timer.startedAt)||state.timer.startedAt>Date.now()){state.timer.active=false;state.timer.startedAt=null;}
state.social=state.social||defaults().social;state.contact=state.contact||defaults().contact;state.sectionLevels=state.sectionLevels||defaults().sectionLevels;
delete state.locationLevel;
delete state.sectionLevels.location;
const save=()=>{delete state.locationLevel;if(state.sectionLevels)delete state.sectionLevels.location;try{localStorage.setItem("sia-space-local-v2",JSON.stringify(state));}catch{toast("저장 공간이 부족합니다.");}};
const date=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-"),today=()=>date(new Date());
const time=ms=>{let s=Math.floor(Math.max(0,ms)/1000);return [Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(x=>String(x).padStart(2,"0")).join(":");};
const duration=ms=>time(ms);
const id=()=>Math.random().toString(36).slice(2)+Date.now(),level=n=>n+"등급 · "+(state.levels[n-1]||"등급");
let month=new Date();month.setDate(1);let selected=today(),category="전체",editingWatch=null,editingEntry=null;
function toast(s){const el=$("toast");el.textContent=s;el.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.hidden=true,3500);}
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
  sel.onchange=()=>{state.sectionLevels[key]=Number(sel.value);save();toast("공개 범위 미리보기를 저장했습니다.");};row.append(make("label","",label),sel);$("sectionEditor").append(row);
 });
 $("socialInstagram").value=state.social.instagram||"";$("socialYoutube").value=state.social.youtube||"";$("socialBlog").value=state.social.blog||"";
 $("contactPhone").value=state.contact.phone||"";$("contactEmail").value=state.contact.email||"";
 renderSocial();renderContact();renderSummary();
}
$("addLevel").onclick=()=>{if(state.levels.length>=10)return;state.levels.push("새 등급 "+(state.levels.length+1));save();settings();};
["statusLevel","practiceLevel","contactLevel","previewLevel"].forEach(key=>$(key).onchange=()=>{state[key]=Number($(key).value);save();settings();});
$("saveStatus").onclick=()=>{state.currentStatus=$("statusSelect").value;state.statusAt=Date.now();save();settings();toast("이 브라우저의 상태를 저장했습니다.");};
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
 state.timer={kind:state.timer.kind,active:false,startedAt:null,elapsedMs:0};save();timerRender();calendar();renderSummary();toast("연습 시간을 기록했습니다.");
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
function cards(kind){
 const watch=kind==="watch",items=watch?state.watch:state.entries,target=$(watch?"watchList":"entriesList"),search=$(watch?"watchSearch":"entrySearch").value.trim().toLowerCase();
 target.replaceChildren();
 if(watch){const credit=document.getElementById("tmdbAttribution");if(credit)credit.hidden=!state.watch.some(x=>x.posterSource==="tmdb");}
 const matched=items.filter(x=>(watch||category==="전체"||x.kind===category)&&(String(x.title)+" "+String(x.body||"")).toLowerCase().includes(search)).sort((a,b)=>Number(b.created)-Number(a.created));
 if(!matched.length){target.append(make("p","list-empty","아직 등록된 기록이 없습니다."));return;}
 matched.forEach(x=>{
  const card=make("article","entry-card");
  if(watch&&validUrl(x.posterUrl)){const cover=make("div","poster-cover"),img=make("img");img.src=x.posterUrl;img.alt=x.title+" 포스터";img.loading="lazy";cover.append(img);card.append(cover);}
  if(!watch&&x.kind==="유튜브"&&videoId(x.url)){const f=make("iframe");f.src="https://www.youtube-nocookie.com/embed/"+videoId(x.url);f.title=x.title;f.loading="lazy";f.allowFullscreen=true;card.append(f);}
  if(!watch&&x.kind==="사진"&&validUrl(x.url)){const box=make("div","entry-illustration"),img=make("img");img.src=x.url;img.loading="lazy";img.alt=x.title;box.append(img);card.append(box);}
  card.append(make("span","eyebrow",x.kind),make("h3","",x.title),make("p","record-meta",(x.date||new Date(x.created).toLocaleDateString("ko-KR"))+" · "+level(x.minLevel||1)));
  if(x.body)card.append(make("p","record-note",x.body));
  if(watch&&validUrl(x.posterSourceUrl)){const origin=make("a","poster-credit",x.posterSource==="tvmaze"?"TVmaze 작품 정보 ↗":x.posterSource==="itunes"?"Apple TV 작품 정보 ↗":"포스터 출처 ↗");origin.href=x.posterSourceUrl;origin.target="_blank";origin.rel="noopener noreferrer";card.append(origin);}
  if(!watch&&validUrl(x.url)){const a=make("a","link-button","링크 열기 ↗");a.href=x.url;a.target="_blank";a.rel="noopener noreferrer";card.append(a);}
  const foot=make("footer"),edit=make("button","link-button owner-only","수정"),del=make("button","link-button owner-only","삭제");
  edit.onclick=()=>openForm(kind,x);del.onclick=()=>{if(!confirm("이 기록을 삭제할까요?"))return;state[watch?"watch":"entries"]=items.filter(v=>v.id!==x.id);save();cards(kind);};
  foot.append(edit,del);card.append(foot);target.append(card);
 });
}
function validUrl(v){try{return new URL(v).protocol==="https:";}catch{return false;}}
function videoId(v){try{const u=new URL(v);if(u.protocol!=="https:")return null;let val=null;if(["youtube.com","www.youtube.com","m.youtube.com"].includes(u.hostname))val=u.searchParams.get("v");else if(u.hostname==="youtu.be")val=u.pathname.split("/")[1];return /^[a-zA-Z0-9_-]{11}$/.test(val)?val:null;}catch{return null;}}
function categories(){const bar=$("categoryBar");bar.replaceChildren();["전체",...types].forEach(v=>{const b=make("button","chip"+(category===v?" active":""),v);b.onclick=()=>{category=v;categories();cards("entries");};bar.append(b);});}
function openForm(kind,x){
 const watch=kind==="watch",form=$(watch?"watchForm":"entryForm");form.hidden=false;
 if(watch){editingWatch=x?.id||null;$("watchFormTitle").textContent=x?"감상 기록 수정":"감상 기록 추가";$("watchTitle").value=x?.title||"";$("watchKind").value=x?.kind||"영화";$("watchDate").value=x?.date||today();$("watchLevel").value=x?.minLevel||1;$("watchNote").value=x?.body||"";$("watchPoster").value=x?.posterUrl||"";$("watchPosterSource").value=x?.posterSource||"";$("watchPosterSourceUrl").value=x?.posterSourceUrl||"";$("posterResults").replaceChildren();}
 else{editingEntry=x?.id||null;$("entryFormTitle").textContent=x?"아카이브 수정":"아카이브 추가";$("entryTitle").value=x?.title||"";$("entryKind").value=x?.kind||(types.includes(category)?category:"사진");$("entryUrl").value=x?.url||"";$("entryLevel").value=x?.minLevel||1;$("entryBody").value=x?.body||"";}
 form.scrollIntoView({behavior:"smooth",block:"center"});
}
types.forEach(v=>$("entryKind").append(new Option(v,v)));
$("watchAddToggle").onclick=()=>openForm("watch");$("entryAddToggle").onclick=()=>openForm("entries");
$("watchCancel").onclick=()=>{$("watchForm").hidden=true;editingWatch=null;};
$("entryCancel").onclick=()=>{$("entryForm").hidden=true;editingEntry=null;};
$("watchSearch").oninput=()=>cards("watch");$("entrySearch").oninput=()=>cards("entries");
$("watchForm").onsubmit=e=>{
 e.preventDefault();const old=state.watch.find(x=>x.id===editingWatch);
 const entry={id:old?.id||id(),created:old?.created||Date.now(),title:$("watchTitle").value.trim(),kind:$("watchKind").value,date:$("watchDate").value,minLevel:Number($("watchLevel").value),body:$("watchNote").value.trim(),posterUrl:$("watchPoster").value.trim(),posterSource:$("watchPosterSource").value,posterSourceUrl:$("watchPosterSourceUrl").value};
 if(!entry.title||!entry.date)return;if(entry.posterUrl&&!validUrl(entry.posterUrl))return toast("포스터는 https:// 주소만 등록할 수 있습니다.");state.watch=state.watch.filter(x=>x.id!==editingWatch);state.watch.push(entry);save();$("watchForm").hidden=true;editingWatch=null;cards("watch");toast("감상 기록을 저장했습니다.");
};
$("entryForm").onsubmit=e=>{
 e.preventDefault();const old=state.entries.find(x=>x.id===editingEntry),url=$("entryUrl").value.trim();
 if(url&&!validUrl(url))return toast("https:// 링크만 등록할 수 있습니다.");
 const entry={id:old?.id||id(),created:old?.created||Date.now(),title:$("entryTitle").value.trim(),kind:$("entryKind").value,url,minLevel:Number($("entryLevel").value),body:$("entryBody").value.trim()};
 if(!entry.title)return;state.entries=state.entries.filter(x=>x.id!==editingEntry);state.entries.push(entry);save();$("entryForm").hidden=true;editingEntry=null;cards("entries");toast("아카이브에 저장했습니다.");
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
 state.social=vals;save();renderSocial();toast("소셜 링크를 저장했습니다.");
};
function renderContact(){
 const box=$("contactButtons");box.replaceChildren();const number=String(state.contact.phone||"").replace(/[^\d+]/g,"");
 if(/^\+?\d{8,15}$/.test(number)){[["tel","전화 걸기"],["sms","문자 보내기"]].forEach(([scheme,label])=>{const a=make("a","social-link",label+" ↗");a.href=scheme+":"+number;box.append(a);});}
 if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.contact.email||"")){const a=make("a","social-link","이메일 보내기 ↗");a.href="mailto:"+state.contact.email;box.append(a);}
 if(!box.children.length)box.append(make("p","muted","아직 공개된 연락처가 없습니다."));
}
$("contactForm").onsubmit=e=>{e.preventDefault();state.contact={phone:$("contactPhone").value.trim(),email:$("contactEmail").value.trim()};state.contactLevel=Number($("contactLevel").value);save();renderContact();toast("이 브라우저에 연락처를 저장했습니다.");};
$("exportData").onclick=()=>{
 const blob=new Blob([JSON.stringify({app:"SIA SPACE",exportedAt:new Date().toISOString(),data:state},null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=make("a");a.href=url;a.download="sia-space-backup-"+today()+".json";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$("importData").onchange=async e=>{
 const f=e.target.files?.[0];if(!f)return;
 try{if(f.size>4000000)throw Error("파일이 너무 큽니다.");const obj=JSON.parse(await f.text());if(obj.app!=="SIA SPACE"||obj.data?.version!==2)throw Error("백업 형식이 다릅니다.");if(!confirm("현재 기록을 대체할까요?"))return;
  const imported=obj.data;if(!Array.isArray(imported.levels)||!Array.isArray(imported.sessions)||!Array.isArray(imported.watch)||!Array.isArray(imported.entries))throw Error("백업 데이터 형식 오류");
  state={...defaults(),...imported};state.levels=state.levels.slice(0,10);state.timer={...defaults().timer};save();settings();calendar();cards("watch");cards("entries");timerRender();toast("백업을 불러왔습니다.");
 }catch(err){toast(err.message||"백업을 읽을 수 없습니다.");}finally{e.target.value="";}
};
const menu=$("menuButton"),nav=$("mainNav");menu.onclick=()=>{const opened=nav.classList.toggle("open");menu.setAttribute("aria-expanded",String(opened));};nav.querySelectorAll("a").forEach(a=>a.onclick=()=>{nav.classList.remove("open");menu.setAttribute("aria-expanded","false");});
window.SIA_BRIDGE={
 snapshot:()=>JSON.parse(JSON.stringify(state)),
 hydrate:(patch)=>{state={...state,...patch};delete state.locationLevel;if(state.sectionLevels)delete state.sectionLevels.location;save();settings();timerRender();calendar();categories();cards("watch");cards("entries");}
};
settings();timerRender();calendar();categories();cards("watch");cards("entries");
})();