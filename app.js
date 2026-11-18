const supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
const fallbackProducts = [
{name:"The Oxford Essential",category:"Shirts",price:1450,stock:18,image:"https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=700&q=80",tag:"NEW"},
{name:"Tailored Everyday Trouser",category:"Pants",price:1850,stock:12,image:"https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=700&q=80",tag:"BEST SELLER"},
{name:"Minimal Leather Sneakers",category:"Shoes",price:2650,stock:8,image:"https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?auto=format&fit=crop&w=700&q=80",tag:"NEW"},
{name:"Classic Everyday Tee",category:"T-Shirts",price:990,stock:25,image:"https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=700&q=80",tag:"CURATED"}
];
function card(p){const img=(p.image_urls&&p.image_urls[0])||p.image||"https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=700&q=80";return `<article class="product-card"><div class="product-photo"><img src="${img}" alt="${escapeHtml(p.name)}"><span class="product-tag">${p.new_arrival?"NEW ARRIVAL":p.best_seller?"BEST SELLER":p.featured?"FEATURED":p.trending?"TRENDING":"CURATED"}</span></div><div class="product-info"><h3>${escapeHtml(p.name)}</h3><p>৳ ${Number(p.price).toLocaleString("en-BD")}</p></div></article>`}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function renderProducts(){const grid=document.getElementById("productGrid");if(!grid)return;grid.innerHTML='<p class="helper">Loading collection…</p>';const {data,error}=await supabaseClient.from('products').select('id,name,price,image_urls,stock,featured,best_seller,new_arrival,trending,is_active,created_at').eq('is_active',true).order('created_at',{ascending:false});if(error){grid.innerHTML=fallbackProducts.map(card).join('');console.error(error);return;}grid.innerHTML=data.length?data.map(card).join(''):'<p class="helper">Our new collection is being prepared. Check back soon.</p>'}
renderProducts();
const nav=document.getElementById("mainNav");document.getElementById("menuToggle")?.addEventListener("click",()=>nav.classList.toggle("open"));
document.getElementById("newsletterForm")?.addEventListener("submit",e=>{e.preventDefault();alert("Thank you for subscribing!")});
(async()=>{const {data}=await supabaseClient.from('store_settings').select('value').eq('key','announcement').maybeSingle();if(data?.value)document.getElementById('announcement').textContent=data.value;})();
