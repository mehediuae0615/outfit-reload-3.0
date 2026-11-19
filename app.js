const supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
const fallbackProducts = [
{name:"The Oxford Essential",category:"Shirts",price:1450,stock:18,image:"https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=700&q=80",tag:"NEW"}
];
const $=id=>document.getElementById(id);
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
let productsCache=[], activeProduct=null, activeVariants=[], selectedSize='', selectedColor='', activeCategoryFilter='', cart=JSON.parse(sessionStorage.getItem('or_cart')||'[]');
let wishlist=new Set(JSON.parse(localStorage.getItem('or_wishlist')||'[]')), appliedCoupon=null;
function updateCart(){ const count=cart.reduce((n,x)=>n+x.qty,0); $('bagCount').textContent=count; const checkout=$('bagCheckout'); if(checkout){checkout.disabled=count===0;checkout.classList.toggle('is-ready',count>0);checkout.textContent=count?'PROCEED TO CHECKOUT ↗':'YOUR BAG IS EMPTY';} }
function flashState(p,now=Date.now()){
 const sale=Number(p.sale_price),regular=Number(p.price),start=p.sale_starts_at?new Date(p.sale_starts_at).getTime():null,end=p.sale_ends_at?new Date(p.sale_ends_at).getTime():null;
 const valid=sale>0&&sale<regular,scheduled=!!(start&&end);
 const active=valid&&(!scheduled||(now>=start&&now<end));
 return {active,valid,scheduled,start,end,sale,regular};
}
function effectivePrice(p){const f=flashState(p);return f.active?f.sale:f.regular}
function countdownText(ms){if(ms<=0)return '00:00:00';const sec=Math.floor(ms/1000),d=Math.floor(sec/86400),h=Math.floor(sec%86400/3600),m=Math.floor(sec%3600/60),s=sec%60;return d?`${d}d ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
function priceMarkup(p){const f=flashState(p);if(f.active)return `<span class="sale-price">৳ ${f.sale.toLocaleString('en-BD')}</span> <s class="regular-price">৳ ${f.regular.toLocaleString('en-BD')}</s> <em class="discount-badge">${Math.round((f.regular-f.sale)/f.regular*100)}% OFF</em>${f.scheduled?`<small class="flash-countdown" data-flash-end="${f.end}">ENDS IN ${countdownText(f.end-Date.now())}</small>`:''}`;if(f.valid&&f.scheduled&&Date.now()<f.start)return `<span>৳ ${f.regular.toLocaleString('en-BD')}</span><small class="flash-start-countdown" data-flash-start="${f.start}">FLASH SALE STARTS IN ${countdownText(f.start-Date.now())}</small>`;return `<span>৳ ${f.regular.toLocaleString('en-BD')}</span>`}
function card(p){const img=(p.image_urls&&p.image_urls[0])||p.image||"https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=700&q=80";return `<article class="product-card" role="button" tabindex="0" data-product="${p.id||''}"><button class="wishlist-toggle ${wishlist.has(p.id)?'active':''}" data-wishlist="${p.id}" aria-label="${wishlist.has(p.id)?'Remove from wishlist':'Add to wishlist'}" type="button">${wishlist.has(p.id)?'♥':'♡'}</button><div class="product-photo"><img src="${escapeHtml(img)}" alt="${escapeHtml(p.name)}"><span class="product-tag">${p.new_arrival?"NEW ARRIVAL":p.best_seller?"BEST SELLER":p.featured?"FEATURED":p.trending?"TRENDING":"CURATED"}</span><span class="quick-view">VIEW DETAILS ↗</span></div><div class="product-info"><h3>${escapeHtml(p.name)}</h3><p class="product-prices">${priceMarkup(p)}</p></div></article>`}
async function renderProducts(){const grid=$('productGrid');if(!grid)return;grid.innerHTML='<p class="helper">Loading collection…</p>';const {data,error}=await supabaseClient.from('products').select('id,name,category:categories(name),price,sale_price,sale_starts_at,sale_ends_at,image_urls,stock,featured,best_seller,new_arrival,trending,is_active,created_at,sizes,colors,description,material,size_guide').eq('is_active',true).order('created_at',{ascending:false});if(error){console.error(error);grid.innerHTML='<p class="helper">Products could not be loaded. Please refresh in a moment.</p>';return;}productsCache=data||[];grid.innerHTML=productsCache.length?productsCache.map(card).join(''):'<p class="helper">Our new collection is being prepared. Check back soon.</p>';[['bestSellerGrid',p=>p.best_seller],['featuredGrid',p=>p.featured],['trendingGrid',p=>p.trending]].forEach(([id,test])=>{const el=$(id);if(el){const items=productsCache.filter(test);el.innerHTML=items.length?items.map(card).join(''):'<p class="helper">New selections coming soon.</p>'}});document.querySelectorAll('.product-grid [data-product]').forEach(el=>{const open=()=>openProduct(el.dataset.product);el.addEventListener('click',open);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}})});document.querySelectorAll('[data-wishlist]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();toggleWishlist(b.dataset.wishlist)}));if(activeCategoryFilter)applyCategoryFilter(activeCategoryFilter);}
async function openProduct(id){const p=productsCache.find(x=>x.id===id);if(!p)return;activeProduct=p;selectedSize='';selectedColor='';$('detailName').textContent=p.name;$('detailPrice').innerHTML=priceMarkup(p);$('detailDescription').textContent=p.description||'A carefully selected piece from Outfit Reload 3.0.';$('detailMaterial').textContent=p.material||'Premium quality';$('detailSizeGuide').textContent=p.size_guide||'Choose your usual size.';const imgs=p.image_urls?.length?p.image_urls:[];$('detailImage').src=imgs[0]||'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=900&q=85';$('detailThumbs').innerHTML=imgs.map((u,i)=>`<button class="detail-thumb ${i===0?'active':''}" data-img="${escapeHtml(u)}"><img src="${escapeHtml(u)}" alt="Product image ${i+1}"></button>`).join('');$('detailThumbs').querySelectorAll('[data-img]').forEach(b=>b.onclick=()=>{$('detailImage').src=b.dataset.img;$('detailThumbs').querySelectorAll('button').forEach(x=>x.classList.remove('active'));b.classList.add('active')});
const {data,error}=await supabaseClient.from('product_variants').select('size,color,stock').eq('product_id',id);activeVariants=error?[]:(data||[]);const sizes=[...new Set(activeVariants.map(v=>v.size).filter(x=>x!=='One Size'))];const colors=[...new Set(activeVariants.map(v=>v.color).filter(x=>x!=='Default'))];const finalSizes=sizes.length?sizes:(p.sizes||[]);const finalColors=colors.length?colors:(p.colors||[]);$('detailSizes').innerHTML=finalSizes.length?finalSizes.map(s=>`<button class="choice" data-size="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join(''):'<span class="helper">One size</span>';$('detailColors').innerHTML=finalColors.length?finalColors.map(c=>`<button class="choice" data-color="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join(''):'<span class="helper">Standard</span>';
$('detailSizes').querySelectorAll('[data-size]').forEach(b=>b.onclick=()=>{selectedSize=b.dataset.size;$('detailSizes').querySelectorAll('button').forEach(x=>x.classList.toggle('selected',x===b));updateAvailability()});$('detailColors').querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{selectedColor=b.dataset.color;$('detailColors').querySelectorAll('button').forEach(x=>x.classList.toggle('selected',x===b));updateAvailability()});
$('detailQty').value=1;$('detailAvailability').textContent='Select size and colour to check availability.';$('addToBag').disabled=false;$('productDetail').classList.add('open');document.body.classList.add('no-scroll');loadProductReviews(id);}
function updateAvailability(){if(!activeProduct)return;const needSize=$('detailSizes').querySelector('[data-size]'),needColor=$('detailColors').querySelector('[data-color]');if((needSize&&!selectedSize)||(needColor&&!selectedColor)){$('detailAvailability').textContent='Please select '+(!selectedSize&&needSize?'a size':'')+(!selectedColor&&needColor?' a colour':'')+'.';return}const v=activeVariants.find(x=>(!needSize||x.size===selectedSize)&&(!needColor||x.color===selectedColor));const stock=v?Number(v.stock):Number(activeProduct.stock||0);$('detailAvailability').textContent=stock>0?`In stock · ${stock} available`:'Currently out of stock';$('addToBag').disabled=stock<=0;}
function closeDetail(){$('productDetail').classList.remove('open');document.body.classList.remove('no-scroll')}
$('closeDetail').onclick=closeDetail;$('productDetail').addEventListener('click',e=>{if(e.target===$('productDetail'))closeDetail()});$('addToBag').onclick=()=>{if(!activeProduct)return;const needSize=$('detailSizes').querySelector('[data-size]'),needColor=$('detailColors').querySelector('[data-color]');if((needSize&&!selectedSize)||(needColor&&!selectedColor)){alert('Please select size and colour first.');return}const variant=activeVariants.find(x=>(!needSize||x.size===selectedSize)&&(!needColor||x.color===selectedColor));const stock=variant?Number(variant.stock):Number(activeProduct.stock||0);const qty=Math.max(1,Number($('detailQty').value||1));if(qty>stock){alert('Only '+stock+' item(s) available.');return}const key=[activeProduct.id,selectedSize,selectedColor].join('|');const found=cart.find(x=>x.key===key);if(found)found.qty+=qty;else cart.push({key,id:activeProduct.id,name:activeProduct.name,price:effectivePrice(activeProduct),regularPrice:Number(activeProduct.price),salePrice:flashState(activeProduct).active?Number(activeProduct.sale_price):null,size:selectedSize,color:selectedColor,qty});saveBag();closeDetail();openBag()};
function money(n){return '৳ '+Number(n||0).toLocaleString('en-BD')}
function renderBag(){const host=$('bagItems');if(!host)return;if(!cart.length){host.innerHTML='<div class="bag-empty"><span>◇</span><h3>Your bag is empty</h3><p>Discover something you love.</p></div>';$('bagSubtotal').textContent=money(0);updateCart();return}host.innerHTML=cart.map((x,i)=>{const p=productsCache.find(v=>v.id===x.id);const img=p?.image_urls?.[0]||p?.image||'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=300&q=80';return `<article class="bag-item"><img src="${escapeHtml(img)}" alt="${escapeHtml(x.name)}"><div class="bag-item-info"><h3>${escapeHtml(x.name)}</h3><p>${escapeHtml(x.size||'One size')} · ${escapeHtml(x.color||'Standard')}</p><strong>${money(x.price)}${x.regularPrice&&x.regularPrice>x.price?` <s class="regular-price">${money(x.regularPrice)}</s>`:''}</strong><div class="bag-controls"><button data-minus="${i}" aria-label="Decrease quantity">−</button><span>${x.qty}</span><button data-plus="${i}" aria-label="Increase quantity">+</button><button class="bag-remove" data-remove="${i}">Remove</button></div></div></article>`}).join('');$('bagSubtotal').textContent=money(cart.reduce((n,x)=>n+x.price*x.qty,0));host.querySelectorAll('[data-minus]').forEach(b=>b.onclick=()=>changeBagQty(+b.dataset.minus,-1));host.querySelectorAll('[data-plus]').forEach(b=>b.onclick=()=>changeBagQty(+b.dataset.plus,1));host.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{cart.splice(+b.dataset.remove,1);saveBag()})}
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
 const settings=window.OUTFIT_RELOAD_SETTINGS||{};const fee=$('deliveryArea').value==='inside_dhaka'?Number(settings.deliveryInside??80):Number(settings.deliveryOutside??130);
 $('checkoutSubtotal').textContent=money(subtotal);
 $('checkoutDelivery').textContent=money(fee);
 $('checkoutTotal').textContent=money(subtotal+fee-(appliedCoupon?.discount_amount||0));if($('couponDiscountRow'))$('couponDiscountRow').hidden=!appliedCoupon;if($('checkoutDiscount'))$('checkoutDiscount').textContent='−'+money(appliedCoupon?.discount_amount||0);
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
   p_items:items,
   p_coupon_code:appliedCoupon?.code||null
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
let lastFlashSignature='';
function refreshFlashSales(){
 const now=Date.now();
 document.querySelectorAll('[data-flash-end]').forEach(el=>{const end=Number(el.dataset.flashEnd);el.textContent='ENDS IN '+countdownText(end-now)});
 document.querySelectorAll('[data-flash-start]').forEach(el=>{const start=Number(el.dataset.flashStart);el.textContent='FLASH SALE STARTS IN '+countdownText(start-now)});
 const signature=productsCache.map(p=>{const f=flashState(p,now);return `${p.id}:${f.active}:${f.active?f.sale:f.regular}`}).join('|');
 if(signature!==lastFlashSignature&&lastFlashSignature){
  cart.forEach(item=>{const p=productsCache.find(x=>x.id===item.id);if(p){item.price=effectivePrice(p);item.regularPrice=Number(p.price);item.salePrice=flashState(p).active?Number(p.sale_price):null}});
  sessionStorage.setItem('or_cart',JSON.stringify(cart));renderBag();updateCheckoutTotals();
  const detail=$('productDetail');if(detail?.classList.contains('open')&&activeProduct){$('detailPrice').innerHTML=priceMarkup(activeProduct)}
 }
 lastFlashSignature=signature;
}
setInterval(refreshFlashSales,1000);
renderProducts();updateCart();renderBag();
// Category tiles filter the live Supabase product list without changing checkout/admin flows.
function applyCategoryFilter(category){
 activeCategoryFilter=category||'';
 const grid=$('productGrid');if(!grid)return;
 const normalize=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const aliases={shoe:['shoe','shoes','footwear'],watch:['watch','watches','accessories'],sweatshirt:['sweatshirt','sweepshirt','sweatshirts','hoodie'],tshirt:['tshirt','tshirts','tee','tees'],shirts:['shirt','shirts'],pants:['pant','pants','jeans','trousers']};
 const wanted=aliases[normalize(category)]||[normalize(category)];
 const filtered=productsCache.filter(p=>{const c=normalize(p.category?.name||p.category||'');return wanted.some(w=>c===w||c.includes(w)||normalize(p.name).includes(w));});
 grid.innerHTML=filtered.length?filtered.map(card).join():'<p class="helper">No products found in this category yet.</p>';
 document.querySelectorAll('.product-grid [data-product]').forEach(el=>{const open=()=>openProduct(el.dataset.product);el.addEventListener('click',open);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}})});document.querySelectorAll('[data-wishlist]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();toggleWishlist(b.dataset.wishlist)}));
 const heading=document.querySelector('#new .section-heading h2');if(heading)heading.innerHTML=activeCategoryFilter?escapeHtml(category)+'<span>.</span>':'New arrivals<span>.</span>';
 document.querySelectorAll('.product-grid').forEach(el=>{if(el.id!=='productGrid')el.closest('.section')?.classList.toggle('category-filter-hidden',!!activeCategoryFilter)});
 if(activeCategoryFilter){$('new').scrollIntoView({behavior:'smooth',block:'start'});}
}
document.querySelectorAll('.category-card[data-category]').forEach(tile=>tile.addEventListener('click',e=>{e.preventDefault();applyCategoryFilter(tile.dataset.category);}));

