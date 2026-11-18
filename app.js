const defaultProducts=[
{name:"The Oxford Essential",category:"Shirts",price:1450,stock:18,image:"https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=700&q=80",tag:"NEW"},
{name:"Tailored Everyday Trouser",category:"Pants",price:1850,stock:12,image:"https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=700&q=80",tag:"BEST SELLER"},
{name:"Minimal Leather Sneakers",category:"Shoes",price:2650,stock:8,image:"https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?auto=format&fit=crop&w=700&q=80",tag:"NEW"},
{name:"Classic Everyday Tee",category:"T-Shirts",price:990,stock:25,image:"https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=700&q=80",tag:"CURATED"}
];
function getProducts(){try{return JSON.parse(localStorage.getItem("or_products"))||defaultProducts}catch(e){return defaultProducts}}
function renderProducts(){const grid=document.getElementById("productGrid");if(!grid)return;grid.innerHTML=getProducts().slice(0,8).map(p=>`<article class="product-card"><div class="product-photo"><img src="${p.image||'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=700&q=80'}" alt="${p.name}"><span class="product-tag">${p.tag||'CURATED'}</span></div><div class="product-info"><h3>${p.name}</h3><p>৳ ${Number(p.price).toLocaleString("en-BD")}</p></div></article>`).join("")}
renderProducts();
const nav=document.getElementById("mainNav");document.getElementById("menuToggle")?.addEventListener("click",()=>nav.classList.toggle("open"));
document.getElementById("newsletterForm")?.addEventListener("submit",e=>{e.preventDefault();alert("Thank you! Newsletter signup will be connected in a later phase.")});
const ann=localStorage.getItem("or_announcement");if(ann)document.getElementById("announcement").textContent=ann;
