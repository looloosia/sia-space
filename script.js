// Single source of truth for the responsive navigation menu.
(() => {
  "use strict";
  const button = document.getElementById("menuButton");
  const nav = document.getElementById("mainNav");
  const archive = document.getElementById("archiveNav");
  if (!button || !nav) return;

  function setOpen(open) {
    nav.classList.toggle("open",open);
    button.setAttribute("aria-expanded",String(open));
    button.setAttribute("aria-label",open?"메뉴 닫기":"메뉴 열기");
    if (!open && archive) archive.open=false;
  }

  button.addEventListener("click",event=>{
    event.preventDefault();
    event.stopPropagation();
    setOpen(!nav.classList.contains("open"));
  });

  nav.querySelectorAll("a[href]").forEach(link=>{
    link.addEventListener("click",()=>setOpen(false));
  });

  document.addEventListener("click",event=>{
    if (nav.classList.contains("open") && !nav.contains(event.target) && !button.contains(event.target))
      setOpen(false);
  });
  document.addEventListener("keydown",event=>{
    if(event.key==="Escape" && nav.classList.contains("open")){
      setOpen(false);
      button.focus();
    }
  });

  window.addEventListener("resize",()=>{
    if(window.innerWidth>1100 && nav.classList.contains("open"))setOpen(false);
  });
})();
