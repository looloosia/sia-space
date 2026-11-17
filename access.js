(() => {
"use strict";

const $ = id => document.getElementById(id);
const ROUTES = {
 home:"홈",now:"현재 상태",practice:"시간기록",watch:"영화·드라마",
 photos:"사진",books:"책",places:"장소",projects:"프로젝트",music:"음악",
 youtube:"유튜브",wiki:"개인 기록",timeline:"타임라인",
 community:"소통",contact:"연락처",settings:"로그인·회원가입",admin:"관리자 설정"
};
const ARCHIVES = new Set(["watch","photos","books","places","projects","music","youtube","wiki","timeline"]);
const pages = [...document.querySelectorAll(".route-page")];
const phoneQuery = window.matchMedia("(max-width: 760px)");
let nextAfterLogin = null;
let loadError = false;
let previousMobile = phoneQuery.matches;

function selectedRoute() {
 const input = decodeURIComponent(location.hash.slice(1)).toLowerCase();
 if(input==="collections")return "photos";
 if(input==="about")return "home";
 return Object.hasOwn(ROUTES,input)?input:"home";
}
function requireLevel(key) {
 return Math.max(1,Math.min(10,Number(window.SIA_MENU_RULES?.[key]??1)||1));
}
function identity() {
 return window.SIA_IDENTITY||{user:null,admin:false,memberLevel:1};
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
  if(active)a.setAttribute("aria-current","page");
  else a.removeAttribute("aria-current");
 });
 const summary=document.querySelector("#archiveNav summary");
 if(summary)summary.classList.toggle("active",ARCHIVES.has(slug));
 // Archive sub-menu remains open only while selecting from it.
 const archive=$("archiveNav");
 if(archive)archive.open=false;
}
function pageFor(slug){return $(slug);}
function showDesktop(target) {
 for(const page of pages)page.hidden=page!==target;
 const gate=$("accessGate");
 gate.hidden=target!==gate;
}
function showDesktopGate(message,title) {
 $("accessGateTitle").textContent=title||"메뉴 접근 제한";
 $("accessGateMessage").textContent=message;
 $("accessLoginButton").hidden=true;
 showDesktop($("accessGate"));
}
function scrollToSection(slug) {
 const el=pageFor(slug);
 if(!el||el.hidden)return;
 // Avoid the fixed header covering section headings.
 el.scrollIntoView({block:"start",behavior:"auto"});
}
function goLogin(required,slug) {
 const msg=slug==="admin"?
  "관리자 전용 메뉴입니다. 관리자 계정으로 로그인해 주세요.":
  required+"등급부터 조회 가능합니다. 로그인해 주세요.";
 nextAfterLogin=slug;
 noticeLogin(required,msg);
 if(phoneQuery.matches){
  displayMobilePages();
  if(location.hash!=="#settings")location.hash="#settings";
  requestAnimationFrame(()=>scrollToSection("settings"));
 }else{
  showDesktop($("settings"));
  activate("settings");
  if(location.hash!=="#settings")location.hash="#settings";
 }
}

