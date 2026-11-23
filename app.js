const supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
const fallbackProducts = [
{name:"The Oxford Essential",category:"Shirts",price:1450,stock:18,image:"https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=700&q=80",tag:"NEW"}
];
const $=id=>document.getElementById(id);
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
let productsCache=[], activeProduct=null, activeVariants=[], selectedSize='', selectedColor='', activeCategoryFilter='', cart=JSON.parse(sessionStorage.getItem('or_cart')||'[]');
let wishlist=new Set(JSON.parse(localStorage.getItem('or_wishlist')||'[]')), appliedCoupon=null;
// Expose read-only storefront data and product actions for the standalone Collections page.
Object.defineProperty(window,'productsCache',{configurable:true,get:()=>productsCache});
window.card=card;window.openProduct=openProduct;window.toggleWishlist=toggleWishlist;
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
async function renderProducts(){
 const grid=$('productGrid');
 if(!grid)return;
 grid.innerHTML='<p class="helper">Loading collection…</p>';
 try{
  // Load and render products first. Category lookup must never block the product grid.
  const productRequest=supabaseClient.from('products').select('*').eq('is_active',true);
  const productResult=await Promise.race([
   productRequest,
   new Promise((_,reject)=>setTimeout(()=>reject(new Error('Products request timed out after 12 seconds.')),12000))
  ]);
  const {data,error}=productResult;
  if(error)throw error;
  productsCache=Array.isArray(data)?data:[];
  productsCache.sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
  renderProductGrids();
  window.dispatchEvent(new CustomEvent('outfit:products-loaded'));

  // Resolve category names in the background. If this fails, products stay visible.
  const categoryIds=[...new Set(productsCache.map(p=>p.category_id).filter(Boolean))];
  if(categoryIds.length){
   supabaseClient.from('categories').select('id,name').in('id',categoryIds)
    .then(({data:categories,error:categoryError})=>{
     if(categoryError){console.warn('Category lookup failed; product grid remains available:',categoryError);return;}
     const categoryMap=new Map((categories||[]).map(c=>[String(c.id),c.name]));
     productsCache=productsCache.map(p=>({...p,category:{name:categoryMap.get(String(p.category_id))||p.category?.name||''}}));
     renderProductGrids();
     window.dispatchEvent(new CustomEvent('outfit:products-loaded'));
    })
    .catch(categoryError=>console.warn('Category lookup failed; product grid remains available:',categoryError));
  }
 }catch(err){
  console.error('Supabase product query failed:',err);
  const message=String(err?.message||err||'Unknown error');
  grid.innerHTML='<p class="helper">Products could not be loaded: '+escapeHtml(message)+'. Please check the Supabase products table and public SELECT policy.</p>';
  window.dispatchEvent(new CustomEvent('outfit:products-error',{detail:{message}}));
 }
}
function renderProductGrids(){
 const grid=$('productGrid');
 if(grid){
  grid.innerHTML=productsCache.length?productsCache.map(card).join(''):'<p class="helper">Our new collection is being prepared. Check back soon.</p>';
  grid.querySelectorAll('[data-product]').forEach(el=>{
   if(el.dataset.productBound)return;el.dataset.productBound='1';
   const open=()=>openProduct(el.dataset.product);
   el.addEventListener('click',e=>{if(e.target.closest('[data-wishlist]'))return;open();});
   el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
  });
  grid.querySelectorAll('[data-wishlist]').forEach(b=>{if(b.dataset.wishBound)return;b.dataset.wishBound='1';b.addEventListener('click',e=>{e.stopPropagation();toggleWishlist(b.dataset.wishlist);});});
 }
 [['bestSellerGrid',p=>p.best_seller],['featuredGrid',p=>p.featured],['trendingGrid',p=>p.trending]].forEach(([id,test])=>{
  const el=$(id);if(el){const items=productsCache.filter(test);el.innerHTML=items.length?items.map(card).join(''):'<p class="helper">New selections coming soon.</p>';}
 });
 if(typeof activeCategoryFilter!=='undefined'&&activeCategoryFilter&&typeof applyCategoryFilter==='function')applyCategoryFilter(activeCategoryFilter);
}
window.renderProducts=renderProducts;
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
$('bagButton').onclick=openBag;$('closeBag').onclick=closeBag;$('bagDrawer').addEventListener('click',e=>{if(e.target===$('bagDrawer'))closeBag()});
let checkoutStep=1;
let bkashDeliveryConfig={enabled:false,number:''};
async function loadBkashDeliveryConfig(){
 try{const {data,error}=await supabaseClient.from('store_settings').select('value').eq('key','bkash_delivery_payment').maybeSingle();if(error)throw error;const raw=data?.value;bkashDeliveryConfig=raw?JSON.parse(raw):{enabled:false,number:''};if(typeof bkashDeliveryConfig.enabled!=='boolean')bkashDeliveryConfig.enabled=false;if(!bkashDeliveryConfig.enabled)bkashDeliveryConfig.number='';renderBkashCheckout();}catch(error){console.error('Could not load bKash settings:',error);bkashDeliveryConfig={enabled:false,number:''};renderBkashCheckout();}
}
function renderBkashCheckout(){
 const panel=$('bkashDeliveryPanel'),choice=$('bkashPaymentChoice');if(!panel||!choice)return;
 panel.hidden=!bkashDeliveryConfig.enabled;choice.hidden=!bkashDeliveryConfig.enabled;
 const number=$('bkashPayNumber');if(number)number.textContent=bkashDeliveryConfig.number||'Contact store';
 const sender=$('bkashSenderNumber'),trx=$('bkashTrxId');if(sender){sender.required=!!bkashDeliveryConfig.enabled;sender.disabled=!bkashDeliveryConfig.enabled;}if(trx){trx.required=!!bkashDeliveryConfig.enabled;trx.disabled=!bkashDeliveryConfig.enabled;}
 const cod=$('codPaymentChoice');if(cod){cod.querySelector('small').textContent=bkashDeliveryConfig.enabled?'Pay the product amount after delivery. Delivery charge is paid by bKash.':'Pay the full order amount when your parcel arrives';}
 const button=$('placeOrderButton');if(button)button.textContent=bkashDeliveryConfig.enabled?'SUBMIT ORDER · DELIVERY PAID BY BKASH ↗':'PLACE ORDER · FULL COD ↗';
}
function renderCheckoutCart(){
 const host=$('checkoutCartItems');if(!host)return;
 host.innerHTML=cart.map(x=>{const p=productsCache.find(v=>v.id===x.id);const img=p?.image_urls?.[0]||p?.image||'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=220&q=80';return `<article class="checkout-cart-item"><img src="${escapeHtml(img)}" alt="${escapeHtml(x.name)}"><div><b>${escapeHtml(x.name)}</b><small>${escapeHtml(x.size||'One Size')} · ${escapeHtml(x.color||'Standard')} · Qty ${Number(x.qty)}</small><strong>${money(Number(x.price)*Number(x.qty))}</strong></div></article>`}).join('');
 $('checkoutItemCount').textContent=cart.reduce((n,x)=>n+Number(x.qty),0)+' items';$('checkoutCartSubtotal').textContent=money(cart.reduce((n,x)=>n+Number(x.price)*Number(x.qty),0));
}
function renderCheckoutReview(){
 const host=$('checkoutReviewItems');if(host)host.innerHTML=cart.map(x=>`<div><span>${escapeHtml(x.name)} × ${Number(x.qty)}</span><b>${money(Number(x.price)*Number(x.qty))}</b></div>`).join('');
 const subtotal=cart.reduce((n,x)=>n+Number(x.price)*Number(x.qty),0),settings=window.OUTFIT_RELOAD_SETTINGS||{},fee=$('deliveryArea').value==='inside_dhaka'?Number(settings.deliveryInside??80):Number(settings.deliveryOutside??130),discount=Number(appliedCoupon?.discount_amount||0),total=subtotal+fee-discount;
 $('reviewSubtotal').textContent=money(subtotal);$('reviewDelivery').textContent=money(fee);$('reviewTotal').textContent=money(bkashDeliveryConfig.enabled?Math.max(0,total-fee):total);$('reviewDiscountRow').hidden=!appliedCoupon;$('reviewDiscount').textContent='−'+money(discount);const totalLabel=$('reviewTotalLabel');if(totalLabel)totalLabel.textContent=bkashDeliveryConfig.enabled?'Remaining Cash on Delivery':'Total payable on delivery';const deliveryLabel=$('reviewDeliveryLabel');if(deliveryLabel)deliveryLabel.textContent=bkashDeliveryConfig.enabled?'Delivery charge · bKash':'Delivery';
}
function setCheckoutStep(step){checkoutStep=step;document.querySelectorAll('[data-checkout-stage]').forEach(el=>el.hidden=Number(el.dataset.checkoutStage)!==step);document.querySelectorAll('[data-progress]').forEach(el=>{const n=Number(el.dataset.progress);el.classList.toggle('active',n===step);el.classList.toggle('complete',n<step)});if(step===1)renderCheckoutCart();if(step===3)renderCheckoutReview();$('checkoutTitle').textContent=step===1?'Your cart':step===2?'Shipping details':'Payment & review';}
function openCheckout(){if(!cart.length)return;closeBag();$('checkoutForm').reset();appliedCoupon=null;if($('couponMessage'))$('couponMessage').textContent='';$('checkoutError').textContent='';$('checkoutFormWrap').hidden=false;$('orderSuccess').hidden=true;updateCheckoutTotals();setCheckoutStep(1);$('checkoutModal').classList.add('open');$('checkoutModal').setAttribute('aria-hidden','false');document.body.classList.add('no-scroll')}
function closeCheckout(){$('checkoutModal').classList.remove('open');$('checkoutModal').setAttribute('aria-hidden','true');document.body.classList.remove('no-scroll')}
function updateCheckoutTotals(){const subtotal=cart.reduce((n,x)=>n+Number(x.price)*Number(x.qty),0),settings=window.OUTFIT_RELOAD_SETTINGS||{},fee=$('deliveryArea').value==='inside_dhaka'?Number(settings.deliveryInside??80):Number(settings.deliveryOutside??130);$('checkoutSubtotal').textContent=money(subtotal);$('checkoutDelivery').textContent=money(fee);$('checkoutTotal').textContent=money(subtotal+fee-(appliedCoupon?.discount_amount||0));$('couponDiscountRow').hidden=!appliedCoupon;$('checkoutDiscount').textContent='−'+money(appliedCoupon?.discount_amount||0);if(checkoutStep===3)renderCheckoutReview()}
$('trackSuccessOrder')?.addEventListener('click',()=>{const orderInput=document.querySelector('#trackingForm input[name="order_number"]');if(orderInput)orderInput.value=$('successOrderNumber').textContent.trim();closeCheckout();const section=$('track-order');section?.scrollIntoView({behavior:'smooth',block:'start'});document.querySelector('#trackingForm input[name="phone"]')?.focus({preventScroll:true});});
$('bagCheckout').onclick=openCheckout;$('closeCheckout').onclick=closeCheckout;$('checkoutModal').addEventListener('click',e=>{if(e.target===$('checkoutModal'))closeCheckout()});$('deliveryArea').addEventListener('change',updateCheckoutTotals);$('continueShopping').onclick=()=>{closeCheckout();window.scrollTo({top:0,behavior:'smooth'})};
$('checkoutToShipping').onclick=()=>setCheckoutStep(2);
$('checkoutToPayment').onclick=()=>{const form=$('checkoutForm');for(const field of form.querySelectorAll('[data-checkout-stage="2"] input,[data-checkout-stage="2"] select,[data-checkout-stage="2"] textarea')){if(!field.checkValidity()){field.reportValidity();return}}setCheckoutStep(3)};
document.querySelectorAll('[data-checkout-back]').forEach(b=>b.addEventListener('click',()=>setCheckoutStep(Number(b.dataset.checkoutBack))));
$('checkoutForm').addEventListener('submit',async e=>{
 e.preventDefault();
 if(!cart.length){$('checkoutError').textContent='Your bag is empty.';return}
 const form=e.currentTarget;
 const values=Object.fromEntries(new FormData(form).entries());
 const button=$('placeOrderButton');
 if(bkashDeliveryConfig.enabled){const sender=String(values.bkash_sender_number||'').trim(),trx=String(values.bkash_trxid||'').trim();if(sender.replace(/\D/g,'').length<10){$('checkoutError').textContent='Enter the bKash sender number used to make the payment.';return}if(trx.length<6){$('checkoutError').textContent='Enter the bKash Transaction ID (TrxID).';return}}
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
   p_coupon_code:appliedCoupon?.code||null,
   p_bkash_sender_number:bkashDeliveryConfig.enabled?String(values.bkash_sender_number||'').trim():null,
   p_bkash_trxid:bkashDeliveryConfig.enabled?String(values.bkash_trxid||'').trim():null
  });
  if(error)throw error;
  const result=Array.isArray(data)?data[0]:data;
  if(!result?.order_number)throw new Error('Order response was incomplete. Please contact the store before trying again.');
  const total=result.order_total;
  cart=[];saveBag();
  $('checkoutFormWrap').hidden=true;
  $('orderSuccess').hidden=false;
  $('successOrderNumber').textContent=result.order_number;
  saveMyOrder(result.order_number, values.customer_phone);
  const deliveryFee=$('deliveryArea').value==='inside_dhaka'?Number((window.OUTFIT_RELOAD_SETTINGS||{}).deliveryInside??80):Number((window.OUTFIT_RELOAD_SETTINGS||{}).deliveryOutside??130);
  $('successOrderTotal').textContent=bkashDeliveryConfig.enabled?'Delivery charge paid by bKash: '+money(deliveryFee)+' · Remaining COD: '+money(Math.max(0,Number(total)-deliveryFee)):'Total payable on delivery: '+money(total);
 }catch(err){
  console.error('Checkout error:',err);
  $('checkoutError').textContent=err.message||'Your order could not be submitted. Please check your details and try again.';
 }finally{
  button.disabled=false;button.textContent='PLACE ORDER · COD ↗';
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
renderProducts();updateCart();renderBag();ensureMyOrdersUI();renderMyOrders();
// Category tiles filter the live Supabase product list without changing checkout/admin flows.
function applyCategoryFilter(category){
 activeCategoryFilter=category||'';
 const grid=$('productGrid');if(!grid)return;
 const normalize=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const aliases={shoe:['shoe','shoes','footwear'],watch:['watch','watches','accessories'],sweatshirt:['sweatshirt','sweepshirt','sweatshirts','hoodie'],tshirt:['tshirt','tshirts','tee','tees'],shirts:['shirt','shirts'],pants:['pant','pants','jeans','trousers']};
 const wanted=aliases[normalize(category)]||[normalize(category)];
 const filtered=productsCache.filter(p=>{const c=normalize(p.category?.name||p.category||'');return wanted.some(w=>c===w||c.includes(w)||normalize(p.name).includes(w));});
 grid.innerHTML=filtered.length?filtered.map(card).join():'<p class="helper">No products found in this category yet.</p>';
 // Force a real two-column mobile grid after category filtering.
 // The inline important rule prevents other storefront styles from collapsing it to one column.
 if(activeCategoryFilter && window.matchMedia('(max-width:700px)').matches){
  grid.style.setProperty('display','grid','important');
  grid.style.setProperty('grid-template-columns','repeat(2,minmax(0,1fr))','important');
  grid.style.setProperty('width','100%','important');
  grid.style.setProperty('gap','18px 10px','important');
 }else{
  grid.style.removeProperty('display');
  grid.style.removeProperty('grid-template-columns');
  grid.style.removeProperty('width');
  grid.style.removeProperty('gap');
 }
 document.querySelectorAll('.product-grid [data-product]').forEach(el=>{const open=()=>openProduct(el.dataset.product);el.addEventListener('click',open);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}})});document.querySelectorAll('[data-wishlist]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();toggleWishlist(b.dataset.wishlist)}));
 const heading=document.querySelector('#new .section-heading h2');if(heading)heading.innerHTML=activeCategoryFilter?escapeHtml(category)+'<span>.</span>':'New arrivals<span>.</span>';
 document.querySelectorAll('.product-grid').forEach(el=>{if(el.id!=='productGrid')el.closest('.section')?.classList.toggle('category-filter-hidden',!!activeCategoryFilter)});
 if(activeCategoryFilter){$('new').scrollIntoView({behavior:'smooth',block:'start'});}
}
document.querySelectorAll('.category-card[data-category]').forEach(tile=>tile.addEventListener('click',e=>{e.preventDefault();applyCategoryFilter(tile.dataset.category);}));

