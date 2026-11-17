(()=>{
"use strict";
const $=id=>document.getElementById(id);
const photoKey="sia-space-hero-photo-v1";
function say(message){const e=$("heroImageStatus");if(e)e.textContent=message;}
function publishPhoto(url) {
 document.dispatchEvent(new CustomEvent("sia:photo-local-change",{detail:{url}}));
}
function validHttps(value){try{const u=new URL(value);return u.protocol==="https:"?u.href:null;}catch{return null;}}
function setPhoto(source){
 const image=$("heroPhoto"),placeholder=$("heroPhotoPlaceholder");
 if(!source){image.hidden=true;image.removeAttribute("src");placeholder.hidden=false;return;}
 image.onload=()=>{image.hidden=false;placeholder.hidden=true;};
 image.onerror=()=>{image.hidden=true;placeholder.hidden=false;say("이미지를 불러오지 못했습니다. 다른 사진을 사용하세요.");};
 image.src=source;
}
try{setPhoto(localStorage.getItem(photoKey)||"");}catch{setPhoto("");}
document.addEventListener("sia:photo-sync",e=>setPhoto(e.detail?.url||""));
$("heroUrlSave").addEventListener("click",()=>{
 const value=$("heroImageUrl").value.trim(),url=validHttps(value);
 if(!url){say("https:// 로 시작하는 이미지 주소를 입력하세요.");return;}
 try{localStorage.setItem(photoKey,url);setPhoto(url);say("대표 사진을 서버에 저장하는 중입니다.");publishPhoto(url);}
 catch{say("브라우저 저장 공간에 사진을 저장할 수 없습니다.");}
});
$("heroImageClear").addEventListener("click",()=>{
 try{localStorage.removeItem(photoKey);}catch{}
 $("heroImageUrl").value="";$("heroImageFile").value="";setPhoto("");say("대표 사진 제거를 서버에 반영하는 중입니다.");publishPhoto("");
});
$("heroImageFile").addEventListener("change",async e=>{
 const file=e.target.files?.[0];if(!file)return;
 if(!/^image\/(jpeg|png|webp|avif)$/.test(file.type)){say("JPG, PNG, WebP 또는 AVIF 사진만 업로드할 수 있습니다.");return;}
 if(file.size>12*1024*1024){say("12MB 이하의 이미지를 선택하세요.");return;}
 const temp=URL.createObjectURL(file);
 try{
  const img=new Image();
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=temp;});
  const scale=Math.min(1,1600/img.naturalWidth,1100/img.naturalHeight);
  const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
  const ctx=canvas.getContext("2d");if(!ctx)throw Error("이미지를 변환할 수 없습니다.");
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  const data=canvas.toDataURL("image/jpeg",.8);
  localStorage.setItem(photoKey,data);setPhoto(data);
  $("heroImageUrl").value="";say("대표 사진을 서버에 업로드하는 중입니다.");publishPhoto(data);
 }catch(err){say("사진 저장에 실패했습니다. 더 작은 이미지를 선택하거나 이미지 주소를 사용하세요.");}
 finally{URL.revokeObjectURL(temp);e.target.value="";}
});
function resultItem({title,posterUrl,source,sourceUrl,year}){
 if(!validHttps(posterUrl))return null;
 const b=document.createElement("button");b.type="button";b.className="poster-result";
 const img=document.createElement("img");img.src=posterUrl;img.alt=title+" 이미지";img.loading="lazy";
 const label=document.createElement("span");label.textContent=title+(year?" ("+year+")":"");
 b.append(img,label);
 b.addEventListener("click",()=>{
  $("watchPoster").value=posterUrl;$("watchPosterSource").value=source;$("watchPosterSourceUrl").value=sourceUrl||"";
  $("posterSearchStatus").textContent="선택됨: "+title+" · 감상 기록을 저장하면 포스터도 함께 저장됩니다.";
  $("posterResults").querySelectorAll("button").forEach(el=>el.classList.remove("selected"));
  b.classList.add("selected");
 });
 return b;
}
async function fetchWithTimeout(url){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
 try{const response=await fetch(url,{signal:controller.signal,headers:{"Accept":"application/json"}});if(!response.ok)throw Error("HTTP "+response.status);return await response.json();}
 finally{clearTimeout(timer);}
}
async function searchTVMaze(title){
 const data=await fetchWithTimeout("https://api.tvmaze.com/search/shows?q="+encodeURIComponent(title));
 return (Array.isArray(data)?data:[]).map(r=>r.show).filter(x=>x&&x.image?.medium).slice(0,15).map(s=>({title:s.name,posterUrl:s.image.original||s.image.medium,source:"tvmaze",sourceUrl:s.url,year:(s.premiered||"").slice(0,4)}));
}
async function searchApple(title){
 const endpoint="https://itunes.apple.com/search?media=movie&entity=movie&country=KR&limit=15&term="+encodeURIComponent(title);
 const data=await fetchWithTimeout(endpoint);
 return (data.results||[]).filter(r=>r.artworkUrl100).slice(0,15).map(r=>({
  title:r.trackName||r.collectionName||"제목 없음",
  posterUrl:String(r.artworkUrl100).replace(/^http:/,"https:").replace(/100x100[^.]*\./,"600x600bb."),
  source:"itunes",sourceUrl:r.trackViewUrl||r.collectionViewUrl||"itunes.apple.com",year:(r.releaseDate||"").slice(0,4)
 }));
}
$("posterSearch").addEventListener("click",async()=>{
 const title=$("watchTitle").value.trim(),kind=$("watchKind").value;
 if(title.length<2){$("posterSearchStatus").textContent="작품 제목을 두 글자 이상 입력하세요.";return;}
 const button=$("posterSearch"),results=$("posterResults"),status=$("posterSearchStatus");
 button.disabled=true;status.textContent="포스터 검색 중…";results.replaceChildren();
 try{
  let list=null,source="";
  if(typeof window.SIA_TMDB_SEARCH==="function"){
   try{list=await window.SIA_TMDB_SEARCH(title,kind);if(list.length)source="TMDB";}
   catch{list=null;}
  }
  if(!list?.length){list=kind==="드라마"?await searchTVMaze(title):await searchApple(title);source=kind==="드라마"?"TVmaze":"Apple iTunes";}
  const rendered=list.map(resultItem).filter(Boolean);
  if(!rendered.length)status.textContent="검색 결과가 없습니다. 포스터 주소를 직접 입력할 수 있습니다.";
  else{results.append(...rendered);status.textContent=rendered.length+"개 후보 · 정확한 작품을 선택하세요. 출처: "+source;}
 }catch(e){status.textContent="검색 API가 응답하지 않습니다. 잠시 후 다시 시도하거나 포스터 주소를 직접 입력하세요.";}
 finally{button.disabled=false;}
});
})();