const nav=$('mainNav');$('menuToggle')?.addEventListener('click',()=>{const open=nav.classList.toggle('open');$('menuToggle').setAttribute('aria-expanded',String(open));$('menuToggle').setAttribute('aria-label',open?'Close menu':'Open menu')});nav?.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{nav.classList.remove('open');$('menuToggle')?.setAttribute('aria-expanded','false')}));
$('newsletterForm')?.addEventListener('submit',e=>{e.preventDefault();alert('Thank you for subscribing!')});
document.addEventListener('outfit:content-loaded',()=>{if($('deliveryArea'))updateCheckoutTotals()});
(async()=>{const {data}=await supabaseClient.from('store_settings').select('value').eq('key','announcement').maybeSingle();if(data?.value)$('announcement').textContent=data.value;})();


// Privacy-preserving customer order lookup: server verifies order number + phone.
const trackingForm=$('trackingForm');
trackingForm?.addEventListener('submit',async e=>{
 e.preventDefault();
 const values=Object.fromEntries(new FormData(trackingForm).entries());
 const button=$('trackOrderButton');
 const errorBox=$('trackingError');
 const resultBox=$('trackingResult');
 button.disabled=true;button.textContent='LOOKING UP…';errorBox.textContent='';resultBox.hidden=true;resultBox.innerHTML='';
 try{
  const {data,error}=await supabaseClient.rpc('track_customer_order',{
   p_order_number:String(values.order_number||'').trim().toUpperCase(),
   p_phone:String(values.phone||'').trim()
  });
  if(error)throw error;
  if(!data||data.found!==true)throw new Error('We could not find an order matching those details. Check the order number and phone number, then try again.');
  const statusLabels={pending:'Pending',confirmed:'Confirmed',processing:'Processing',shipped:'Shipped',delivered:'Delivered',cancelled:'Cancelled'};
  const items=Array.isArray(data.items)?data.items:[];
  resultBox.innerHTML=`<h3>Order ${escapeHtml(data.order_number)}</h3><span class="tracking-status">${escapeHtml(statusLabels[data.status]||data.status)}</span><div class="tracking-meta"><div><span>Order date</span><strong>${escapeHtml(new Date(data.created_at).toLocaleDateString('en-GB'))}</strong></div><div><span>Order status</span><strong>${escapeHtml(statusLabels[data.status]||data.status)}</strong></div><div><span>Delivery area</span><strong>${data.delivery_area==='inside_dhaka'?'Inside Dhaka':'Outside Dhaka'}</strong></div><div><span>Total payable</span><strong>${money(data.total)}</strong></div></div><div class="tracking-items"><b>Order items</b>${items.map(item=>`<div class="tracking-item"><span>${escapeHtml(item.product_name)} · ${escapeHtml(item.size||'One Size')} / ${escapeHtml(item.color||'Default')} × ${Number(item.quantity)}</span><strong>${money(item.line_total)}</strong></div>`).join('')}</div>`;
  resultBox.hidden=false;
 }catch(err){console.error('Order tracking error:',err);errorBox.textContent=err.message||'Unable to look up this order right now.';}
 finally{button.disabled=false;button.textContent='TRACK ORDER ↗';}
});