const nav=$('mainNav');const menuToggle=$('menuToggle');if(!document.querySelector('.category-links')&&nav&&menuToggle){menuToggle.addEventListener('click',()=>{const open=nav.classList.toggle('open');menuToggle.setAttribute('aria-expanded',String(open));menuToggle.setAttribute('aria-label',open?'Close menu':'Open menu')});nav.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{nav.classList.remove('open');menuToggle.setAttribute('aria-expanded','false')}));}
$('newsletterForm')?.addEventListener('submit',e=>{e.preventDefault();alert('Thank you for subscribing!')});
document.addEventListener('outfit:content-loaded',()=>{if($('deliveryArea'))updateCheckoutTotals()});
(async()=>{const {data}=await supabaseClient.from('store_settings').select('value').eq('key','announcement').maybeSingle();const target=$('announcementText')||$('announcement');if(data?.value&&target)target.textContent=data.value;})();
loadBkashDeliveryConfig();


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
  const {data:paymentInfo,error:paymentError}=await supabaseClient.rpc('track_customer_bkash_payment',{
   p_order_number:String(values.order_number||'').trim().toUpperCase(),
   p_phone:String(values.phone||'').trim()
  });
  if(paymentError)throw paymentError;
  const bkashStatus=paymentInfo?.bkash_payment_status||'not_required';
  const bkashLabels={pending:'Pending · Payment is being reviewed',verified:'Verified · Payment confirmed',rejected:'Rejected · Payment was not accepted',not_required:'Not required · Cash on Delivery'};
  const showBkash=paymentInfo?.payment_method==='bkash_delivery_cod';
  const paymentPanel=showBkash?`<div class="tracking-meta"><div><span>bKash delivery payment</span><strong>${escapeHtml(bkashLabels[bkashStatus]||'Status unavailable')}</strong><small>Delivery fee: ${money(paymentInfo.delivery_fee)}</small></div></div>`:'';
  resultBox.innerHTML=`<h3>Order ${escapeHtml(data.order_number)}</h3><span class="tracking-status">${escapeHtml(statusLabels[data.status]||data.status)}</span>${paymentPanel}<div class="tracking-meta"><div><span>Order date</span><strong>${escapeHtml(new Date(data.created_at).toLocaleDateString('en-GB'))}</strong></div><div><span>Order status</span><strong>${escapeHtml(statusLabels[data.status]||data.status)}</strong></div><div><span>Delivery area</span><strong>${data.delivery_area==='inside_dhaka'?'Inside Dhaka':'Outside Dhaka'}</strong></div><div><span>Total payable</span><strong>${money(data.total)}</strong></div></div><div class="tracking-items"><b>Order items</b>${items.map(item=>`<div class="tracking-item"><span>${escapeHtml(item.product_name)} · ${escapeHtml(item.size||'One Size')} / ${escapeHtml(item.color||'Default')} × ${Number(item.quantity)}</span><strong>${money(item.line_total)}</strong></div>`).join('')}</div>`;
  resultBox.hidden=false;
 }catch(err){console.error('Order tracking error:',err);errorBox.textContent=err.message||'Unable to look up this order right now.';}
 finally{button.disabled=false;button.textContent='TRACK ORDER ↗';}
});


