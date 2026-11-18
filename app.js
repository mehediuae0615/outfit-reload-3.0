const supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
const fallbackProducts = [
{name:"The Oxford Essential",category:"Shirts",price:1450,stock:18,image:"https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=700&q=80",tag:"NEW"}
];
const $=id=>document.getElementById(id);
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
let productsCache=[], activeProduct=null, activeVariants=[], selectedSize='', selectedColor='', cart=JSON.parse(sessionStorage.getItem('or_cart')||'[]');
function updateCart(){ const count=cart.reduce((n,x)=>n+x.qty,0); $('bagCount').textContent=count; const checkout=$('bagCheckout'); if(checkout){checkout.disabled=count===0;checkout.classList.toggle('is-ready',count>0);checkout.textContent=count?'PROCEED TO CHECKOUT ↗':'YOUR BAG IS EMPTY';} }
function card(p){const img=(p.image_urls&&p.image_urls[0])||p.image||"https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=700&q=80";return `<article class="product-card" role="button" tabindex="0" data-product="${p.id||''}"><div class="product-photo"><img src="${escapeHtml(img)}" alt="${escapeHtml(p.name)}"><span class="product-tag">${p.new_arrival?"NEW ARRIVAL":p.best_seller?"BEST SELLER":p.featured?"FEATURED":p.trending?"TRENDING":"CURATED"}</span><span class="quick-view">VIEW DETAILS ↗</span></div><div class="product-info"><h3>${escapeHtml(p.name)}</h3><p>৳ ${Number(p.price).toLocaleString("en-BD")}</p></div></article>`}
async function renderProducts(){const grid=$('productGrid');if(!grid)return;grid.innerHTML='<p class="helper">Loading collection…</p>';const {data,error}=await supabaseClient.from('products').select('id,name,price,image_urls,stock,featured,best_seller,new_arrival,trending,is_active,created_at,sizes,colors,description,material,size_guide').eq('is_active',true).order('created_at',{ascending:false});if(error){console.error(error);grid.innerHTML='<p class="helper">Products could not be loaded. Please refresh in a moment.</p>';return;}productsCache=data||[];grid.innerHTML=productsCache.length?productsCache.map(card).join(''):'<p class="helper">Our new collection is being prepared. Check back soon.</p>';[['bestSellerGrid',p=>p.best_seller],['featuredGrid',p=>p.featured],['trendingGrid',p=>p.trending]].forEach(([id,test])=>{const el=$(id);if(el){const items=productsCache.filter(test);el.innerHTML=items.length?items.map(card).join(''):'<p class="helper">New selections coming soon.</p>'}});document.querySelectorAll('.product-grid [data-product]').forEach(el=>{const open=()=>openProduct(el.dataset.product);el.addEventListener('click',open);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}})});}
async function openProduct(id){const p=productsCache.find(x=>x.id===id);if(!p)return;activeProduct=p;selectedSize='';selectedColor='';$('detailName').textContent=p.name;$('detailPrice').textContent='৳ '+Number(p.price).toLocaleString('en-BD');$('detailDescription').textContent=p.description||'A carefully selected piece from Outfit Reload 3.0.';$('detailMaterial').textContent=p.material||'Premium quality';$('detailSizeGuide').textContent=p.size_guide||'Choose your usual size.';const imgs=p.image_urls?.length?p.image_urls:[];$('detailImage').src=imgs[0]||'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=900&q=85';$('detailThumbs').innerHTML=imgs.map((u,i)=>`<button class="detail-thumb ${i===0?'active':''}" data-img="${escapeHtml(u)}"><img src="${escapeHtml(u)}" alt="Product image ${i+1}"></button>`).join('');$('detailThumbs').querySelectorAll('[data-img]').forEach(b=>b.onclick=()=>{$('detailImage').src=b.dataset.img;$('detailThumbs').querySelectorAll('button').forEach(x=>x.classList.remove('active'));b.classList.add('active')});
const {data,error}=await supabaseClient.from('product_variants').select('size,color,stock').eq('product_id',id);activeVariants=error?[]:(data||[]);const sizes=[...new Set(activeVariants.map(v=>v.size).filter(x=>x!=='One Size'))];const colors=[...new Set(activeVariants.map(v=>v.color).filter(x=>x!=='Default'))];const finalSizes=sizes.length?sizes:(p.sizes||[]);const finalColors=colors.length?colors:(p.colors||[]);$('detailSizes').innerHTML=finalSizes.length?finalSizes.map(s=>`<button class="choice" data-size="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join(''):'<span class="helper">One size</span>';$('detailColors').innerHTML=finalColors.length?finalColors.map(c=>`<button class="choice" data-color="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join(''):'<span class="helper">Standard</span>';
$('detailSizes').querySelectorAll('[data-size]').forEach(b=>b.onclick=()=>{selectedSize=b.dataset.size;$('detailSizes').querySelectorAll('button').forEach(x=>x.classList.toggle('selected',x===b));updateAvailability()});$('detailColors').querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{selectedColor=b.dataset.color;$('detailColors').querySelectorAll('button').forEach(x=>x.classList.toggle('selected',x===b));updateAvailability()});
$('detailQty').value=1;$('detailAvailability').textContent='Select size and colour to check availability.';$('addToBag').disabled=false;$('productDetail').classList.add('open');document.body.classList.add('no-scroll');}
function updateAvailability(){if(!activeProduct)return;const needSize=$('detailSizes').querySelector('[data-size]'),needColor=$('detailColors').querySelector('[data-color]');if((needSize&&!selectedSize)||(needColor&&!selectedColor)){$('detailAvailability').textContent='Please select '+(!selectedSize&&needSize?'a size':'')+(!selectedColor&&needColor?' a colour':'')+'.';return}const v=activeVariants.find(x=>(!needSize||x.size===selectedSize)&&(!needColor||x.color===selectedColor));const stock=v?Number(v.stock):Number(activeProduct.stock||0);$('detailAvailability').textContent=stock>0?`In stock · ${stock} available`:'Currently out of stock';$('addToBag').disabled=stock<=0;}
function closeDetail(){$('productDetail').classList.remove('open');document.body.classList.remove('no-scroll')}
$('closeDetail').onclick=closeDetail;$('productDetail').addEventListener('click',e=>{if(e.target===$('productDetail'))closeDetail()});$('addToBag').onclick=()=>{if(!activeProduct)return;const needSize=$('detailSizes').querySelector('[data-size]'),needColor=$('detailColors').querySelector('[data-color]');if((needSize&&!selectedSize)||(needColor&&!selectedColor)){alert('Please select size and colour first.');return}const variant=activeVariants.find(x=>(!needSize||x.size===selectedSize)&&(!needColor||x.color===selectedColor));const stock=variant?Number(variant.stock):Number(activeProduct.stock||0);const qty=Math.max(1,Number($('detailQty').value||1));if(qty>stock){alert('Only '+stock+' item(s) available.');return}const key=[activeProduct.id,selectedSize,selectedColor].join('|');const found=cart.find(x=>x.key===key);if(found)found.qty+=qty;else cart.push({key,id:activeProduct.id,name:activeProduct.name,price:Number(activeProduct.price),size:selectedSize,color:selectedColor,qty});saveBag();closeDetail();openBag()};
function money(n){return '৳ '+Number(n||0).toLocaleString('en-BD')}
function renderBag(){const host=$('bagItems');if(!host)return;if(!cart.length){host.innerHTML='<div class="bag-empty"><span>◇</span><h3>Your bag is empty</h3><p>Discover something you love.</p></div>';$('bagSubtotal').textContent=money(0);updateCart();return}host.innerHTML=cart.map((x,i)=>{const p=productsCache.find(v=>v.id===x.id);const img=p?.image_urls?.[0]||p?.image||'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=300&q=80';return `<article class="bag-item"><img src="${escapeHtml(img)}" alt="${escapeHtml(x.name)}"><div class="bag-item-info"><h3>${escapeHtml(x.name)}</h3><p>${escapeHtml(x.size||'One size')} · ${escapeHtml(x.color||'Standard')}</p><strong>${money(x.price)}</strong><div class="bag-controls"><button data-minus="${i}" aria-label="Decrease quantity">−</button><span>${x.qty}</span><button data-plus="${i}" aria-label="Increase quantity">+</button><button class="bag-remove" data-remove="${i}">Remove</button></div></div></article>`}).join('');$('bagSubtotal').textContent=money(cart.reduce((n,x)=>n+x.price*x.qty,0));host.querySelectorAll('[data-minus]').forEach(b=>b.onclick=()=>changeBagQty(+b.dataset.minus,-1));host.querySelectorAll('[data-plus]').forEach(b=>b.onclick=()=>changeBagQty(+b.dataset.plus,1));host.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{cart.splice(+b.dataset.remove,1);saveBag()})}
function saveBag(){sessionStorage.setItem('or_cart',JSON.stringify(cart));updateCart();renderBag()}
function changeBagQty(i,delta){if(!cart[i])return;cart[i].qty+=delta;if(cart[i].qty<=0)cart.splice(i,1);saveBag()}
function openBag(){$('bagDrawer').classList.add('open');$('bagDrawer').setAttribute('aria-hidden','false');document.body.classList.add('no-scroll');renderBag()}
function closeBag(){$('bagDrawer').classList.remove('open');$('bagDrawer').setAttribute('aria-hidden','true');document.body.classList.remove('no-scroll')}
$('bagButton').onclick=openBag;$('closeBag').onclick=closeBag;$('bagDrawer').addEventListener('click',e=>{if(e.target===$('bagDrawer'))closeBag()});function openCheckout(){
 if(!cart.length)return;
 closeBag();
 $('checkoutForm').reset();
 $('checkoutError').textContent='';
 $('checkoutFormWrap').hidden=false;
 $('orderSuccess').hidden=true;
 updateCheckoutTotals();
 $('checkoutModal').classList.add('open');
 $('checkoutModal').setAttribute('aria-hidden','false');
 document.body.classList.add('no-scroll');
}
function closeCheckout(){
 $('checkoutModal').classList.remove('open');
 $('checkoutModal').setAttribute('aria-hidden','true');
 document.body.classList.remove('no-scroll');
}
function updateCheckoutTotals(){
 const subtotal=cart.reduce((n,x)=>n+Number(x.price)*Number(x.qty),0);
 const fee=$('deliveryArea').value==='inside_dhaka'?80:130;
 $('checkoutSubtotal').textContent=money(subtotal);
 $('checkoutDelivery').textContent=money(fee);
 $('checkoutTotal').textContent=money(subtotal+fee);
}
$('bagCheckout').onclick=openCheckout;
$('closeCheckout').onclick=closeCheckout;
$('checkoutModal').addEventListener('click',e=>{if(e.target===$('checkoutModal'))closeCheckout()});
$('deliveryArea').addEventListener('change',updateCheckoutTotals);
$('continueShopping').onclick=()=>{closeCheckout();window.scrollTo({top:0,behavior:'smooth'})};
$('checkoutForm').addEventListener('submit',async e=>{
 e.preventDefault();
 if(!cart.length){$('checkoutError').textContent='Your bag is empty.';return}
 const form=e.currentTarget;
 const values=Object.fromEntries(new FormData(form).entries());
 const button=$('placeOrderButton');
 button.disabled=true;button.textContent='SUBMITTING YOUR ORDER…';$('checkoutError').textContent='';
 try{
  const items=cart.map(x=>({product_id:x.id,quantity:Number(x.qty),size:x.size||'One Size',color:x.color||'Default'}));
  const {data,error}=await supabaseClient.rpc('place_cod_order',{
   p_customer_name:values.customer_name,
   p_customer_phone:values.customer_phone,
   p_customer_email:values.customer_email||null,
   p_delivery_area:values.delivery_area,
   p_delivery_address:values.delivery_address,
   p_customer_note:values.customer_note||null,
   p_items:items
  });
  if(error)throw error;
  const result=Array.isArray(data)?data[0]:data;
  if(!result?.order_number)throw new Error('Order response was incomplete. Please contact the store before trying again.');
  const total=result.order_total;
  cart=[];saveBag();
  $('checkoutFormWrap').hidden=true;
  $('orderSuccess').hidden=false;
  $('successOrderNumber').textContent=result.order_number;
  $('successOrderTotal').textContent='Total payable on delivery: '+money(total);
 }catch(err){
  console.error('Checkout error:',err);
  $('checkoutError').textContent=err.message||'Your order could not be submitted. Please check your details and try again.';
 }finally{
  button.disabled=false;button.textContent='PLACE ORDER · CASH ON DELIVERY ↗';
 }
});
renderProducts();updateCart();renderBag();
const nav=$('mainNav');$('menuToggle')?.addEventListener('click',()=>nav.classList.toggle('open'));
$('newsletterForm')?.addEventListener('submit',e=>{e.preventDefault();alert('Thank you for subscribing!')});
(async()=>{const {data}=await supabaseClient.from('store_settings').select('value').eq('key','announcement').maybeSingle();if(data?.value)$('announcement').textContent=data.value;})();