function ensurePlaceholder(section) {
 let placeholder=section.querySelector(".mobile-access-placeholder");
 if(placeholder)return placeholder;
 placeholder=document.createElement("div");
 placeholder.className="mobile-access-placeholder";
 const title=document.createElement("h2");
 title.className="mobile-access-title";
 const message=document.createElement("p");
 message.className="mobile-access-message";
 const button=document.createElement("button");
 button.type="button";
 button.className="btn primary mobile-access-login";
 button.textContent="로그인하기";
 button.onclick=()=>{
  const required=requireLevel(section.dataset.section);
  goLogin(required,section.id);
 };
 placeholder.append(title,message,button);
 section.append(placeholder);
 return placeholder;
}
function mobileSection(section, current) {
 const slug=section.id;
 if(slug==="accessGate"){section.hidden=true;return;}
 if(slug==="admin"){
  section.hidden=!current.admin;
  section.classList.remove("mobile-restricted");
  return;
 }
 section.hidden=false;
 if(slug==="settings"){
  section.classList.remove("mobile-restricted");
  return;
 }
 const ready=Boolean(window.SIA_MENU_READY);
 const denied=!current.admin && (!ready || current.memberLevel<requireLevel(slug));
 section.classList.toggle("mobile-restricted",denied);
 const placeholder=ensurePlaceholder(section);
 placeholder.hidden=!denied;
 if(!denied)return;
 const heading=placeholder.querySelector(".mobile-access-title");
 const message=placeholder.querySelector(".mobile-access-message");
 const login=placeholder.querySelector(".mobile-access-login");
 if(!ready){
  heading.textContent=ROUTES[slug]||"메뉴";
  message.textContent=loadError?"접근 권한을 불러올 수 없습니다. 다시 접속해 주세요.":"접근 권한을 확인하는 중입니다.";
  login.hidden=true;
 }else{
  const required=requireLevel(slug);
  heading.textContent=ROUTES[slug]||"메뉴";
  message.textContent=required+"등급부터 조회 가능합니다.";
  login.hidden=Boolean(current.user);
 }
}
function displayMobilePages() {
 const current=identity();
 pages.forEach(section=>mobileSection(section,current));
 $("accessGate").hidden=true;
}
function renderMobile(navigation=false) {
 const slug=selectedRoute(), current=identity();
 displayMobilePages();
 activate(slug);
 if(slug==="admin" && !current.admin){
  if(!current.user)goLogin(0,"admin");
  else {
   noticeLogin(0,"관리자 계정으로만 이용할 수 있습니다.");
   if(location.hash!=="#settings")location.hash="#settings";
   requestAnimationFrame(()=>scrollToSection("settings"));
  }
  return;
 }
 if(slug!=="settings" && !current.admin && window.SIA_MENU_READY &&
    current.memberLevel<requireLevel(slug) && !current.user && navigation){
  goLogin(requireLevel(slug),slug);
  return;
 }
 if(slug==="settings"&&!nextAfterLogin)noticeLogin(0,"");
 if(navigation){
  requestAnimationFrame(()=>scrollToSection(slug));
 }
}
function renderDesktop() {
 const slug=selectedRoute(),current=identity();
 if(slug==="settings"){
  showDesktop($("settings"));activate(slug);
  if(!nextAfterLogin)noticeLogin(0,"");
  return;
 }
 if(slug==="admin"){
  if(current.admin){
   showDesktop($("admin"));activate(slug);noticeLogin(0,"");
  }else if(!current.user){
   goLogin(0,"admin");
  }else{
   showDesktopGate("관리자 계정으로만 이용할 수 있습니다.","관리자 전용 메뉴");
   activate(slug);
  }
  return;
 }
 if(current.admin){
  noticeLogin(0,"");showDesktop(pageFor(slug));activate(slug);
  return;
 }
 if(!window.SIA_MENU_READY){
  showDesktopGate(loadError?
   "서버에서 접근 권한을 확인하지 못했습니다. 새로고침해 주세요.":
   "서버에서 메뉴 접근 권한을 확인하는 중입니다.","접근 권한 확인");
  activate(slug);return;
 }
 const required=requireLevel(slug);
 if(current.memberLevel>=required){
  nextAfterLogin=null;
  noticeLogin(0,"");showDesktop(pageFor(slug));activate(slug);
  return;
 }
 if(!current.user){
  goLogin(required,slug);
  return;
 }
 showDesktopGate(required+"등급부터 조회 가능합니다.","이 메뉴는 접근 제한이 있습니다.");
 activate(slug);
}
function render(navigation=false) {
 if(phoneQuery.matches)renderMobile(navigation);
 else renderDesktop();
}
function identityUpdated() {
 const me=identity();
 if(me.user && nextAfterLogin && (window.SIA_MENU_READY||me.admin)){
  const path=nextAfterLogin;nextAfterLogin=null;
  noticeLogin(0,"");
  location.hash="#"+path;
  render(true);
  return;
 }
 render(false);
}
$("accessLoginButton").onclick=()=>{
 nextAfterLogin=selectedRoute();location.hash="#settings";render(true);
};
$("accessBackButton").onclick=()=>{location.hash="#home";render(true);};
$("adminPublishShortcut").onclick=()=>{
 if(identity().admin)$("cloudPublish")?.click();
};
$("adminCloudLoadShortcut").onclick=()=>{
 if(identity().admin)$("cloudLoad")?.click();
};

window.addEventListener("hashchange",()=>{
 render(true);
 if(!phoneQuery.matches)requestAnimationFrame(()=>window.scrollTo({top:0,behavior:"auto"}));
});
document.addEventListener("sia:auth",identityUpdated);
document.addEventListener("sia:menu-rules",()=>{
 loadError=false;identityUpdated();
});
document.addEventListener("sia:menu-data-updated",()=>render(false));
document.addEventListener("sia:menu-error",()=>{loadError=true;render(false);});
function onBreakpointChanged(){
 if(phoneQuery.matches===previousMobile)return;
 previousMobile=phoneQuery.matches;
 render(false);
 if(!phoneQuery.matches)window.scrollTo({top:0,behavior:"auto"});
}
if(phoneQuery.addEventListener)phoneQuery.addEventListener("change",onBreakpointChanged);
else phoneQuery.addListener(onBreakpointChanged);
window.SIA_ACCESS={
 navigate:slug=>{if(Object.hasOwn(ROUTES,slug))location.hash="#"+slug;},
 refresh:()=>render(false)
};
render(phoneQuery.matches && Boolean(location.hash));
})();