// My Orders: keep recent order references on this device only. The existing
// secure Supabase RPCs still verify each order using its order number + phone.
const MY_ORDERS_KEY='or_my_orders_v1';
function getMyOrders(){try{const v=JSON.parse(localStorage.getItem(MY_ORDERS_KEY)||'[]');return Array.isArray(v)?v.filter(x=>x&&x.order_number&&x.phone).slice(0,10):[]}catch(_){return []}}
function saveMyOrder(orderNumber,phone){
 const order={order_number:String(orderNumber||'').trim().toUpperCase(),phone:String(phone||'').trim(),saved_at:new Date().toISOString()};
 if(!order.order_number||!order.phone)return;
 const all=getMyOrders().filter(x=>x.order_number!==order.order_number);
 all.unshift(order);
 try{localStorage.setItem(MY_ORDERS_KEY,JSON.stringify(all.slice(0,10)))}catch(err){console.warn('Could not save this order on this device:',err)}
 renderMyOrders();
}
function ensureMyOrdersUI(){ return; }

async function getSavedOrderStatus(order){
 const args={p_order_number:order.order_number,p_phone:order.phone};
 const [{data,error},{data:paymentInfo,error:paymentError}]=await Promise.all([
  supabaseClient.rpc('track_customer_order',args),
  supabaseClient.rpc('track_customer_bkash_payment',args)
 ]);
 if(error)throw error;if(paymentError)throw paymentError;
 if(!data||data.found!==true)throw new Error('Order could not be verified.');
 return {data,paymentInfo};
}
async function renderMyOrders(refresh=false){
 ensureMyOrdersUI();const list=$('myOrdersList');if(!list)return;
 const orders=getMyOrders();
 if(!orders.length){list.innerHTML='<p class="my-orders-empty">No saved orders yet. After you place an order on this device, it will appear here automatically.</p>';return}
 const statusLabels={pending:'Pending',confirmed:'Confirmed',processing:'Processing',shipped:'Shipped',delivered:'Delivered',cancelled:'Cancelled'};
 const bkashLabels={pending:'bKash · Pending',verified:'bKash · Verified',rejected:'bKash · Rejected',not_required:'Cash on Delivery'};
 list.innerHTML=orders.map((o,i)=>`<article class="my-order-card" data-my-order="${i}"><div class="my-order-main"><strong>${escapeHtml(o.order_number)}</strong><small>Saved ${escapeHtml(new Date(o.saved_at||Date.now()).toLocaleDateString('en-GB'))}</small><span class="my-order-state" data-order-status>Loading latest status…</span><small data-payment-status></small></div><div class="my-order-actions"><button type="button" class="my-order-action" data-refresh-order="${i}">REFRESH ↻</button><button type="button" class="my-order-action remove" data-remove-order="${i}">REMOVE</button></div></article>`).join('');
 list.querySelectorAll('[data-remove-order]').forEach(btn=>btn.addEventListener('click',()=>{const next=getMyOrders();next.splice(Number(btn.dataset.removeOrder),1);localStorage.setItem(MY_ORDERS_KEY,JSON.stringify(next));renderMyOrders()}));
 list.querySelectorAll('[data-refresh-order]').forEach(btn=>btn.addEventListener('click',()=>refreshOne(Number(btn.dataset.refreshOrder),btn)));
 const jobs=orders.map((order,i)=>refreshOne(i,null));
 await Promise.allSettled(jobs);
 async function refreshOne(index,button){
  const order=orders[index],card=list.querySelector(`[data-my-order="${index}"]`);if(!card)return;
  const status=card.querySelector('[data-order-status]'),payment=card.querySelector('[data-payment-status]');
  if(button){button.disabled=true;button.textContent='CHECKING…'}
  try{
   const {data,paymentInfo}=await getSavedOrderStatus(order);
   status.textContent=statusLabels[data.status]||String(data.status||'Status unavailable');
   const bkashStatus=paymentInfo?.bkash_payment_status||'not_required';
   payment.textContent=paymentInfo?.payment_method==='bkash_delivery_cod'?(bkashLabels[bkashStatus]||'bKash · Status unavailable'):'Cash on Delivery';
  }catch(err){status.textContent='Could not refresh';payment.textContent='Check your connection or use Track Order below.';console.warn('My Orders refresh:',err)}
  finally{if(button){button.disabled=false;button.textContent='REFRESH ↻'}}
 }
}


