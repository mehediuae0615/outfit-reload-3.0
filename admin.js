const demoProducts=[
{name:"The Oxford Essential",category:"Shirts",price:1450,stock:18,sku:"OR-0001"},
{name:"Tailored Everyday Trouser",category:"Pants",price:1850,stock:12,sku:"OR-0002"},
{name:"Minimal Leather Sneakers",category:"Shoes",price:2650,stock:8,sku:"OR-0003"},
{name:"Classic Everyday Tee",category:"T-Shirts",price:990,stock:25,sku:"OR-0004"}
];
function products(){try{return JSON.parse(localStorage.getItem("or_products"))||demoProducts}catch(e){return demoProducts}}
function saveProducts(p){localStorage.setItem("or_products",JSON.stringify(p))}
function renderRows(){const body=document.getElementById("adminProductRows");if(!body)return;const p=products();document.getElementById("productTotal").textContent=p.length;body.innerHTML=p.map((x,i)=>`<tr><td><strong>${x.name}</strong><br><small>${x.sku||"SKU pending"}</small></td><td>${x.category}</td><td>৳ ${Number(x.price).toLocaleString("en-BD")}</td><td>${x.stock}</td><td><span class="pill">${x.stock>0?"In stock":"Out of stock"}</span></td><td><button data-remove="${i}" style="border:0;background:none;color:#9a5a45;cursor:pointer">Remove</button></td></tr>`).join("");body.querySelectorAll("[data-remove]").forEach(b=>b.addEventListener("click",()=>{const list=products();list.splice(Number(b.dataset.remove),1);saveProducts(list);renderRows()}))}
renderRows();
const modal=document.getElementById("productModal");document.getElementById("addProductBtn").addEventListener("click",()=>modal.classList.add("open"));document.getElementById("closeModal").addEventListener("click",()=>modal.classList.remove("open"));modal.addEventListener("click",e=>{if(e.target===modal)modal.classList.remove("open")});
document.getElementById("productForm").addEventListener("submit",e=>{e.preventDefault();const list=products();const sku="OR-"+String(Date.now()).slice(-6);list.push({name:document.getElementById("pName").value,category:document.getElementById("pCategory").value,price:Number(document.getElementById("pPrice").value),stock:Number(document.getElementById("pStock").value),sku});saveProducts(list);e.target.reset();modal.classList.remove("open");renderRows();alert("Demo product added in this browser.")});
const announcementInput=document.getElementById("announcementInput");announcementInput.value=localStorage.getItem("or_announcement")||"WE FOCUS QUALITY, NOT QUANTITY.";document.getElementById("saveAnnouncement").addEventListener("click",()=>{localStorage.setItem("or_announcement",announcementInput.value);alert("Announcement saved in this browser. Refresh the website preview to see it.")});
document.getElementById("adminMenu").addEventListener("click",()=>document.getElementById("sidebar").classList.toggle("open"));
