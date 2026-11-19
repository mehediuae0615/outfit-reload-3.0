const sb=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);
const $=id=>document.getElementById(id);
const login=$('adminLogin'), app=$('adminApp'), msg=$('loginMessage');
let editingId=null, existingImages=[];
function safe(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function splitList(v){return [...new Set(String(v||'').split(',').map(x=>x.trim()).filter(Boolean))]}
function toLocalDateTime(value){if(!value)return '';const d=new Date(value);if(Number.isNaN(d.getTime()))return '';const pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`}
async function checkSession(){
 const {data:{session}}=await sb.auth.getSession();
 if(!session){login.hidden=false;app.hidden=true;return}
 const {data:owner,error}=await sb.from('admin_users').select('role,email').eq('user_id',session.user.id).maybeSingle();
 if(error||!owner){await sb.auth.signOut();login.hidden=false;app.hidden=true;msg.textContent='This account is not authorized as an admin.';return}
 login.hidden=true;app.hidden=false;$('adminEmail').textContent=owner.email||session.user.email;await loadProducts();await loadAnalyticsInventory();await loadAnnouncement();await loadOrders();await loadWebsiteContent();await loadBkashSettings();await loadCoupons();await loadReviews();
}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();msg.textContent='Signing in…';const {error}=await sb.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value});if(error){msg.textContent=error.message;return}msg.textContent='';await checkSession()});
$('logoutBtn').addEventListener('click',async()=>{await sb.auth.signOut();await checkSession()});
async function loadProducts(){
 const {data,error}=await sb.from('products').select('id,name,sku,price,sale_price,stock,is_active,new_arrival,best_seller,featured,trending,categories(name)').order('created_at',{ascending:false});
 if(error){$('adminProductRows').innerHTML=`<tr><td colspan="7">Could not load products: ${safe(error.message)}</td></tr>`;return}
 $('productTotal').textContent=data.length;
 $('adminProductRows').innerHTML=data.map(p=>`<tr><td><strong>${safe(p.name)}</strong><br><small>${safe(p.sku||'SKU pending')}</small></td><td>${safe(p.categories?.name||'—')}</td><td>${p.sale_price&&Number(p.sale_price)>0&&Number(p.sale_price)<Number(p.price)?`<strong>৳ ${Number(p.sale_price).toLocaleString('en-BD')}</strong><br><small><s>৳ ${Number(p.price).toLocaleString('en-BD')}</s></small>`:`৳ ${Number(p.price).toLocaleString('en-BD')}`}</td><td>${Number(p.stock)||0}</td><td><span class="pill">${p.is_active?'Active':'Hidden'}</span></td><td><button data-edit="${p.id}" class="table-action">Edit</button> <button data-delete="${p.id}" class="table-action danger">Delete</button></td></tr>`).join('')||'<tr><td colspan="7">No products yet. Add your first product.</td></tr>';
 document.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('Delete this product permanently?'))return;const {error}=await sb.from('products').delete().eq('id',b.dataset.delete);if(error)alert(error.message);else await loadProducts()}));
 document.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>openEdit(b.dataset.edit)));
}
const modal=$('productModal');
function resetForm(){editingId=null;existingImages=[];$('productForm').reset();$('modalTitle').textContent='Add a product';$('saveProductBtn').textContent='SAVE PRODUCT ONLINE';$('existingImages').textContent='';$('variantRows').innerHTML='';$('pSaleStarts').value='';$('pSaleEnds').value='';$('pActive').checked=true}
$('addProductBtn').addEventListener('click',()=>{resetForm();modal.classList.add('open')});
$('closeModal').addEventListener('click',()=>modal.classList.remove('open'));
modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('open')});
$('generateVariants').addEventListener('click',()=>renderVariantRows());
function renderVariantRows(existing=[]){
 const sizes=splitList($('pSizes').value), colors=splitList($('pColors').value);
 const rows=[]; (sizes.length?sizes:['One Size']).forEach(size=>(colors.length?colors:['Default']).forEach(color=>rows.push({size,color,stock:existing.find(v=>v.size===size&&v.color===color)?.stock??Number($('pStock').value||0)})));
 $('variantRows').innerHTML=rows.map((v,i)=>`<div class="variant-row"><span>${safe(v.size)} · ${safe(v.color)}</span><label>Stock<input type="number" min="0" data-vstock="${i}" value="${v.stock}"></label><input type="hidden" data-vsize="${i}" value="${safe(v.size)}"><input type="hidden" data-vcolor="${i}" value="${safe(v.color)}"></div>`).join('');
}
async function openEdit(id){
 const {data:p,error}=await sb.from('products').select('*').eq('id',id).single();if(error){alert(error.message);return}
 const {data:cat}=await sb.from('categories').select('name').eq('id',p.category_id).single();
 const {data:variants, error:ve}=await sb.from('product_variants').select('size,color,stock').eq('product_id',id);
 if(ve){alert('Could not load variants: '+ve.message);return}
 editingId=id;existingImages=p.image_urls||[];
 $('modalTitle').textContent='Edit product';$('saveProductBtn').textContent='UPDATE PRODUCT';
 $('pName').value=p.name||'';$('pCategory').value=cat?.name||'Shirts';$('pPrice').value=p.price||'';$('pSalePrice').value=p.sale_price||'';$('pSaleStarts').value=toLocalDateTime(p.sale_starts_at);$('pSaleEnds').value=toLocalDateTime(p.sale_ends_at);$('pStock').value=p.stock||0;$('pDescription').value=p.description||'';$('pMaterial').value=p.material||'';$('pSizeGuide').value=p.size_guide||'';
 $('pSizes').value=(p.sizes||[]).join(', ');$('pColors').value=(p.colors||[]).join(', ');
 $('pNewArrival').checked=!!p.new_arrival;$('pBestSeller').checked=!!p.best_seller;$('pFeatured').checked=!!p.featured;$('pTrending').checked=!!p.trending;$('pActive').checked=!!p.is_active;
 $('existingImages').textContent=existingImages.length?`Current images: ${existingImages.length}. New uploads will be added.`:'No current images.';
 renderVariantRows(variants||[]);modal.classList.add('open');
}
$('productForm').addEventListener('submit',async e=>{
 e.preventDefault();const btn=$('saveProductBtn');const wasEditing=!!editingId;btn.disabled=true;btn.textContent='SAVING…';
 try{
  const name=$('pName').value.trim(),category=$('pCategory').value,price=Number($('pPrice').value),saleRaw=$('pSalePrice').value.trim(),sale_price=saleRaw===''?null:Number(saleRaw),stock=Number($('pStock').value),startsRaw=$('pSaleStarts').value,endsRaw=$('pSaleEnds').value;
   if(sale_price!==null&&(sale_price<=0||sale_price>=price))throw new Error('Sale Price must be greater than 0 and lower than Regular Price.');
   if((startsRaw&&!endsRaw)||(!startsRaw&&endsRaw))throw new Error('For a Flash Sale, set both start and end times.');
   if((startsRaw||endsRaw)&&sale_price===null)throw new Error('Enter a Sale Price before setting Flash Sale times.');
   const sale_starts_at=startsRaw?new Date(startsRaw).toISOString():null,sale_ends_at=endsRaw?new Date(endsRaw).toISOString():null;
   if(sale_starts_at&&new Date(sale_ends_at)<=new Date(sale_starts_at))throw new Error('Flash Sale end time must be after its start time.');
  const {data:cat,error:ce}=await sb.from('categories').select('id').eq('name',category).single();if(ce)throw ce;
  const files=[...$('pImages').files], urls=[...existingImages];
  for(const file of files){const ext=(file.name.split('.').pop()||'jpg').toLowerCase(),filePath=`${crypto.randomUUID()}.${ext}`;const {error:ue}=await sb.storage.from('product-images').upload(filePath,file,{upsert:false,contentType:file.type});if(ue)throw ue;const {data}=sb.storage.from('product-images').getPublicUrl(filePath);urls.push(data.publicUrl)}
  const payload={name,slug:name.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-'+Date.now().toString().slice(-5),category_id:cat.id,price,sale_price,sale_starts_at,sale_ends_at,stock,description:$('pDescription').value.trim(),material:$('pMaterial').value.trim(),size_guide:$('pSizeGuide').value.trim(),image_urls:urls,sizes:splitList($('pSizes').value),colors:splitList($('pColors').value),new_arrival:$('pNewArrival').checked,best_seller:$('pBestSeller').checked,featured:$('pFeatured').checked,trending:$('pTrending').checked,is_active:$('pActive').checked,updated_at:new Date().toISOString()};
  let productId=editingId;
  if(editingId){const {error}=await sb.from('products').update(payload).eq('id',editingId);if(error)throw error;}
  else{payload.sku='OR-'+Date.now().toString().slice(-8);const {data,error}=await sb.from('products').insert(payload).select('id').single();if(error)throw error;productId=data.id;}
  const {error:delError}=await sb.from('product_variants').delete().eq('product_id',productId);if(delError)throw delError;
  const variantRows=[...document.querySelectorAll('[data-vstock]')].map((el,i)=>({product_id:productId,size:document.querySelector(`[data-vsize="${i}"]`).value,color:document.querySelector(`[data-vcolor="${i}"]`).value,stock:Number(el.value)}));
  if(variantRows.length){const {error}=await sb.from('product_variants').insert(variantRows);if(error)throw error;}
  e.target.reset();modal.classList.remove('open');await loadProducts();alert(wasEditing?'Product updated successfully.':'Product saved to the live store.');resetForm();
 }catch(err){alert('Could not save product: '+(err.message||err))}finally{btn.disabled=false;btn.textContent=wasEditing?'UPDATE PRODUCT':'SAVE PRODUCT ONLINE'}
});
async function loadAnnouncement(){const {data}=await sb.from('store_settings').select('value').eq('key','announcement').maybeSingle();if(data?.value)$('announcementInput').value=data.value}

// bKash delivery-charge settings (stored in the existing store_settings table)
async function loadBkashSettings(){
 const message=$('bkashSettingsMessage');
 const {data,error}=await sb.from('store_settings').select('value').eq('key','bkash_delivery_payment').maybeSingle();
 if(error){message.textContent='Could not load bKash settings: '+error.message;return}
 let settings={};try{settings=JSON.parse(data?.value||'{}')}catch{}
 $('bkashDeliveryEnabled').checked=settings.enabled===true;
 $('bkashPaymentNumber').value=settings.number||'';
 message.textContent=data?'Saved settings loaded.':'bKash payment is currently OFF.';
}
$('saveBkashSettings')?.addEventListener('click',async()=>{
 const button=$('saveBkashSettings'),message=$('bkashSettingsMessage');
 const enabled=$('bkashDeliveryEnabled').checked,number=$('bkashPaymentNumber').value.trim();
 if(enabled&&!/^\+?[0-9][0-9\s-]{7,17}$/.test(number)){message.textContent='Enter a valid bKash number before enabling payment.';return}
 button.disabled=true;button.textContent='SAVING…';message.textContent='Saving payment settings…';
 try{
  const value=JSON.stringify({enabled,number});
  const {error}=await sb.from('store_settings').upsert({key:'bkash_delivery_payment',value},{onConflict:'key'});
  if(error)throw error;
  message.textContent=enabled?'bKash delivery payment is enabled.':'bKash delivery payment is disabled. Full COD remains available.';
 }catch(error){message.textContent='Save failed: '+(error.message||error)}
 finally{button.disabled=false;button.textContent='SAVE PAYMENT SETTINGS'}
});
$('saveAnnouncement').addEventListener('click',async()=>{const value=$('announcementInput').value.trim();const {error}=await sb.from('store_settings').upsert({key:'announcement',value},{onConflict:'key'});if(error){alert('Could not save announcement: '+error.message);return}alert('Announcement updated.')});

// CENTRAL WEBSITE CONTENT MANAGER
const cmsPages=[['index','Homepage','index.html'],['about','About Us','about.html'],['contact','Contact','contact.html'],['shipping-policy','Shipping Policy','shipping-policy.html'],['return-policy','Return & Refund Policy','return-policy.html'],['privacy-policy','Privacy Policy','privacy-policy.html'],['terms','Terms & Conditions','terms.html']];
const cmsSelector='main h1,main h2,main h3,main p,main li';
function cmsNodes(doc){return Array.from(doc.querySelectorAll(cmsSelector)).filter(el=>!el.closest('a,button,label,script,style,.product-grid,.helper,[hidden]')&&!el.querySelector('a')&&!el.querySelector('button')&&el.textContent.trim())}
let cmsPageValues={};
async function loadWebsiteContent(){
 const status=$('contentManagerStatus');status.textContent='Loading saved settings and page content…';
 const {data,error}=await sb.from('store_settings').select('key,value');if(error){status.textContent='Could not load content: '+error.message;return}
 const settings=Object.fromEntries((data||[]).map(x=>[x.key,x.value]));
 try{const g=JSON.parse(settings.cms_global||'{}');$('cmsWhatsapp').value=g.whatsapp||'8801404609229';$('cmsPhone').value=g.phone||'+8801404609229';$('cmsEmail').value=g.email||'';$('cmsAddress').value=g.address||'Bangladesh';$('cmsFacebook').value=g.facebook||'https://www.facebook.com/share/1EJTjHfKdm/?mibextid=wwXIfr';$('cmsInstagram').value=g.instagram||'';$('cmsTiktok').value=g.tiktok||'';$('cmsOtherSocial').value=g.otherSocial||'';$('cmsFeeInside').value=g.deliveryInside??80;$('cmsFeeOutside').value=g.deliveryOutside??130;$('cmsTimeInside').value=g.deliveryTimeInside||'1–2 Days';$('cmsTimeOutside').value=g.deliveryTimeOutside||'2–5 Days';$('cmsReturnDays').value=g.returnDays??7}catch(e){status.textContent='Saved settings could not be parsed.';return}
 const host=$('websiteContentEditor');host.innerHTML='';
 for(const [slug,title,file] of cmsPages){
  const response=await fetch(file);if(!response.ok)continue;const html=await response.text();const doc=new DOMParser().parseFromString(html,'text/html');const nodes=cmsNodes(doc);
  let values=nodes.map(n=>n.textContent.trim());try{if(settings['cms_page_'+slug])values=JSON.parse(settings['cms_page_'+slug])}catch{}
  cmsPageValues[slug]=values;
  const group=document.createElement('details');group.className='cms-page-group';group.open=slug==='index';
  const summary=document.createElement('summary');summary.textContent=title+' · '+nodes.length+' editable text fields';group.appendChild(summary);
  const list=document.createElement('div');list.className='cms-text-list';
  nodes.forEach((node,i)=>{const wrap=document.createElement('label');wrap.className='cms-field';const tag=node.tagName.toLowerCase();const label=document.createElement('span');label.textContent=(i+1)+'. '+tag.toUpperCase()+' — '+(node.textContent.trim().slice(0,65)||'Text');const area=document.createElement('textarea');area.value=values[i]??node.textContent.trim();area.dataset.cmsPage=slug;area.dataset.cmsIndex=i;area.rows=Math.min(5,Math.max(2,Math.ceil(area.value.length/85)));wrap.append(label,area);list.appendChild(wrap)});
  group.appendChild(list);host.appendChild(group);
 }
 status.textContent='Loaded. Edit any field, then tap SAVE ALL WEBSITE CONTENT.';
}
$('saveWebsiteContent')?.addEventListener('click',async()=>{
 const btn=$('saveWebsiteContent'),status=$('contentManagerStatus');btn.disabled=true;btn.textContent='SAVING…';status.textContent='Saving website content…';
 try{
  const globals={whatsapp:$('cmsWhatsapp').value.trim(),phone:$('cmsPhone').value.trim(),email:$('cmsEmail').value.trim(),address:$('cmsAddress').value.trim(),facebook:$('cmsFacebook').value.trim(),instagram:$('cmsInstagram').value.trim(),tiktok:$('cmsTiktok').value.trim(),otherSocial:$('cmsOtherSocial').value.trim(),deliveryInside:Number($('cmsFeeInside').value),deliveryOutside:Number($('cmsFeeOutside').value),deliveryTimeInside:$('cmsTimeInside').value.trim(),deliveryTimeOutside:$('cmsTimeOutside').value.trim(),returnDays:Number($('cmsReturnDays').value)};
  if(!Number.isFinite(globals.deliveryInside)||globals.deliveryInside<0||!Number.isFinite(globals.deliveryOutside)||globals.deliveryOutside<0||!Number.isFinite(globals.returnDays)||globals.returnDays<0)throw new Error('Delivery charges and return days must be zero or greater.');
  const rows=[{key:'cms_global',value:JSON.stringify(globals)},{key:'delivery_inside',value:String(globals.deliveryInside)},{key:'delivery_outside',value:String(globals.deliveryOutside)}];
  for(const [slug] of cmsPages){const fields=[...document.querySelectorAll(`[data-cms-page="${slug}"]`)];rows.push({key:'cms_page_'+slug,value:JSON.stringify(fields.map(x=>x.value))})}
  const {error}=await sb.from('store_settings').upsert(rows,{onConflict:'key'});if(error)throw error;
  status.textContent='Saved successfully. Refresh the live website to see your changes.';alert('Website content saved successfully.');
 }catch(err){status.textContent='Save failed: '+(err.message||err);alert('Could not save website content: '+(err.message||err))}finally{btn.disabled=false;btn.textContent='SAVE ALL WEBSITE CONTENT'}
});

$('adminMenu').addEventListener('click',()=>$('sidebar').classList.toggle('open'));
checkSession();


// LIVE ORDER MANAGEMENT
const orderStatuses=['pending','confirmed','processing','shipped','delivered','cancelled'];
const statusLabels={pending:'Pending',confirmed:'Confirmed',processing:'Processing',shipped:'Shipped',delivered:'Delivered',cancelled:'Cancelled'};
let cachedOrders=[];
function money(v){return '৳ '+Number(v||0).toLocaleString('en-BD',{maximumFractionDigits:2})}
function dateLabel(v){try{return new Date(v).toLocaleString('en-BD',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}catch{return '—'}}
function renderOrders(){
 const filter=$('orderStatusFilter')?.value||'all';
 const rows=cachedOrders.filter(o=>filter==='all'||o.status===filter);
 $('orderCount').textContent=`${rows.length} order${rows.length===1?'':'s'}`;
 $('adminOrderRows').innerHTML=rows.map(o=>{
  const items=(o.order_items||[]).map(i=>`<li>${safe(i.product_name)} · ${safe(i.size||'—')} / ${safe(i.color||'—')} × ${Number(i.quantity)} — ${money(i.line_total)}</li>`).join('');
  const area=o.delivery_area==='inside_dhaka'?'Inside Dhaka':'Outside Dhaka';
  const options=orderStatuses.map(st=>`<option value="${st}" ${o.status===st?'selected':''}>${statusLabels[st]}</option>`).join('');
  return `<tr class="order-main-row"><td><strong>${safe(o.order_number)}</strong><br><small>${safe(o.payment_method||'cod').toUpperCase()}</small><details class="order-details"><summary>View details</summary><div class="order-detail-box"><b>Delivery:</b> ${area}<br><b>Address:</b> ${safe(o.delivery_address)}<br><b>Phone:</b> ${safe(o.customer_phone)}<br><b>Email:</b> ${safe(o.customer_email||'Not provided')}<br><b>Note:</b> ${safe(o.customer_note||'—')}<br><b>Items:</b><ul>${items||'<li>No item details</li>'}</ul><div>Subtotal ${money(o.subtotal)} · Delivery ${money(o.delivery_fee)} · <b>Total ${money(o.total)}</b></div></div></details></td><td><b>${safe(o.customer_name)}</b><br><small>${safe(o.customer_phone)}</small></td><td>${dateLabel(o.created_at)}</td><td><b>${money(o.total)}</b></td><td><span class="pill status-${safe(o.status)}">${statusLabels[o.status]||safe(o.status)}</span></td><td><div class="order-action"><select data-status-select="${o.id}" aria-label="New status for ${safe(o.order_number)}">${options}</select><button class="table-action" data-save-status="${o.id}" ${o.status==='cancelled'?'disabled':''}>Save</button></div></td></tr>`;
 }).join('')||`<tr><td colspan="6">${filter==='all'?'No orders found yet.':'No '+safe(filter)+' orders.'}</td></tr>`;
 document.querySelectorAll('[data-save-status]').forEach(btn=>btn.addEventListener('click',()=>saveOrderStatus(btn.dataset.saveStatus,btn)));
}
async function loadOrders(){
 const target=$('adminOrderRows');if(!target)return;
 $('ordersMessage').textContent='Loading orders…';
 const {data,error}=await sb.from('orders').select('id,order_number,customer_name,customer_phone,customer_email,delivery_area,delivery_address,customer_note,payment_method,status,subtotal,delivery_fee,total,created_at,order_items(id,product_name,unit_price,size,color,quantity,line_total)').order('created_at',{ascending:false});
 if(error){target.innerHTML=`<tr><td colspan="6">Could not load orders: ${safe(error.message)}</td></tr>`;$('ordersMessage').textContent='Check that the checkout database setup has been run and admin policies are active.';return}
 cachedOrders=data||[];renderOrders();
 const totalSales=cachedOrders.filter(o=>o.status!=='cancelled').reduce((sum,o)=>sum+Number(o.total||0),0);
 const statCards=document.querySelectorAll('#overview .stat-card');
 if(statCards[0])statCards[0].querySelector('strong').textContent=money(totalSales);
 if(statCards[1])statCards[1].querySelector('strong').textContent=String(cachedOrders.length);
 if(statCards[1])statCards[1].querySelector('small').textContent=`${cachedOrders.filter(o=>o.status==='pending').length} pending`;
 $('ordersMessage').textContent=cachedOrders.length?`Showing ${cachedOrders.length} live order(s).`:'No customer orders yet.';
 renderAnalytics();
}
async function saveOrderStatus(id,btn){
 const select=document.querySelector(`[data-status-select="${id}"]`);const status=select?.value;
 if(!orderStatuses.includes(status))return;
 if(status==='cancelled'&&!confirm('Cancel this order? Its reserved stock will be returned to inventory.'))return;
 btn.disabled=true;btn.textContent='Saving…';
 const {error}=await sb.rpc('admin_update_order_status',{p_order_id:id,p_new_status:status});
 if(error){alert('Could not update order: '+error.message);btn.disabled=false;btn.textContent='Save';return}
 $('ordersMessage').textContent='Order status updated successfully.';await loadOrders();
}
$('refreshOrders')?.addEventListener('click',loadOrders);
$('orderStatusFilter')?.addEventListener('change',renderOrders);


// Coupon administration
async function loadCoupons(){const host=$('couponRows');if(!host)return;const {data,error}=await sb.from('discount_coupons').select('*').order('created_at',{ascending:false});if(error){host.innerHTML=`<tr><td colspan="5">${safe(error.message)} — run the wishlist/reviews/coupons SQL upgrade.</td></tr>`;return}host.innerHTML=(data||[]).map(c=>`<tr><td><b>${safe(c.code)}</b></td><td>${c.discount_type==='percent'?Number(c.discount_value)+'%':'৳ '+Number(c.discount_value)}</td><td>${c.used_count}${c.usage_limit?'/'+c.usage_limit:''}</td><td>${c.is_active?'Active':'Disabled'}</td><td><button class="table-action" data-coupon-toggle="${c.id}" data-active="${c.is_active}">${c.is_active?'Disable':'Enable'}</button> <button class="table-action danger" data-coupon-delete="${c.id}">Delete</button></td></tr>`).join('')||'<tr><td colspan="5">No coupons created yet.</td></tr>';host.querySelectorAll('[data-coupon-toggle]').forEach(b=>b.onclick=async()=>{const {error}=await sb.from('discount_coupons').update({is_active:b.dataset.active!=='true'}).eq('id',b.dataset.couponToggle);if(error)alert(error.message);else loadCoupons()});host.querySelectorAll('[data-coupon-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('Delete this coupon?'))return;const {error}=await sb.from('discount_coupons').delete().eq('id',b.dataset.couponDelete);if(error)alert(error.message);else loadCoupons()});}
$('couponForm')?.addEventListener('submit',async e=>{e.preventDefault();const msg=$('couponAdminMessage');const code=$('couponCodeAdmin').value.trim().toUpperCase();const value=Number($('couponValue').value);if(!/^[A-Z0-9_-]{3,32}$/.test(code)){msg.textContent='Use 3–32 letters, numbers, hyphens or underscores.';return}const payload={code,discount_type:$('couponType').value,discount_value:value,min_order_amount:Number($('couponMinimum').value||0),max_discount:$('couponMaximum').value===''?null:Number($('couponMaximum').value),usage_limit:$('couponLimit').value===''?null:Number($('couponLimit').value),starts_at:$('couponStarts').value?new Date($('couponStarts').value).toISOString():null,expires_at:$('couponExpires').value?new Date($('couponExpires').value).toISOString():null,is_active:true};const {error}=await sb.from('discount_coupons').insert(payload);if(error){msg.textContent='Could not save coupon: '+error.message;return}e.target.reset();msg.textContent='Coupon saved successfully.';loadCoupons()});
async function loadReviews(){const host=$('reviewAdminRows');if(!host)return;const {data,error}=await sb.from('product_reviews').select('id,customer_name,rating,review_text,is_approved,created_at,products(name)').order('created_at',{ascending:false});if(error){host.innerHTML=`<tr><td colspan="5">${safe(error.message)} — run the SQL upgrade.</td></tr>`;return}host.innerHTML=(data||[]).map(r=>`<tr><td><b>${safe(r.products?.name||'Deleted product')}</b><br><small>${safe(r.customer_name)}</small></td><td>${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</td><td>${safe(r.review_text)}</td><td>${r.is_approved?'Approved':'Pending'}</td><td>${r.is_approved?`<button class="table-action" data-review-action="hide" data-review-id="${r.id}">Hide</button>`:`<button class="table-action" data-review-action="approve" data-review-id="${r.id}">Approve</button>`} <button class="table-action danger" data-review-action="delete" data-review-id="${r.id}">Delete</button></td></tr>`).join('')||'<tr><td colspan="5">No reviews submitted yet.</td></tr>';host.querySelectorAll('[data-review-action]').forEach(b=>b.onclick=async()=>{const action=b.dataset.reviewAction;if(action==='delete'&&!confirm('Delete this review?'))return;const update=action==='approve'?{is_approved:true}:action==='hide'?{is_approved:false}:null;const q=update?sb.from('product_reviews').update(update).eq('id',b.dataset.reviewId):sb.from('product_reviews').delete().eq('id',b.dataset.reviewId);const {error}=await q;if(error)alert(error.message);else loadReviews()});}
$('refreshReviews')?.addEventListener('click',loadReviews);

// SALES ANALYTICS — calculated from live orders and product inventory
function renderAnalytics(){
 const days=Number($('analyticsRange')?.value||30),now=new Date(),start=new Date(now);start.setHours(0,0,0,0);start.setDate(start.getDate()-days+1);
 const periodOrders=cachedOrders.filter(o=>o.status!=='cancelled'&&new Date(o.created_at)>=start&&new Date(o.created_at)<=now);
 const revenue=periodOrders.reduce((sum,o)=>sum+Number(o.total||0),0);
 $('analyticsRevenue').textContent=money(revenue);$('analyticsOrders').textContent=String(periodOrders.length);$('analyticsAverage').textContent=money(periodOrders.length?revenue/periodOrders.length:0);
 const counts={};orderStatuses.forEach(s=>counts[s]=cachedOrders.filter(o=>o.status===s).length);
 $('analyticsStatuses').innerHTML=orderStatuses.map(s=>`<span>${statusLabels[s]}: <b>${counts[s]}</b></span>`).join('');
 const buckets=[];for(let i=days-1;i>=0;i--){const d=new Date(now);d.setHours(0,0,0,0);d.setDate(d.getDate()-i);buckets.push({date:d,label:days===7?d.toLocaleDateString('en',{weekday:'short'}):d.toLocaleDateString('en',{day:'numeric',month:'short'}),value:0})}
 periodOrders.forEach(o=>{const d=new Date(o.created_at);d.setHours(0,0,0,0);const b=buckets.find(x=>x.date.getTime()===d.getTime());if(b)b.value+=Number(o.total||0)});
 const max=Math.max(...buckets.map(b=>b.value),1);$('analyticsChartCaption').textContent=`Daily revenue · ${days} days`;
 $('analyticsChart').innerHTML=buckets.map(b=>`<div class="analytics-bar-col"><span class="analytics-bar-value">${b.value?Math.round(b.value).toLocaleString('en-BD'):''}</span><div class="analytics-bar" title="${dateLabel(b.date)} · ${money(b.value)}" style="height:${Math.max(2,b.value/max*72)}%"></div><span class="analytics-bar-label">${safe(b.label)}</span></div>`).join('');
 const best={};cachedOrders.filter(o=>o.status!=='cancelled').forEach(o=>(o.order_items||[]).forEach(i=>{const name=i.product_name||'Unknown product';best[name]=(best[name]||0)+Number(i.quantity||0)}));
 const bestRows=Object.entries(best).sort((a,b)=>b[1]-a[1]).slice(0,6),bestMax=Math.max(...bestRows.map(x=>x[1]),1);
 $('analyticsBestSellers').innerHTML=bestRows.map(([name,qty])=>`<div><div class="analytics-list-row"><span>${safe(name)}</span><b>${qty} sold</b></div><div class="analytics-track"><span style="width:${qty/bestMax*100}%"></span></div></div>`).join('')||'<p class="helper">No sales data yet.</p>';
 $('analyticsOrderSummary').innerHTML=`<table class="analytics-table"><tbody>${orderStatuses.map(s=>`<tr><td>${statusLabels[s]}</td><td>${counts[s]}</td></tr>`).join('')}<tr><td><b>Total orders</b></td><td>${cachedOrders.length}</td></tr></tbody></table>`;
 $('analyticsMessage').textContent=`Based on ${cachedOrders.length} orders currently available to your admin account.`;
}
async function loadAnalyticsInventory(){const host=$('analyticsLowStock');if(!host)return;const {data,error}=await sb.from('products').select('id,name,stock,is_active').order('stock',{ascending:true}).limit(100);if(error){host.innerHTML=`<p class="helper">Could not load inventory: ${safe(error.message)}</p>`;return}const low=(data||[]).filter(p=>p.is_active&&Number(p.stock)<=5);const stat=document.querySelectorAll('#overview .stat-card')[3];if(stat){stat.querySelector('strong').textContent=String(low.length);stat.querySelector('small').textContent='5 or fewer units'}host.innerHTML=low.map(p=>`<div class="analytics-list-row" style="padding:8px 0;border-bottom:1px solid #eee7e1"><span>${safe(p.name)}</span><b>${Number(p.stock)} left</b></div>`).join('')||'<p class="helper">No low-stock products. Inventory looks healthy.</p>'}
$('analyticsRange')?.addEventListener('change',renderAnalytics);
$('refreshAnalytics')?.addEventListener('click',async()=>{await loadOrders();await loadAnalyticsInventory();renderAnalytics()});
