(() => {
"use strict";

const $=id=>document.getElementById(id);
const ROUTES={
 home:"홈",now:"현재 상태",practice:"연습 기록",watch:"영화·드라마",
 photos:"사진",books:"책",places:"장소",projects:"프로젝트",music:"음악",
 youtube:"유튜브",wiki:"개인 위키",timeline:"타임라인",
 community:"소통",contact:"연락처",settings:"로그인·회원가입",admin:"관리자 설정"
};
const ARCHIVES=new Set(["photos","books","places","projects","music","youtube","wiki","timeline"]);
const pages=[...document.querySelectorAll(".route-page")];
let nextAfterLogin=null,loadError=false;

function selectedRoute() {
 const input=decodeURIComponent(location.hash.slice(1)).toLowerCase();
 if(input==="collections") return "photos";
 if(input==="about") return "home";
 return Object.hasOwn(ROUTES,input)?input:"home";
}
function requireLevel(key) {
 const rules=window.SIA_MENU_RULES;
 return Math.max(1,Math.min(10,Number(rules?.[key]??1)||1));
}
function identity() {return window.SIA_IDENTITY||{user:null,admin:false,memberLevel:1};}
function labelFor(level) {
 const levels=window.SIA_BRIDGE?.snapshot()?.levels||[];
 return String(level)+"등급"+(levels[level-1]?" ("+levels[level-1]+")":"");
}
function show(target) {
 for(const el of pages)el.hidden=el!==target;
 const gate=$("accessGate");
 if(gate)gate.hidden=target!==gate;
}
function noticeLogin(level,text) {
 const banner=$("loginGateNotice");
 if(!banner)return;
 banner.hidden=!text;
 banner.textContent=text||"";
 if(level>1)banner.dataset.level=String(level);
 else delete banner.dataset.level;
}
function activate(slug) {
 document.querySelectorAll('#mainNav a[href^="#"]').forEach(a=>{
  const active=a.getAttribute("href")==="#"+slug;
  a.classList.toggle("active",active);
  if(active)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current");
 });
 const summary=document.querySelector("#archiveNav summary");
 if(summary)summary.classList.toggle("active",ARCHIVES.has(slug));
 const details=$("archiveNav");
 if(details)details.open=false;
}
function gate(message,title,showLogin) {
 const panel=$("accessGate");
 $("accessGateTitle").textContent=title||"메뉴 접근 제한";
 $("accessGateMessage").textContent=message;
 $("accessLoginButton").hidden=!showLogin;
 show(panel);
}
function goLogin(required,slug) {
 const msg=slug==="admin"
  ?"관리자 전용 메뉴입니다. 관리자 계정으로 로그인해 주세요."
  :required+"등급부터 조회 가능합니다. 로그인해 주세요.";
 nextAfterLogin=slug;
 noticeLogin(required,msg);
 if(location.hash!=="#settings") {
  location.hash="#settings";
 } else {
  show($("settings"));
  activate("settings");
 }
}
function render(){
 const slug=selectedRoute();
 const current=identity();
 if(slug==="settings") {
  show($("settings"));activate(slug);
  if(!nextAfterLogin)noticeLogin(0,"");
  return;
 }
 if(slug==="admin") {
  if(current.admin){show($("admin"));activate(slug);noticeLogin(0,"");}
  else if(!current.user){goLogin(0,"admin");}
  else{gate("관리자 계정으로만 이용할 수 있습니다.","관리자 전용 메뉴",false);activate(slug);}
  return;
 }
 if(current.admin) {
  noticeLogin(0,"");show($(slug));activate(slug);return;
 }
 if(!window.SIA_MENU_READY){
  gate(loadError?"서버에서 접근 권한을 확인하지 못했습니다. 페이지를 새로고침해 주세요.":"서버에서 메뉴 접근 권한을 확인하는 중입니다.","접근 권한 확인",false);
  activate(slug);return;
 }
 const required=requireLevel(slug);
 if(current.memberLevel>=required) {
  noticeLogin(0,"");show($(slug));activate(slug);return;
 }
 if(!current.user) {
  goLogin(required,slug);
  return;
 }
 gate(required+"등급부터 조회 가능합니다.","이 메뉴는 접근 제한이 있습니다.",false);
 activate(slug);
}
function identityUpdated(){
 const me=identity();
 if(me.user&&nextAfterLogin&&(window.SIA_MENU_READY||me.admin)){
  const path=nextAfterLogin;nextAfterLogin=null;
  noticeLogin(0,"");
  location.hash="#"+path;
  render();
  return;
 }
 render();
}
$("accessLoginButton").onclick=()=>{nextAfterLogin=selectedRoute();location.hash="#settings";render();};
$("accessBackButton").onclick=()=>{location.hash="#home";render();};
window.addEventListener("hashchange",render);
document.addEventListener("sia:auth",identityUpdated);
document.addEventListener("sia:menu-rules",()=>{
 loadError=false;
 identityUpdated();
});
document.addEventListener("sia:menu-data-updated",render);
document.addEventListener("sia:menu-error",()=>{loadError=true;render();});
window.SIA_ACCESS={navigate:slug=>{if(Object.hasOwn(ROUTES,slug))location.hash="#"+slug;},refresh:render};
render();
})();