// Wishlist is stored locally on this device; it does not require customer accounts.
function toggleWishlist(id){if(wishlist.has(id))wishlist.delete(id);else wishlist.add(id);localStorage.setItem('or_wishlist',JSON.stringify([...wishlist]));document.querySelectorAll(`[data-wishlist="${CSS.escape(id)}"]`).forEach(b=>{const on=wishlist.has(id);b.classList.toggle('active',on);b.textContent=on?'♥':'♡';b.setAttribute('aria-label',on?'Remove from wishlist':'Add to wishlist')});}
document.addEventListener('click',e=>{const heart=e.target.closest('[data-wishlist]');if(heart){e.preventDefault();e.stopPropagation();toggleWishlist(heart.dataset.wishlist);}});
document.querySelector('.header-heart')?.addEventListener('click',()=>{const ids=[...wishlist];if(!ids.length){alert('Your wishlist is empty. Tap the heart on a product to save it.');return}const names=ids.map(id=>productsCache.find(p=>p.id===id)).filter(Boolean).map(p=>'• '+p.name);alert('YOUR WISHLIST\n\n'+(names.join('\n')||'Saved products are currently unavailable.'));});
async function loadProductReviews(id){const host=$('productReviews');host.innerHTML='<p class="helper">Loading reviews…</p>';const {data,error}=await supabaseClient.from('product_reviews').select('customer_name,rating,review_text,created_at').eq('product_id',id).eq('is_approved',true).order('created_at',{ascending:false}).limit(12);if(error){host.innerHTML='<p class="helper">Reviews are temporarily unavailable.</p>';return}host.innerHTML=(data||[]).map(r=>`<article class="product-review-card"><div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div><p>${escapeHtml(r.review_text)}</p><small>${escapeHtml(r.customer_name)} · ${new Date(r.created_at).toLocaleDateString()}</small></article>`).join('')||'<p class="helper">No approved reviews yet. Be the first to review this product.</p>';}
$('reviewForm')?.addEventListener('submit',async e=>{e.preventDefault();if(!activeProduct)return;const f=e.currentTarget,v=Object.fromEntries(new FormData(f).entries()),status=$('reviewMessage');status.textContent='Submitting…';const {error}=await supabaseClient.from('product_reviews').insert({product_id:activeProduct.id,customer_name:v.customer_name.trim(),rating:Number(v.rating),review_text:v.review_text.trim(),is_approved:Number(v.rating)>=4});if(error){status.textContent='Could not submit review: '+error.message;return}f.reset();status.textContent=Number(v.rating)>=4?'Thank you! Your review is now published.':'Thank you! Your review has been sent for admin approval.';});
async function loadHomepageReviews(){const host=$('homepageReviews');if(!host)return;const {data,error}=await supabaseClient.from('product_reviews').select('customer_name,rating,review_text,products(name)').eq('is_approved',true).order('created_at',{ascending:false}).limit(6);if(error){host.innerHTML='<p class="helper">Customer reviews will appear here.</p>';return}host.innerHTML=(data||[]).map(r=>`<article class="review-card"><div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div><p>${escapeHtml(r.review_text)}</p><b>${escapeHtml(r.customer_name)}</b><br><small>${escapeHtml(r.products?.name||'Outfit Reload customer')}</small></article>`).join('')||'<p class="helper">Be the first to share your experience with Outfit Reload.</p>';}
$('applyCoupon')?.addEventListener('click',async()=>{const code=$('couponCode').value.trim(),msg=$('couponMessage'),subtotal=cart.reduce((n,x)=>n+x.price*x.qty,0);if(!code){msg.textContent='Enter a coupon code first.';return}msg.textContent='Checking coupon…';const {data,error}=await supabaseClient.rpc('validate_discount_coupon',{p_code:code,p_subtotal:subtotal});const r=Array.isArray(data)?data[0]:data;if(error||!r?.valid){appliedCoupon=null;msg.textContent=error?.message||r?.message||'Coupon could not be applied.';updateCheckoutTotals();return}appliedCoupon={code:r.code,discount_amount:Number(r.discount_amount)};msg.textContent=r.message+' You saved '+money(appliedCoupon.discount_amount)+'.';updateCheckoutTotals();});
loadHomepageReviews();


// Open the existing shopping bag when a standalone product page sends a customer back here.
window.addEventListener('load',()=>{
 const params=new URLSearchParams(window.location.search);
 if(params.get('openBag')==='1'){
  params.delete('openBag');
  const cleanUrl=window.location.pathname+(params.toString()?'?'+params.toString():'')+window.location.hash;
  window.history.replaceState({},'',cleanUrl);
  openBag();
 }
});
