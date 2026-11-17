(() => {
"use strict";
const $ = id => document.getElementById(id);
const client = window.SIA_SUPABASE;
const PENDING_KEY = "sia-space-signup-pending-email-v1";
const AUTH_RETURN = "https://looloosia.github.io/sia-space/";
const buttons = {login:$("authLoginMode"), signup:$("authSignupMode")};
const steps = [$("authStep1"),$("authStep2"),$("authStep3")];
let renderNumber=0;
const notice=text=>{$("cloudStatus").textContent=text;};

function pendingEmail() {
  try {return localStorage.getItem(PENDING_KEY)||"";}catch{return "";}
}
function savePendingEmail(email) {
  try {if(email)localStorage.setItem(PENDING_KEY,email);else localStorage.removeItem(PENDING_KEY);}catch{}
}
function setMode(signup) {
  window.SIA_SIGNUP_MODE=Boolean(signup);
  const anonymous=!window.SIA_IDENTITY?.user;
  $("cloudLoginForm").hidden=!anonymous||signup;
  $("cloudSignupForm").hidden=!anonymous||!signup;
  buttons.login.classList.toggle("primary",!signup);
  buttons.signup.classList.toggle("primary",signup);
  renderProgress();
}
buttons.login.onclick=()=>setMode(false);
buttons.signup.onclick=()=>setMode(true);

function paintProgress(stage,email,approved,admin) {
  const panel=$("signupProgress");
  panel.hidden=stage==="hidden";
  if(panel.hidden)return;
  steps.forEach((element,index)=>{
    element.classList.toggle("done",index < (stage==="entry"?0:stage==="pending"?1:stage==="verified"?2:3));
    element.classList.toggle("active",index === (stage==="entry"?0:stage==="pending"?1:stage==="verified"?2:-1));
  });
  const title=$("authProgressHeading");
  const detail=$("authProgressText");
  const address=$("authProgressEmail");
  address.hidden=!email;
  address.textContent=email?("가입 이메일: "+email):"";
  $("checkEmailVerification").hidden=stage!=="pending"&&stage!=="unverified";
  $("resendSignupEmail").hidden=stage!=="pending";
  $("authProgressLogin").hidden=stage!=="pending"&&stage!=="unverified";
  $("openGmail").hidden=stage!=="pending"||!email.toLowerCase().endsWith("@gmail.com");
  if(stage==="entry") {
    title.textContent="1단계 · 가입 신청";
    detail.textContent="이름, 이메일과 비밀번호를 입력하세요. 신청하면 이메일 인증 단계로 넘어갑니다.";
  } else if(stage==="pending") {
    title.textContent="2단계 · 인증 메일을 확인해 주세요";
    detail.textContent="이메일 받은편지함과 스팸함에서 인증 메일을 열고 '이메일 인증' 링크를 누르세요. 링크를 누르면 SIA SPACE로 돌아옵니다. 복귀 후에도 완료 표시가 없으면 아래에서 인증 상태를 확인하거나 로그인하세요.";
  } else if(stage==="unverified") {
    title.textContent="2단계 · 이메일 인증 대기";
    detail.textContent="아직 이메일 인증 완료가 확인되지 않았습니다. 메일의 인증 링크를 눌러 주세요.";
  } else if(stage==="verified") {
    title.textContent="이메일 인증 완료 · 관리자 승인 대기";
    detail.textContent="이메일 주소가 Supabase에서 인증된 것을 확인했습니다. 운영자가 승인하면 회원 전용 내용을 열람할 수 있습니다. 현재는 1등급 방문자 권한입니다.";
  } else if(stage==="approved") {
    title.textContent=admin?"이메일 인증 완료 · 관리자 계정":"이메일 인증 및 회원 승인 완료";
    detail.textContent=admin?"관리자 인증이 완료됐습니다. 사이트 설정과 콘텐츠를 수정할 수 있습니다.":"이메일 인증과 운영자 승인이 모두 완료됐습니다. 현재 등급의 콘텐츠를 이용할 수 있습니다.";
  }
}

async function renderProgress() {
  const sequence=++renderNumber;
  if(!client) {
    paintProgress(window.SIA_SIGNUP_MODE?"entry":"hidden","",false,false);
    return;
  }
  let authUser=null;
  try {
    const response=await client.auth.getUser();
    authUser=response.error?null:response.data.user;
  } catch {authUser=null;}
  if(sequence!==renderNumber)return;
  const identity=window.SIA_IDENTITY;
  const pending=pendingEmail();
  if(authUser) {
    const verified=Boolean(authUser.email_confirmed_at||authUser.confirmed_at);
    if(verified) {
      savePendingEmail("");
      const isSame=identity?.user?.id===authUser.id;
      const isApproved=Boolean(isSame && (identity.approved || identity.admin));
      paintProgress(isApproved?"approved":"verified",authUser.email||"",isApproved,Boolean(identity?.admin&&isSame));
      if(!isSame){
        $("authProgressHeading").textContent="이메일 인증 완료 · 회원 권한 확인 중";
        $("authProgressText").textContent="Supabase에서 이메일 인증을 확인했습니다. 계정의 회원 등급을 확인하고 있습니다.";
      }
    }else{
      paintProgress("unverified",authUser.email||pending,false,false);
    }
  } else if(pending) {
    paintProgress("pending",pending,false,false);
  } else if(window.SIA_SIGNUP_MODE) {
    paintProgress("entry","",false,false);
  } else if(new URLSearchParams(location.search).get("auth")==="verified") {
    paintProgress("unverified","",false,false);
  } else {
    paintProgress("hidden","",false,false);
  }
}

$("checkEmailVerification").onclick=async()=>{
  $("checkEmailVerification").disabled=true;
  notice("이메일 인증 상태를 확인하고 있습니다.");
  try {
    const {data,error}=await client.auth.getUser();
    await renderProgress();
    if(error||!data.user) {
      notice("이 브라우저에 로그인된 세션이 없습니다. 인증 메일의 링크를 누른 뒤 홈페이지로 돌아오거나, 이메일 인증을 마쳤다면 로그인해 주세요.");
    } else if(data.user.email_confirmed_at||data.user.confirmed_at) {
      notice("이메일 인증 완료가 확인됐습니다.");
    } else {
      notice("이메일 인증을 아직 완료하지 않았습니다. 메일에서 인증 링크를 확인해 주세요.");
    }
  } catch(error) {notice("인증 확인에 실패했습니다: "+String(error.message||error));}
  finally {$("checkEmailVerification").disabled=false;}
};
$("authProgressLogin").onclick=()=>{
 setMode(false);
 $("cloudEmail").value=pendingEmail();
 $("cloudEmail").focus();
};
$("resendSignupEmail").onclick=async()=>{
 const email=pendingEmail();
 if(!email||!client){notice("먼저 회원가입 신청을 진행하세요.");return;}
 const button=$("resendSignupEmail");button.disabled=true;
 notice("인증 메일을 다시 요청하는 중입니다.");
 try {
  const {error}=await client.auth.resend({
    type:"signup", email, options:{emailRedirectTo:AUTH_RETURN}
  });
  if(error)throw error;
  notice("인증 메일 재발송을 요청했습니다. 받은편지함과 스팸함을 확인하세요.");
 }catch(error){
  notice("인증 메일 재발송 실패: "+String(error.message||error));
 }finally{button.disabled=false;}
};

if(new URLSearchParams(location.search).get("signup")==="1") {
  window.SIA_SIGNUP_MODE=true;
  $("cloudLoginForm").hidden=true;
  $("cloudSignupForm").hidden=false;
  buttons.login.classList.remove("primary");
  buttons.signup.classList.add("primary");
}
function statusCard(value){const p=document.createElement("p");p.className="muted";p.textContent=value;return p;}
async function fetchProfiles(){
 const state=window.SIA_IDENTITY,client=window.SIA_SUPABASE,container=$("memberApprovals");
 if(!state?.admin||!client)return;
 container.replaceChildren(statusCard("회원 목록을 불러오는 중입니다."));
 const {data,error}=await client.from("member_profiles")
  .select("id,display_name,member_level,is_approved,is_admin,created_at")
  .order("created_at",{ascending:false}).limit(300);
 if(error){container.replaceChildren(statusCard("회원 목록 오류: "+error.message));return;}
 container.replaceChildren();
 if(!data.length){container.append(statusCard("아직 가입한 회원이 없습니다."));return;}
 const levelNames=window.SIA_BRIDGE?.snapshot()?.levels??["일반 방문자","일반 회원","친구","특별 회원"];
 for(const profile of data){
  const row=document.createElement("div");row.className="member-row";
  const text=document.createElement("div"),name=document.createElement("strong"),caption=statusCard("");
  name.textContent=String(profile.display_name||"회원");
  const date=new Date(profile.created_at).toLocaleDateString("ko-KR");
  caption.textContent=(profile.is_admin?"관리자":profile.is_approved?"승인됨 · "+profile.member_level+"등급":"승인 대기")+" · "+date+" · "+profile.id.slice(0,8);
  text.append(name,caption);row.append(text);
  if(!profile.is_admin){
   const actions=document.createElement("div");actions.className="member-actions";
   const select=document.createElement("select");select.className="select";
   levelNames.forEach((level,i)=>{if(i>0)select.add(new Option((i+1)+"등급 · "+level,String(i+1)));});
   if(select.options.length===0)select.add(new Option("2등급 · 일반 회원","2"));
   select.value=String(profile.member_level>=2?profile.member_level:2);
   const approve=document.createElement("button");approve.type="button";approve.className="btn small primary";approve.textContent=profile.is_approved?"등급 저장":"승인";
   const revoke=document.createElement("button");revoke.type="button";revoke.className="btn small";revoke.textContent="승인 취소";revoke.disabled=!profile.is_approved;
   approve.onclick=async()=>{await updateProfile(profile.id,{member_level:Number(select.value),is_approved:true},approve);};
   revoke.onclick=async()=>{if(confirm("이 회원을 미승인 상태로 되돌릴까요?"))await updateProfile(profile.id,{member_level:1,is_approved:false},revoke);};
   actions.append(select,approve,revoke);row.append(actions);
  }
  container.append(row);
 }
}
async function updateProfile(id,patch,button){
 if(!window.SIA_IDENTITY?.admin)return;
 const client=window.SIA_SUPABASE;
 button.disabled=true;
 const {error}=await client.from("member_profiles").update(patch).eq("id",id);
 if(error){notice("회원 등급 변경 실패: "+error.message);button.disabled=false;return;}
 notice(patch.is_approved?"회원 승인을 저장했습니다.":"회원 승인을 취소했습니다.");
 await fetchProfiles();
}
$("reloadMembers").onclick=fetchProfiles;
$("cloudSignupForm").addEventListener("submit",async event=>{
  event.preventDefault();
  if(!client){notice("현재 가입 서버가 연결되지 않았습니다.");return;}
  if(window.SIA_IDENTITY?.user){notice("이미 로그인된 계정이 있습니다. 로그아웃 후 신청하세요.");return;}
  const name=$("signupName").value.trim(),email=$("signupEmail").value.trim().toLowerCase();
  const password=$("signupPassword").value,again=$("signupPasswordConfirm").value;
  if(name.length<2||name.length>30){notice("이름은 2~30자로 입력하세요.");return;}
  if(password.length<8||password!==again){notice("비밀번호가 8자 이상인지, 비밀번호 확인과 일치하는지 확인하세요.");return;}
  const submit=event.currentTarget.querySelector('button[type="submit"]');
  submit.disabled=true;
  notice("가입 신청 중입니다. 신청 후에는 인증 메일을 확인해야 합니다.");
  try {
    const {data,error}=await client.auth.signUp({
      email,password,
      options:{data:{display_name:name},emailRedirectTo:AUTH_RETURN}
    });
    if(error)throw error;
    $("signupPassword").value="";
    $("signupPasswordConfirm").value="";
    savePendingEmail(email);
    setMode(false);
    await renderProgress();
    if(data.session) {
      notice("가입 요청을 접수했습니다. 로그인 상태가 확인됐으며, 실제 이메일 인증 여부를 확인하고 있습니다.");
    } else {
      notice("가입 신청을 접수했습니다. 이메일 인증이 필요합니다. 위 안내에 따라 메일을 확인해 주세요.");
    }
  }catch(error){
    notice("가입 신청 실패: "+String(error.message||error)+". 이메일 주소와 인증 메일 발송 설정을 확인해 주세요.");
  }finally{submit.disabled=false;}
});

document.addEventListener("sia:auth",()=>{
  const identity=window.SIA_IDENTITY;
  if(identity?.user)setMode(false);
  if(identity?.admin)fetchProfiles();
  renderProgress();
});
client?.auth.onAuthStateChange((event,_session)=>{
  const wasAwaitingEmail=Boolean(pendingEmail());
  setTimeout(()=>{
    renderProgress();
    if(event==="SIGNED_IN" && wasAwaitingEmail) {
      location.hash="#settings";
    }
  },0);
});
renderProgress();
if(new URLSearchParams(location.search).get("auth")==="verified"){
  location.hash="#settings";
}
})();