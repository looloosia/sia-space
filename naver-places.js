(() => {
"use strict";

const $ = id => document.getElementById(id);
const searchForm = $("naverPlaceSearchForm");
if (!searchForm) return;
const queryInput = $("naverPlaceQuery");
const mapLink = $("naverPlaceMapSearch");
const status = $("naverPlaceSearchStatus");
const results = $("naverPlaceResults");
const button = $("naverPlaceSearchButton");
const fallback = $("naverPlaceFallback");
const linkForm = $("naverPlaceLinkForm");
const client = window.SIA_SUPABASE;
let requestIndex = 0;

function mapSearchUrl(query) {
 return "https://map.naver.com/p/search/" + encodeURIComponent(query.trim());
}
function updateMapLink(){
 const value=queryInput.value.trim();
 mapLink.href=value?mapSearchUrl(value):"https://map.naver.com/";
 mapLink.textContent=value?"네이버 지도에서 '"+value.slice(0,28)+"' 찾기":"네이버 지도 열기";
}
function say(message,error=false){
 status.textContent=message;
 status.classList.toggle("is-error",error);
}
function validNaverUrl(text){
 try{
  const url=new URL(text);
  if(url.protocol!=="https:")return null;
  const hosts=["map.naver.com","naver.me","place.naver.com","m.place.naver.com"];
  return hosts.includes(url.hostname.toLowerCase())?url.href:null;
 }catch{return null;}
}
function selectPlace(place){
 if(!window.SIA_IDENTITY?.admin){
  say("관리자로 로그인한 뒤 장소를 추가할 수 있습니다.",true);
  return;
 }
 document.dispatchEvent(new CustomEvent("sia:naver-place-selected",{detail:place}));
 say("‘"+place.title+"’ 정보를 입력했습니다. 아래에서 공개 등급과 메모를 확인한 후 저장하세요.");
}

queryInput.addEventListener("input",updateMapLink);
updateMapLink();

function presentPlaces(items){
 results.replaceChildren();
 if(!items.length){
  const p=document.createElement("p");p.className="naver-place-no-results";
  p.textContent="검색 결과가 없습니다. 다른 검색어로 시도하거나 네이버 지도 공유 링크를 사용하세요.";
  results.append(p);return;
 }
 for(const info of items.slice(0,5)){
  const title=String(info.title||"").trim().slice(0,120);
  if(!title)continue;
  const address=String(info.address||"").trim().slice(0,300);
  const category=String(info.category||"").trim().slice(0,120);
  const url=validNaverUrl(String(info.mapUrl||""))||mapSearchUrl([title,address].filter(Boolean).join(" "));
  const card=document.createElement("article");card.className="naver-place-result";
  const main=document.createElement("div");main.className="naver-place-result-info";
  const heading=document.createElement("h4");heading.textContent=title;
  main.append(heading);
  if(category){const label=document.createElement("span");label.className="naver-place-category";label.textContent=category;main.append(label);}
  if(address){const p=document.createElement("p");p.textContent=address;main.append(p);}
  card.append(main);
  const actions=document.createElement("div");actions.className="naver-place-result-actions";
  const select=document.createElement("button");select.type="button";select.className="btn primary small";select.textContent="이 장소로 기록하기";
  select.addEventListener("click",()=>selectPlace({title,address,mapUrl:url}));
  const open=document.createElement("a");open.className="btn small";open.target="_blank";open.rel="noopener noreferrer";open.href=url;open.textContent="지도 보기";
  actions.append(select,open);card.append(actions);results.append(card);
 }
}

searchForm.addEventListener("submit",async event=>{
 event.preventDefault();
 const query=queryInput.value.trim();
 if(query.length<2||query.length>100){say("검색어를 2~100자로 입력하세요.",true);return;}
 if(!window.SIA_IDENTITY?.admin){say("장소 검색은 관리자 계정으로 로그인한 뒤 사용할 수 있습니다.",true);return;}
 if(!client){say("서버 연결이 필요합니다. 네이버 지도 공유 링크를 이용해 주세요.",true);fallback.open=true;return;}
 const sequence=++requestIndex;
 button.disabled=true;results.replaceChildren();say("네이버 지역 검색 결과를 가져오는 중입니다.");
 try{
  const {data,error}=await client.functions.invoke("naver-place-search",{body:{query}});
  if(sequence!==requestIndex)return;
  if(error){
   let code="";
   try{
    if(error.context?.json){const response=await error.context.clone().json();code=String(response?.code||"");}
   }catch{}
   if(code==="naver_not_configured"){
    say("네이버 API HUB 인증 키가 아직 설정되지 않았습니다. 네이버 지도에서 직접 검색 후 공유 링크를 등록할 수 있습니다.",true);
    fallback.open=true;return;
   }
   if(code==="admin_required"||code==="login_required"){
    say("네이버 장소 검색은 관리자 계정으로 로그인해야 사용할 수 있습니다.",true);return;
   }
   throw error;
  }
  if(!Array.isArray(data?.items))throw Error("네이버 검색 응답 형식이 올바르지 않습니다.");
  presentPlaces(data.items);
  say(data.items.length+"개의 검색 결과를 불러왔습니다. 원하는 장소를 선택하면 입력란에 정보가 채워집니다.");
 }catch(error){
  if(sequence!==requestIndex)return;
  say("검색 요청을 처리하지 못했습니다. 네이버 지도 공유 링크를 이용하거나 잠시 후 다시 검색해 주세요.",true);
  fallback.open=true;
  console.warn("NAVER place lookup failed:",error);
 }finally{if(sequence===requestIndex)button.disabled=false;}
});

linkForm.addEventListener("submit",event=>{
 event.preventDefault();
 const title=$("naverPlaceLinkTitle").value.trim();
 const mapUrl=validNaverUrl($("naverPlaceLinkUrl").value.trim());
 if(!title||title.length>120){say("장소 이름을 입력해 주세요.",true);return;}
 if(!mapUrl){
  say("네이버 지도(map.naver.com), 네이버 플레이스(place.naver.com), 네이버 공유 링크(naver.me)만 사용할 수 있습니다.",true);
  return;
 }
 selectPlace({title,address:"",mapUrl});
});

window.SIA_NAVER_PLACES={openPlace:selectPlace,updateMapLink};
})();