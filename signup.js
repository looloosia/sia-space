(() => {
"use strict";
const $=id=>document.getElementById(id);
const authButtons={login:$("authLoginMode"),signup:$("authSignupMode")};
function notice(text){$("cloudStatus").textContent=text;}
function setMode(signup){
 window.SIA_SIGNUP_MODE=Boolean(signup);
 const anonymous=!window.SIA_IDENTITY?.user;
 $("cloudLoginForm").hidden=!anonymous||signup;
 $("cloudSignupForm").hidden=!anonymous||!signup;
 authButtons.login.classList.toggle("primary",!signup);
 authButtons.signup.classList.toggle("primary",signup);
}
authButtons.login.addEventListener("click",()=>setMode(false));
authButtons.signup.addEventListener("click",()=>setMode(true));
// Direct signup link: /sia-space/?signup=1#settings
if(new URLSearchParams(window.location.search).get("signup")==="1")setMode(true);
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
 if(!window.SIA_SUPABASE){notice("Supabase 프로젝트가 아직 연결되지 않았습니다.");return;}
 if(window.SIA_IDENTITY?.user){notice("로그아웃한 뒤 가입 신청을 진행하세요.");return;}
 const name=$("signupName").value.trim(),email=$("signupEmail").value.trim();
 const password=$("signupPassword").value,again=$("signupPasswordConfirm").value;
 if(name.length<2||name.length>30){notice("표시 이름은 2~30자로 입력하세요.");return;}
 if(password.length<8||password!==again){notice("비밀번호는 8자 이상이어야 하며 확인란과 일치해야 합니다.");return;}
 const submit=event.currentTarget.querySelector("button[type=submit]");submit.disabled=true;
 notice("회원가입 신청을 처리하는 중입니다.");
 try{
  const {data,error}=await window.SIA_SUPABASE.auth.signUp({
   email,password,
   options:{
    data:{display_name:name},
    emailRedirectTo:"https://looloosia.github.io/sia-space/"
   }
  });
  if(error)throw error;
  $("signupPassword").value="";$("signupPasswordConfirm").value="";
  if(data.session){
   notice("가입 신청이 접수됐습니다. 관리자 승인 전에는 1등급으로만 이용할 수 있습니다.");
   window.location.reload();
   return;
  }
  setMode(false);
  notice("가입 신청을 접수했습니다. 이메일 인증 메일을 확인하세요. 인증 후에도 관리자 승인이 필요합니다.");
 }catch(error){notice("가입 신청 실패: "+String(error.message||error));}
 finally{submit.disabled=false;}
});
document.addEventListener("sia:auth",()=>{
 const me=window.SIA_IDENTITY;
 if(me?.user)setMode(false);
 if(me?.admin)fetchProfiles();
});
})();