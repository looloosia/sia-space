(() => {
"use strict";

const $ = id => document.getElementById(id);
const client = window.SIA_SUPABASE;
const FEATURES = {
  guestbook: {table:"guestbook_messages",list:"guestbookList",form:"guestbookForm",notice:"guestbookWriteNotice",label:"방명록",defaultLevel:2},
  questions: {table:"community_questions",list:"questionList",form:"questionForm",notice:"questionWriteNotice",label:"질문과 답변",defaultLevel:2},
  coffee: {table:"coffee_requests",list:"coffeeList",form:"coffeeForm",notice:"coffeeWriteNotice",label:"커피챗 신청",defaultLevel:3}
};
const status = $("communityStatus");
const permissions = {guestbook:2,questions:2,coffee:3};
const displayNames = new Map();
const loaded = {guestbook:false,questions:false,coffee:false};
let current = "guestbook";
let requestId = 0;
let changingPermission = false;

function person(){return window.SIA_IDENTITY||{user:null,admin:false,approved:false,memberLevel:1};}
function element(tag,klass,txt) {
 const el=document.createElement(tag);
 if(klass)el.className=klass;
 if(txt!==undefined)el.textContent=String(txt);
 return el;
}
function updateStatus(message,error=false){
 status.textContent=message;
 status.classList.toggle("is-error",Boolean(error));
}
function displayDate(value){
 try {return new Date(value).toLocaleString("ko-KR",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});}
 catch {return "";}
}
function levelName(n){
 const list=window.SIA_BRIDGE?.snapshot()?.levels;
 return n+"등급"+(list?.[n-1]?" ("+list[n-1]+")":"");
}
function description(container,message,link){
 container.replaceChildren(element("span","",message));
 if(link){
  const a=element("a","community-login-link","로그인하기");
  a.href="#settings";
  container.append(a);
 }
}
function renderAccess(){
 const me=person();
 for(const [id,feature] of Object.entries(FEATURES)){
  const form=$(feature.form),note=$(feature.notice);
  const threshold=permissions[id]||feature.defaultLevel;
  const allow=Boolean(me.admin||(me.user && me.approved && me.memberLevel>=threshold));
  form.hidden=!allow;
  if(allow){
   note.hidden=true;
   continue;
  }
  note.hidden=false;
  if(!client){
   description(note,"소통 서버에 연결할 수 없습니다.",false);
  }else if(!me.user){
   description(note,"글을 작성하려면 로그인과 관리자 승인이 필요합니다. "+levelName(threshold)+"부터 이용할 수 있습니다. ",true);
  }else if(!me.approved){
   description(note,"가입 승인 대기 중입니다. 관리자 승인 후 이용할 수 있습니다.",false);
  }else{
   description(note,levelName(threshold)+"부터 이용할 수 있습니다.",false);
  }
 }
}
function selectTab(id){
 if(!FEATURES[id])return;
 current=id;
 document.querySelectorAll("[data-community-tab]").forEach(button=>{
  const active=button.dataset.communityTab===id;
  button.classList.toggle("active",active);
  button.setAttribute("aria-selected",String(active));
  button.tabIndex=active?0:-1;
 });
 document.querySelectorAll("[data-community-panel]").forEach(panel=>{
  panel.hidden=panel.dataset.communityPanel!==id;
 });
 renderAccess();
 loadEntries(id);
}
document.querySelectorAll("[data-community-tab]").forEach(button=>{
 button.addEventListener("click",()=>selectTab(button.dataset.communityTab));
 button.addEventListener("keydown",event=>{
  if(!["ArrowLeft","ArrowRight"].includes(event.key))return;
  event.preventDefault();
  const list=Object.keys(FEATURES),position=list.indexOf(current);
  const next=list[(position+(event.key==="ArrowRight"?1:list.length-1))%list.length];
  selectTab(next);
  $("communityTab"+({guestbook:"Guestbook",questions:"Questions",coffee:"Coffee"}[next])).focus();
 });
});

async function readPermissions(){
 if(!client)return;
 const {data,error}=await client.from("community_permissions").select("feature,min_write_level");
 if(error)throw error;
 for(const record of data||[]){
  if(FEATURES[record.feature])permissions[record.feature]=Number(record.min_write_level);
 }
 renderAccess();
}
async function readAdminNames(){
 const me=person();
 displayNames.clear();
 if(!me.admin||!client)return;
 const {data,error}=await client.from("member_profiles").select("id,display_name").limit(500);
 if(error)throw error;
 for(const profile of data||[])displayNames.set(profile.id,profile.display_name||"회원");
}
function authorLabel(row){
 const me=person();
 if(me.admin)return displayNames.get(row.author_id)||"회원";
 if(me.user?.id===row.author_id)return "내 글";
 return "방문 회원";
}
function replyCard(row){
 if(!row.admin_reply)return element("p","community-awaiting","관리자 답변 대기 중");
 const wrap=element("div","community-answer");
 wrap.append(element("strong","","관리자 답변"),element("p","",row.admin_reply));
 if(row.replied_at)wrap.append(element("small","",displayDate(row.replied_at)));
 return wrap;
}
function coffeeState(value){
 return {pending:"검토 중",accepted:"수락",declined:"거절"}[value]||"검토 중";
}
function createReplyEditor(row,id,parent,button){
 const feature=FEATURES[id];
 const wrap=element("form","community-reply-editor");
 const textarea=element("textarea","");
 textarea.rows=3;
 textarea.maxLength=id==="questions"?3000:id==="coffee"?2000:1500;
 textarea.value=row.admin_reply||"";
 textarea.placeholder="답변을 입력하세요.";
 textarea.setAttribute("aria-label","관리자 답변 입력");
 wrap.append(textarea);
 let select=null;
 if(id==="coffee"){
  select=element("select","select");
  [["pending","검토 중"],["accepted","수락"],["declined","거절"]].forEach(([value,label])=>select.add(new Option(label,value)));
  select.value=row.status;
  wrap.append(select);
 }
 const actions=element("div","community-reply-actions");
 const save=element("button","btn small primary","답변 저장");
 save.type="submit";
 const cancel=element("button","btn small","취소");
 cancel.type="button";
 cancel.onclick=()=>{wrap.remove();button.hidden=false;};
 actions.append(save,cancel);wrap.append(actions);
 wrap.onsubmit=async event=>{
  event.preventDefault();
  const reply=textarea.value.trim();
  if(id!=="coffee"&&!reply){updateStatus("답변 내용을 입력해 주세요.",true);return;}
  if(!reply&&select?.value==="pending"){updateStatus("답변이나 처리 상태를 입력해 주세요.",true);return;}
  save.disabled=true;
  const patch={
   admin_reply:reply||null,
   replied_at:reply?new Date().toISOString():null
  };
  if(select)patch.status=select.value;
  try{
   const {data,error}=await client.from(feature.table).update(patch).eq("id",row.id).select("id").single();
   if(error)throw error;
   if(!data)throw Error("변경 내역을 확인할 수 없습니다.");
   updateStatus("관리자 답변을 저장했습니다.");
   await loadEntries(id);
  }catch(error){updateStatus("답변 저장 실패: "+String(error.message||error),true);save.disabled=false;}
 };
 parent.append(wrap);
 button.hidden=true;
 textarea.focus();
}
function makeEntry(row,id){
 const me=person(),owner=me.user?.id===row.author_id;
 const card=element("article","community-entry");
 const heading=element("div","community-entry-heading");
 const name=element("strong","",authorLabel(row));
 const date=element("time","",displayDate(row.created_at));
 heading.append(name,date);
 if(id==="questions"){
  heading.append(element("span","community-visibility",row.is_public?"공개 질문":"비공개 질문"));
 }
 if(id==="coffee"){
  heading.append(element("span","community-request-status "+row.status,coffeeState(row.status)));
 }
 card.append(heading);
 if(id==="questions")card.append(element("h4","community-question-title",row.title));
 if(id==="coffee")card.append(element("p","community-schedule","희망 시간: "+row.preferred_schedule));
 card.append(element("p","community-entry-body",id==="guestbook"?row.body:id==="questions"?row.body:row.message));
 card.append(replyCard(row));

 const actions=element("div","community-entry-actions");
 if(me.admin){
  const edit=element("button","btn small","답변 작성·수정");
  edit.type="button";
  edit.onclick=()=>createReplyEditor(row,id,card,edit);
  actions.append(edit);
 }
 if(me.admin||owner){
  const del=element("button","btn small","삭제");
  del.type="button";
  del.onclick=async()=>{
   if(!window.confirm("이 기록을 삭제할까요? 삭제 후에는 복구할 수 없습니다."))return;
   del.disabled=true;
   try{
    const {data,error}=await client.from(FEATURES[id].table).delete().eq("id",row.id).select("id").single();
    if(error)throw error;
    if(!data)throw Error("삭제된 항목을 확인할 수 없습니다.");
    updateStatus("기록을 삭제했습니다.");
    await loadEntries(id);
   }catch(error){updateStatus("삭제 실패: "+String(error.message||error),true);del.disabled=false;}
  };
  actions.append(del);
 }
 if(actions.children.length)card.append(actions);
 return card;
}
async function loadEntries(id){
 if(!client){updateStatus("소통 서버를 사용할 수 없습니다.",true);return;}
 if(!FEATURES[id])return;
 const sequence=++requestId;
 const feature=FEATURES[id],box=$(feature.list);
 box.replaceChildren(element("p","community-empty","기록을 불러오는 중입니다."));
 try{
  // RLS automatically hides private questions and other members' coffee requests.
  const columns=id==="guestbook"?
   "id,author_id,body,admin_reply,replied_at,created_at":
   id==="questions"?
   "id,author_id,title,body,is_public,admin_reply,replied_at,created_at":
   "id,author_id,preferred_schedule,message,status,admin_reply,replied_at,created_at";
  const {data,error}=await client.from(feature.table).select(columns).order("created_at",{ascending:false}).limit(80);
  if(error)throw error;
  if(sequence!==requestId||id!==current)return;
  box.replaceChildren();
  if(!data?.length){
   box.append(element("p","community-empty",id==="coffee"?"아직 확인할 신청이 없습니다.":"아직 등록된 글이 없습니다."));
  }else{
   for(const row of data)box.append(makeEntry(row,id));
  }
  loaded[id]=true;
  updateStatus(id==="coffee"?"신청 내용은 본인과 관리자에게만 표시됩니다.":id==="questions"?"비공개 질문은 작성자와 관리자만 확인할 수 있습니다.":"방명록은 사이트의 소통 메뉴를 볼 수 있는 방문자에게 공개됩니다.");
 }catch(error){
  if(sequence!==requestId)return;
  box.replaceChildren(element("p","community-empty is-error","목록을 불러오지 못했습니다."));
  updateStatus("소통 기록 조회 실패: "+String(error.message||error),true);
 }
}
async function submitEntry(id,payload,form){
 if(!client){updateStatus("소통 서버가 연결되지 않았습니다.",true);return;}
 const me=person(),requirement=permissions[id];
 if(!me.user||(!me.approved&&!me.admin)||(!me.admin&&me.memberLevel<requirement)){
  updateStatus("이 기능을 사용할 권한이 없습니다.",true);
  renderAccess();
  return;
 }
 const button=form.querySelector('button[type="submit"]');
 button.disabled=true;
 updateStatus("기록을 서버에 저장하는 중입니다.");
 try{
  const {data,error}=await client.from(FEATURES[id].table).insert(payload).select("id").single();
  if(error)throw error;
  if(!data)throw Error("저장된 기록을 확인할 수 없습니다.");
  form.reset();
  updateStatus("정상적으로 등록됐습니다.");
  await loadEntries(id);
 }catch(error){updateStatus("등록 실패: "+String(error.message||error),true);}
 finally{button.disabled=false;}
}
$("guestbookForm").onsubmit=event=>{
 event.preventDefault();
 const body=$("guestbookBody").value.trim();
 if(body.length<1||body.length>700){updateStatus("방명록 내용을 1~700자로 입력해 주세요.",true);return;}
 submitEntry("guestbook",{body},event.currentTarget);
};
$("questionForm").onsubmit=event=>{
 event.preventDefault();
 const title=$("questionTitle").value.trim(),body=$("questionBody").value.trim();
 if(title.length<2||body.length<2){updateStatus("질문 제목과 내용을 작성해 주세요.",true);return;}
 submitEntry("questions",{title,body,is_public:$("questionPublic").checked},event.currentTarget);
};
$("coffeeForm").onsubmit=event=>{
 event.preventDefault();
 const preferred_schedule=$("coffeePreferredTime").value.trim(),message=$("coffeeMessage").value.trim();
 if(preferred_schedule.length<2||message.length<2){updateStatus("희망 시간과 메시지를 입력해 주세요.",true);return;}
 submitEntry("coffee",{preferred_schedule,message},event.currentTarget);
};

async function renderPermissionEditor(){
 const wrap=$("communityPermissionEditor");
 wrap.replaceChildren();
 if(!person().admin)return;
 const levels=window.SIA_BRIDGE?.snapshot()?.levels||["방문자","일반 회원","친구","특별 회원"];
 for(const [id,feature] of Object.entries(FEATURES)){
  const row=element("div","setting-row");
  const label=element("label","",feature.label+" 작성/신청 등급");
  const select=element("select","select");
  for(let i=1;i<Math.max(levels.length,2);i++){
   const n=i+1;
   select.add(new Option(levelName(n),String(n)));
  }
  select.value=String(permissions[id]);
  if(select.selectedIndex<0){
   // Keep an existing threshold visible if the administrator renamed/reduced levels.
   select.add(new Option(levelName(permissions[id]),String(permissions[id])));
   select.value=String(permissions[id]);
  }
  select.onchange=async()=>{
   if(changingPermission)return;
   changingPermission=true;select.disabled=true;
   const value=Number(select.value);
   const {data,error}=await client.from("community_permissions").update({min_write_level:value})
    .eq("feature",id).select("feature,min_write_level").single();
   if(error||!data){
    $("communityPermissionStatus").textContent="등급 설정 실패: "+String(error?.message||"변경할 수 없습니다.");
    select.value=String(permissions[id]);
   }else{
    permissions[id]=value;
    $("communityPermissionStatus").textContent=feature.label+" 이용 가능 등급을 "+levelName(value)+" 이상으로 변경했습니다. 서버에 즉시 적용됐습니다.";
    renderAccess();
   }
   select.disabled=false;changingPermission=false;
  };
  row.append(label,select);
  wrap.append(row);
 }
}
async function refresh(){
 if(!client){renderAccess();updateStatus("소통 서버가 연결되지 않았습니다.",true);return;}
 try{
  await Promise.all([readPermissions(),readAdminNames()]);
  await renderPermissionEditor();
  renderAccess();
  await loadEntries(current);
 }catch(error){updateStatus("소통 기능 초기화 실패: "+String(error.message||error),true);}
}
document.addEventListener("sia:auth",refresh);
document.addEventListener("sia:menu-data-updated",()=>{renderPermissionEditor();renderAccess();});
window.SIA_COMMUNITY={refresh,show:selectTab};
refresh();
})();