// Wishlist is stored locally on this device; it does not require customer accounts.
function toggleWishlist(id){if(wishlist.has(id))wishlist.delete(id);else wishlist.add(id);localStorage.setItem('or_wishlist',JSON.stringify([...wishlist]));document.querySelectorAll(`[data-wishlist="${CSS.escape(id)}"]`).forEach(b=>{const on=wishlist.has(id);b.classList.toggle('active',on);b.textContent=on?'♥':'♡';b.setAttribute('aria-label',on?'Remove from wishlist':'Add to wishlist')});}
document.addEventListener('click',e=>{const heart=e.target.closest('[data-wishlist]');if(heart){e.preventDefault();e.stopPropagation();toggleWishlist(heart.dataset.wishlist);}});
document.querySelector('.header-heart')?.addEventListener('click',()=>{const ids=[...wishlist];if(!ids.length){alert('Your wishlist is empty. Tap the heart on a product to save it.');return}const names=ids.map(id=>productsCache.find(p=>p.id===id)).filter(Boolean).map(p=>'• '+p.name);alert('YOUR WISHLIST\n\n'+(names.join('\n')||'Saved products are currently unavailable.'));});
async function loadProductReviews(id){const host=$('productReviews');host.innerHTML='<p class="helper">Loading reviews…</p>';const {data,error}=await supabaseClient.from('product_reviews').select('customer_name,rating,review_text,created_at').eq('product_id',id).eq('is_approved',true).order('created_at',{ascending:false}).limit(12);if(error){host.innerHTML='<p class="helper">Reviews are temporarily unavailable.</p>';return}host.innerHTML=(data||[]).map(r=>`<article class="product-review-card"><div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div><p>${escapeHtml(r.review_text)}</p><small>${escapeHtml(r.customer_name)} · ${new Date(r.created_at).toLocaleDateString()}</small></article>`).join('')||'<p class="helper">No approved reviews yet. Be the first to review this product.</p>';}
$('reviewForm')?.addEventListener('submit',async e=>{e.preventDefault();if(!activeProduct)return;const f=e.currentTarget,v=Object.fromEntries(new FormData(f).entries()),status=$('reviewMessage');status.textContent='Submitting…';const {error}=await supabaseClient.from('product_reviews').insert({product_id:activeProduct.id,customer_name:v.customer_name.trim(),rating:Number(v.rating),review_text:v.review_text.trim(),is_approved:false});if(error){status.textContent='Could not submit review: '+error.message;return}f.reset();status.textContent='Thank you! Your review has been sent for approval.';});
async function loadHomepageReviews(){const host=$('homepageReviews');if(!host)return;const {data,error}=await supabaseClient.from('product_reviews').select('customer_name,rating,review_text,products(name)').eq('is_approved',true).order('created_at',{ascending:false}).limit(6);if(error){host.innerHTML='<p class="helper">Customer reviews will appear here.</p>';return}host.innerHTML=(data||[]).map(r=>`<article class="review-card"><div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div><p>${escapeHtml(r.review_text)}</p><b>${escapeHtml(r.customer_name)}</b><br><small>${escapeHtml(r.products?.name||'Outfit Reload customer')}</small></article>`).join('')||'<p class="helper">Be the first to share your experience with Outfit Reload.</p>';}
$('applyCoupon')?.addEventListener('click',async()=>{const code=$('couponCode').value.trim(),msg=$('couponMessage'),subtotal=cart.reduce((n,x)=>n+Number(x.price)*Number(x.qty),0);if(!code){msg.textContent='Enter a coupon code first.';return}msg.textContent='Checking coupon…';const {data,error}=await supabaseClient.rpc('validate_discount_coupon',{p_code:code,p_subtotal:subtotal});const r=Array.isArray(data)?data[0]:data;if(error||!r?.valid){appliedCoupon=null;msg.textContent=error?.message||r?.message||'Coupon could not be applied.';updateCheckoutTotals();return}appliedCoupon={code:r.code,discount_amount:Number(r.discount_amount)};msg.textContent=r.message+' You saved '+money(appliedCoupon.discount_amount)+'.';updateCheckoutTotals();});
loadHomepageReviews();
