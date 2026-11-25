(() => {
"use strict";

const BUCKET="sia-record-media";
const picker=document.getElementById("recordPhotoFile");
if(!picker)return;
const preview=document.getElementById("recordPhotoPreview");
const previewImage=document.getElementById("recordPhotoPreviewImage");
const previewName=document.getElementById("recordPhotoPreviewName");
const remove=document.getElementById("recordPhotoRemove");
const status=document.getElementById("recordPhotoStatus");
const signedCache=new Map();
let currentPath="",removeCurrent=false,chosenFile=null,previewURL="",uploading=false;
let generation=0,lastUploaded=null;

const server=()=>window.SIA_SUPABASE;
function message(s,isError=false){status.textContent=s||"";status.classList.toggle("is-error",isError);}
function revokePreview(){
 if(previewURL){URL.revokeObjectURL(previewURL);previewURL="";}
}
function resetPreview(){
 revokePreview();
 preview.hidden=true;previewImage.removeAttribute("src");previewName.textContent="";
}
function validPath(path){
 return typeof path==="string"&&/^[a-z0-9_-]{4,100}\/[0-9a-f-]{36}\.jpg$/i.test(path);
}
async function signedLink(path){
 if(!validPath(path))throw Error("사진 파일 경로가 올바르지 않습니다.");
 const cached=signedCache.get(path);
 if(cached&&cached.expires>Date.now()+15000)return cached.url;
 const api=server();
 if(!api)throw Error("사진 서버 연결이 필요합니다.");
 const {data,error}=await api.storage.from(BUCKET).createSignedUrl(path,300);
 if(error)throw error;
 if(!data?.signedUrl)throw Error("사진 미리보기를 가져올 수 없습니다.");
 signedCache.set(path,{url:data.signedUrl,expires:Date.now()+300000});
 return data.signedUrl;
}
async function showExisting(path,turn){
 try{
  const url=await signedLink(path);
  if(generation!==turn||removeCurrent||chosenFile)return;
  previewImage.src=url;previewName.textContent="현재 저장된 사진";
  preview.hidden=false;
 }catch(error){
  if(generation===turn)message("기존 사진을 불러오지 못했습니다. 다시 로그인하거나 새로고침해 주세요.",true);
 }
}
function initForm(imagePath=""){
 generation++;
 chosenFile=null;lastUploaded=null;
 picker.value="";
 currentPath=validPath(imagePath)?imagePath:"";
 removeCurrent=false;
 resetPreview();
 remove.hidden=!currentPath;
 message(currentPath?"저장된 사진을 유지하거나 새 사진으로 교체할 수 있습니다.":"휴대폰에서 사진을 선택하면 저장할 때 자동 업로드합니다.");
 if(currentPath)void showExisting(currentPath,generation);
}
function typeAllowed(file){
 const t=String(file?.type||"").toLowerCase();
 const ext=String(file?.name||"").toLowerCase();
 return /^image\/(jpeg|png|webp|heic|heif)$/.test(t) ||
   /\.(jpe?g|png|webp|heic|heif)$/.test(ext);
}
picker.addEventListener("change",()=>{
 generation++;
 chosenFile=picker.files?.[0]||null;lastUploaded=null;
 resetPreview();
 if(!chosenFile){
  removeCurrent=false;
  remove.hidden=!currentPath;
  if(currentPath)void showExisting(currentPath,generation);
  else message("");
  return;
 }
 if(!typeAllowed(chosenFile)){
  message("JPG, PNG, WEBP 또는 iPhone 사진(HEIC) 파일을 선택해 주세요.",true);
  chosenFile=null;picker.value="";return;
 }
 if(chosenFile.size>52428800){
  message("선택한 사진이 50MB를 초과합니다. 더 작은 사진을 골라 주세요.",true);
  chosenFile=null;picker.value="";return;
 }
 removeCurrent=false;
 previewURL=URL.createObjectURL(chosenFile);
 previewImage.src=previewURL;
 previewName.textContent=chosenFile.name+" · 저장 시 크기를 줄여 업로드";
 preview.hidden=false;
 remove.hidden=false;
 message("사진이 선택됐습니다. 아래의 기록 ‘저장’ 버튼을 누르면 업로드됩니다.");
});
remove.addEventListener("click",()=>{
 generation++;
 chosenFile=null;lastUploaded=null;
 picker.value="";
 removeCurrent=true;
 resetPreview();
 remove.hidden=true;
 message("사진 첨부를 제거하도록 설정했습니다. 기록을 저장하면 적용됩니다.");
});

function loadToImage(file){
 return new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(file),img=new Image();
  let settled=false;
  const done=(error)=>{
   if(settled)return;
   settled=true;
   URL.revokeObjectURL(url);
   if(error)reject(error);else resolve(img);
  };
  img.onload=()=>done(null);
  img.onerror=()=>done(Error("사진 형식을 열 수 없습니다. HEIC 형식이라면 휴대폰에서 JPG로 내보낸 후 다시 선택해 주세요."));
  img.src=url;
 });
}
async function compress(file){
 if(!typeAllowed(file))throw Error("이미지 파일만 첨부할 수 있습니다.");
 if(file.size>52428800)throw Error("50MB 이하 사진만 선택할 수 있습니다.");
 const image=await loadToImage(file);
 const w=image.naturalWidth,h=image.naturalHeight;
 if(!w||!h)throw Error("이미지 크기를 확인하지 못했습니다.");
 // Draw to a new canvas to strip GPS/EXIF before uploading.
 const ratio=Math.min(1,2200/Math.max(w,h));
 let width=Math.max(1,Math.floor(w*ratio));
 let height=Math.max(1,Math.floor(h*ratio));
 let quality=.88;
 for(let attempt=0;attempt<5;attempt++){
  const canvas=document.createElement("canvas");
  canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext("2d");
  if(!ctx)throw Error("이미지 변환을 지원하지 않는 브라우저입니다.");
  ctx.fillStyle="#ffffff";
  ctx.fillRect(0,0,width,height);
  ctx.drawImage(image,0,0,width,height);
  const result=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",quality));
  canvas.width=0;canvas.height=0;
  if(!result)throw Error("사진을 JPG로 변환하지 못했습니다.");
  if(result.size<=6291456)return result;
  width=Math.floor(width*.8);height=Math.floor(height*.8);quality=Math.max(.6,quality-.08);
 }
 throw Error("사진을 6MB 이하로 줄일 수 없습니다.");
}
async function prepareUpload(recordId,oldPath=""){
 if(!chosenFile)return removeCurrent?"":currentPath||oldPath||"";
 if(uploading)throw Error("사진을 업로드하는 중입니다.");
 if(!window.SIA_IDENTITY?.admin)throw Error("사진 등록은 관리자만 가능합니다.");
 if(!/^[a-z0-9_-]{4,100}$/i.test(String(recordId)))throw Error("기록 ID 형식이 잘못됐습니다.");
 if(lastUploaded?.file===chosenFile&&lastUploaded.id===recordId)return lastUploaded.path;
 const api=server();
 if(!api)throw Error("Supabase에 연결되지 않았습니다.");
 uploading=true;message("휴대폰 사진을 변환하고 업로드하는 중입니다…");
 try {
  const blob=await compress(chosenFile);
  const path=recordId+"/"+crypto.randomUUID()+".jpg";
  const {error}=await api.storage.from(BUCKET).upload(path,blob,{
   contentType:"image/jpeg",cacheControl:"300",upsert:false
  });
  if(error)throw error;
  lastUploaded={file:chosenFile,id:recordId,path};
  message("사진이 업로드됐습니다. 기록을 서버에 저장하고 있습니다.");
  return path;
 }catch(error){
  message("사진 업로드 실패: "+String(error.message||error),true);
  throw error;
 }finally{uploading=false;}
}
function mountCard(card,path,title){
 if(!validPath(path))return;
 const box=document.createElement("div");
 box.className="entry-illustration record-uploaded-image";
 const img=document.createElement("img");img.alt=title+" 사진";img.loading="lazy";img.decoding="async";
 box.append(img);card.prepend(box);
 void signedLink(path).then(url=>{
  if(box.isConnected)img.src=url;
 }).catch(()=>{
  if(box.isConnected){
   const note=document.createElement("span");note.className="record-photo-error";
   note.textContent="사진을 불러오지 못했습니다.";
   box.replaceChildren(note);
  }
 });
}
window.SIA_RECORD_PHOTOS={initForm,prepareUpload,mountCard,signedLink};
document.dispatchEvent(new Event("sia:record-photo-ready"));
})();