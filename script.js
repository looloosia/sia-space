const menuButton = document.getElementById("menuButton");
const nav = document.querySelector(".desktop-nav");
menuButton?.addEventListener("click", () => nav.classList.toggle("open"));
nav?.querySelectorAll("a").forEach(link => link.addEventListener("click", () => nav.classList.remove("open")));
