const sb=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);
const $=id=>document.getElementById(id);
const login=$('adminLogin'), app=$('adminApp'), msg=$('loginMessage');
let editingId=null, existingImages=[], currentBulkPercent=0;
function safe(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function splitList(v){return [...new Set(String(v||'').split(',').map(x=>x.trim()).filter(Boolean))]}

const CATEGORY_FIELDS={
 'Shirts':[{key:'fit',label:'Fit',placeholder:'Regular / Slim / Oversized'},{key:'sleeve_type',label:'Sleeve Type',placeholder:'Full Sleeve / Half Sleeve'},{key:'collar_type',label:'Collar Type',placeholder:'Oxford / Spread / Button-down'}],
 'Pants':[{key:'fit',label:'Fit',placeholder:'Slim / Regular / Relaxed'},{key:'waist_type',label:'Waist Type',placeholder:'Mid Rise / High Rise'},{key:'length',label:'Length',placeholder:'Full Length / Cropped'}],
 'Shoes':[{key:'shoe_type',label:'Shoe Type',placeholder:'Sneakers / Running / Formal'},{key:'sole_type',label:'Sole Type',placeholder:'Rubber / EVA / PU'},{key:'closure',label:'Closure',placeholder:'Lace-up / Slip-on'}],
 'Watches':[{key:'dial_size',label:'Dial Size',placeholder:'e.g. 42 mm'},{key:'strap_type',label:'Strap Type',placeholder:'Stainless Steel / Leather / Silicone'},{key:'display',label:'Display',placeholder:'Analog / Digital'},{key:'style',label:'Style',placeholder:'Luxury / Casual / Sport'}],
 'T-Shirts':[{key:'fit',label:'Fit',placeholder:'Regular / Slim / Oversized'},{key:'neck_type',label:'Neck Type',placeholder:'Crew Neck / V-Neck / Polo'},{key:'sleeve_type',label:'Sleeve Type',placeholder:'Half Sleeve / Full Sleeve'}],
 'Jeans':[{key:'fit',label:'Fit',placeholder:'Skinny / Slim / Straight / Relaxed'},{key:'waist_type',label:'Waist Type',placeholder:'Mid Rise / High Rise'},{key:'wash',label:'Wash',placeholder:'Light / Mid / Dark'}],
 'Sunglasses':[{key:'frame_shape',label:'Frame Shape',placeholder:'Aviator / Square / Round'},{key:'lens_type',label:'Lens Type',placeholder:'Polarized / UV400'},{key:'frame_material',label:'Frame Material',placeholder:'Metal / Acetate'}],
 'Perfumes':[{key:'volume',label:'Volume',placeholder:'e.g. 100 ml'},{key:'fragrance_type',label:'Fragrance Type',placeholder:'EDP / EDT / Parfum'},{key:'scent',label:'Scent',placeholder:'Woody / Fresh / Floral'}]
};
function renderCategoryFields(category,values={}){
 const fields=CATEGORY_FIELDS[category]||[];
 $('categoryAttributeFields').innerHTML=fields.map(f=>`<label>${safe(f.label)}<input type="text" data-product-attribute="${safe(f.key)}" value="${safe(values[f.key]||'')}" placeholder="${safe(f.placeholder)}"></label>`).join('');
 const watch=category==='Watches',shoes=category==='Shoes',sunglasses=category==='Sunglasses',perfumes=category==='Perfumes';
 $('sizesFieldLabel').querySelector('input').placeholder=watch?'One Size':shoes?'40, 41, 42, 43, 44, 45':sunglasses||perfumes?'One Size':'XS, S, M, L, XL, XXL';
 $('sizesFieldLabel').firstChild.textContent=watch||sunglasses||perfumes?'Size (comma separated)':'Sizes (comma separated)';
 $('colorsFieldLabel').firstChild.textContent='Colors (comma separated)';
 $('sizeGuideFieldLabel').style.display=watch||sunglasses||perfumes?'none':'flex';
 $('materialFieldLabel').firstChild.textContent=shoes?'Material':watch?'Case Material':sunglasses?'Frame Material':perfumes?'Base / Ingredients':'Material / Fabric details';
 $('pMaterial').placeholder=watch?'Stainless Steel':shoes?'Synthetic Leather / Mesh':perfumes?'Alcohol-based / Oil-based':'100% cotton';
}
function collectCategoryAttributes(){const out={};document.querySelectorAll('[data-product-attribute]').forEach(el=>{if(el.value.trim())out[el.dataset.productAttribute]=el.value.trim()});return out}
$('pCategory').addEventListener('change',()=>renderCategoryFields($('pCategory').value));

function toLocalDateTime(value){if(!value)return '';const d=new Date(value);if(Number.isNaN(d.getTime()))return '';const pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`}
async function checkSession(){
 const {data:{session}}=await sb.auth.getSession();
 if(!session){login.hidden=false;app.hidden=true;return}
 const {data:owner,error}=await sb.from('admin_users').select('role,email').eq('user_id',session.user.id).maybeSingle();
 if(error||!owner){await sb.auth.signOut();login.hidden=false;app.hidden=true;msg.textContent='This account is not authorized as an admin.';return}
 login.hidden=true;app.hidden=false;$('adminEmail').textContent=owner.email||session.user.email;await loadProducts();await loadAnalyticsInventory();await loadAnnouncement();await loadHomepageSlides();await loadHomepageDisplaySettings();await loadPromoPopup();await loadBulkSaleStatus();await loadOrders();await loadWebsiteContent();await loadBkashSettings();await loadCoupons();await loadReviews();await loadCustomers();
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
function resetForm(){editingId=null;existingImages=[];$('productForm').reset();$('modalTitle').textContent='Add a product';$('saveProductBtn').textContent='SAVE PRODUCT ONLINE';$('existingImages').textContent='';$('variantRows').innerHTML='';$('pSaleStarts').value='';$('pSaleEnds').value='';$('pSalePrice').disabled=false;$('pSaleStarts').disabled=false;$('pSaleEnds').disabled=false;$('pActive').checked=true;renderCategoryFields($('pCategory').value)}
$('addProductBtn').addEventListener('click',()=>{resetForm();modal.classList.add('open')});
$('closeModal').addEventListener('click',()=>modal.classList.remove('open'));
modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('open')});
$('generateVariants').addEventListener('click',()=>renderVariantRows());
function renderVariantRows(existing=[]){
 const sizes=splitList($('pSizes').value), colors=splitList($('pColors').value);
 const rows=[]; (sizes.length?sizes:['One Size']).forEach(size=>(colors.length?colors:['Default']).forEach(color=>rows.push({size,color,stock:existing.find(v=>v.size===size&&v.color===color)?.stock??Number($('pVariantStock').value||0)})));
 $('variantRows').innerHTML=rows.map((v,i)=>`<div class="variant-row"><span>${safe(v.size)} · ${safe(v.color)}</span><label>Stock<input type="number" min="0" data-vstock="${i}" value="${v.stock}"></label><input type="hidden" data-vsize="${i}" value="${safe(v.size)}"><input type="hidden" data-vcolor="${i}" value="${safe(v.color)}"></div>`).join('');
}
async function openEdit(id){
 const {data:p,error}=await sb.from('products').select('*').eq('id',id).single();if(error){alert(error.message);return}
 const {data:cat}=await sb.from('categories').select('name').eq('id',p.category_id).single();
 const {data:variants, error:ve}=await sb.from('product_variants').select('size,color,stock').eq('product_id',id);
 if(ve){alert('Could not load variants: '+ve.message);return}
 editingId=id;existingImages=p.image_urls||[];
 $('modalTitle').textContent='Edit product';$('saveProductBtn').textContent='UPDATE PRODUCT';
 $('pName').value=p.name||'';$('pCategory').value=cat?.name||'Shirts';renderCategoryFields($('pCategory').value,p.attributes||{});$('pPrice').value=p.price||'';$('pSalePrice').value=p.sale_price||'';$('pSaleStarts').value=toLocalDateTime(p.sale_starts_at);$('pSaleEnds').value=toLocalDateTime(p.sale_ends_at);$('pSalePrice').disabled=currentBulkPercent>0;$('pSaleStarts').disabled=currentBulkPercent>0;$('pSaleEnds').disabled=currentBulkPercent>0;$('pStock').value=p.stock||0;$('pDescription').value=p.description||'';$('pMaterial').value=p.material||'';$('pSizeGuide').value=p.size_guide||'';
 $('pSizes').value=(p.sizes||[]).join(', ');$('pColors').value=(p.colors||[]).join(', ');
 $('pNewArrival').checked=!!p.new_arrival;$('pBestSeller').checked=!!p.best_seller;$('pFeatured').checked=!!p.featured;$('pTrending').checked=!!p.trending;$('pActive').checked=!!p.is_active;
 $('existingImages').textContent=existingImages.length?`Current images: ${existingImages.length}. New uploads will be added.`:'No current images.';
 renderVariantRows(variants||[]);modal.classList.add('open');
}
renderCategoryFields($('pCategory').value);
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
  const payload={name,slug:name.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-'+Date.now().toString().slice(-5),category_id:cat.id,price,sale_price,sale_starts_at,sale_ends_at,stock,description:$('pDescription').value.trim(),material:$('pMaterial').value.trim(),size_guide:$('pSizeGuide').value.trim(),attributes:collectCategoryAttributes(),image_urls:urls,sizes:splitList($('pSizes').value),colors:splitList($('pColors').value),new_arrival:$('pNewArrival').checked,best_seller:$('pBestSeller').checked,featured:$('pFeatured').checked,trending:$('pTrending').checked,is_active:$('pActive').checked,updated_at:new Date().toISOString()};
  if(editingId&&currentBulkPercent>0){payload.sale_price=Math.round(price*(1-currentBulkPercent/100)*100)/100;payload.sale_starts_at=null;payload.sale_ends_at=null;}
  let productId=editingId;
  if(editingId){const {error}=await sb.from('products').update(payload).eq('id',editingId);if(error)throw error;}
  else{payload.sku='OR-'+Date.now().toString().slice(-8);const {data,error}=await sb.from('products').insert(payload).select('id').single();if(error)throw error;productId=data.id;}
  const {error:delError}=await sb.from('product_variants').delete().eq('product_id',productId);if(delError)throw delError;
  const variantRows=[...document.querySelectorAll('[data-vstock]')].map((el,i)=>({product_id:productId,size:document.querySelector(`[data-vsize="${i}"]`).value,color:document.querySelector(`[data-vcolor="${i}"]`).value,stock:Number(el.value)}));
  if(variantRows.length){const {error}=await sb.from('product_variants').insert(variantRows);if(error)throw error;}
  e.target.reset();modal.classList.remove('open');await loadProducts();alert(wasEditing?'Product updated successfully.':'Product saved to the live store.');resetForm();
 }catch(err){alert('Could not save product: '+(err.message||err))}finally{btn.disabled=false;btn.textContent=wasEditing?'UPDATE PRODUCT':'SAVE PRODUCT ONLINE'}
});
async function loadAnnouncement(){
 const {data,error}=await sb.from('store_settings').select('key,value').in('key',['announcement','announcement_enabled']);
 const settings=Object.fromEntries((data||[]).map(x=>[x.key,x.value]));
 if(error){$('announcementMessage').textContent='Could not load announcement: '+error.message;return}
 $('announcementInput').value=settings.announcement||'WE FOCUS QUALITY, NOT QUANTITY.';
 $('announcementEnabled').checked=settings.announcement_enabled!=='false';
 $('announcementMessage').textContent=$('announcementEnabled').checked?'Announcement is ON.':'Announcement is OFF.';
}
async function saveAnnouncementSettings(){
 const button=$('saveAnnouncement'),message=$('announcementMessage'),value=$('announcementInput').value.trim(),enabled=$('announcementEnabled').checked;
 if(!value){message.textContent='Enter announcement text before saving.';return}
 button.disabled=true;button.textContent='SAVING…';message.textContent='Saving announcement…';
 try{
  const rows=[{key:'announcement',value},{key:'announcement_enabled',value:String(enabled)}];
  const {error}=await sb.from('store_settings').upsert(rows,{onConflict:'key'});if(error)throw error;
  message.textContent=enabled?'Announcement saved and is ON across the storefront.':'Announcement saved and hidden across the storefront.';
 }catch(error){message.textContent='Save failed: '+(error.message||error)}
 finally{button.disabled=false;button.textContent='SAVE ANNOUNCEMENT'}
}
$('saveAnnouncement')?.addEventListener('click',saveAnnouncementSettings);
$('announcementEnabled')?.addEventListener('change',saveAnnouncementSettings);

async function loadPromoPopup(){
 const {data,error}=await sb.from('store_settings').select('value').eq('key','promotion_popup').maybeSingle();
 if(error){$('promoMessage').textContent='Could not load popup: '+error.message;return}
 let c={};try{c=JSON.parse(data?.value||'{}')}catch{}
 $('promoTitle').value=c.title||'';$('promoText').value=c.text||'';$('promoButton').value=c.button||'';$('promoLink').value=c.link||'';$('promoEnabled').checked=c.enabled===true;
 if(c.image){$('promoImagePreview').src=c.image;$('promoImagePreview').dataset.url=c.image;$('promoImagePreview').style.display='block'}
 $('promoMessage').textContent=data?'Saved popup settings loaded.':'No popup configured yet.';
}
$('savePromoPopup')?.addEventListener('click',async()=>{
 const button=$('savePromoPopup'),message=$('promoMessage');button.disabled=true;button.textContent='SAVING…';
 try{
  let image=$('promoImagePreview').dataset.url||'';const file=$('promoImageFile').files?.[0];
  if(file){if(!file.type.startsWith('image/'))throw new Error('Please choose an image file.');if(file.size>5*1024*1024)throw new Error('Image must be 5 MB or smaller.');
   const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';const path='campaign-'+Date.now()+'.'+ext;
   const {error:upErr}=await sb.storage.from('promotion-popup').upload(path,file,{upsert:true,contentType:file.type});if(upErr)throw upErr;
   image=sb.storage.from('promotion-popup').getPublicUrl(path).data.publicUrl;
  }
  const cfg={enabled:$('promoEnabled').checked,title:$('promoTitle').value.trim(),text:$('promoText').value.trim(),button:$('promoButton').value.trim(),link:$('promoLink').value.trim(),image};
  if(cfg.enabled&&!cfg.title&&!cfg.text&&!cfg.image)throw new Error('Add a title, message, or image before enabling the popup.');
  const {error}=await sb.from('store_settings').upsert({key:'promotion_popup',value:JSON.stringify(cfg)},{onConflict:'key'});if(error)throw error;
  if(image){$('promoImagePreview').src=image;$('promoImagePreview').dataset.url=image;$('promoImagePreview').style.display='block'}
  $('promoMessage').textContent=cfg.enabled?'Popup saved and enabled.':'Popup saved and disabled.';
 }catch(e){message.textContent='Save failed: '+(e.message||e)}finally{button.disabled=false;button.textContent='SAVE POPUP'}
});


async function loadBulkSaleStatus(){
 const {data,error}=await sb.from('store_settings').select('value').eq('key','bulk_discount_percent').maybeSingle();
 if(error){$('bulkSaleStatus').textContent='Status unavailable';$('bulkSaleMessage').textContent=error.message;return}
 currentBulkPercent=Number(data?.value||0);
 $('bulkSaleStatus').textContent=currentBulkPercent>0?`ACTIVE CAMPAIGN · ${currentBulkPercent}% OFF`:'NO ACTIVE BULK SALE';
 $('bulkSaleMessage').textContent=currentBulkPercent>0?'Bulk discount is active on all active products. End the campaign to restore previous individual sale prices and schedules.':'No bulk discount is currently active.';
}
async function applyBulkDiscount(percent){
 percent=Number(percent);
 if(!Number.isFinite(percent)||percent<1||percent>90){$('bulkSaleMessage').textContent='Discount must be between 1% and 90%.';return}
 const action= currentBulkPercent>0?'Update the active bulk discount to '+percent+'%?':'Apply '+percent+'% discount to all active products?';
 if(!confirm(action+' Existing individual sale prices will be backed up and restored when the campaign ends.'))return;
 const message=$('bulkSaleMessage');message.textContent='Applying bulk discount…';
 document.querySelectorAll('[data-bulk-percent],#applyCustomBulk,#endBulkSale').forEach(b=>b.disabled=true);
 try{
  const {data,error}=await sb.rpc('admin_set_bulk_discount',{p_percent:percent});if(error)throw error;
  const result=Array.isArray(data)?data[0]:data;
  message.textContent=result?.message||`Bulk discount ${percent}% applied.`;
  await loadBulkSaleStatus();await loadProducts();
 }catch(error){message.textContent='Could not apply bulk discount: '+(error.message||error)}
 finally{document.querySelectorAll('[data-bulk-percent],#applyCustomBulk,#endBulkSale').forEach(b=>b.disabled=false)}
}
document.querySelectorAll('[data-bulk-percent]').forEach(b=>b.addEventListener('click',()=>applyBulkDiscount(Number(b.dataset.bulkPercent))));
$('applyCustomBulk')?.addEventListener('click',()=>applyBulkDiscount($('customBulkPercent').value));
$('endBulkSale')?.addEventListener('click',async()=>{
 if(currentBulkPercent<=0){$('bulkSaleMessage').textContent='There is no active bulk sale to end.';return}
 if(!confirm('End the bulk sale and restore all backed-up individual Sale Prices and Flash Sale schedules?'))return;
 const message=$('bulkSaleMessage');message.textContent='Restoring previous prices…';
 document.querySelectorAll('[data-bulk-percent],#applyCustomBulk,#endBulkSale').forEach(b=>b.disabled=true);
 try{
  const {data,error}=await sb.rpc('admin_clear_bulk_discount');if(error)throw error;
  const result=Array.isArray(data)?data[0]:data;
  message.textContent=result?.message||'Bulk sale ended. Previous sale prices restored.';
  await loadBulkSaleStatus();await loadProducts();
 }catch(error){message.textContent='Could not end bulk sale: '+(error.message||error)}
 finally{document.querySelectorAll('[data-bulk-percent],#applyCustomBulk,#endBulkSale').forEach(b=>b.disabled=false)}
});


// HOMEPAGE IMAGE SLIDER — up to five images stored in store_settings.
let homepageSlideValues=[];
async function loadHomepageSlides(){
 const host=$('homepageSlideEditor'),message=$('homepageSlidesMessage');
 if(!host||!message)return;
 message.textContent='Loading slider settings…';
 const {data,error}=await sb.from('store_settings').select('value').eq('key','homepage_slides').maybeSingle();
 if(error){message.textContent='Could not load slider settings: '+error.message;return}
 try{homepageSlideValues=JSON.parse(data?.value||'[]');if(!Array.isArray(homepageSlideValues))homepageSlideValues=homepageSlideValues.slides||[]}catch{homepageSlideValues=[]}
 host.innerHTML=Array.from({length:5},(_,i)=>{
  const item=homepageSlideValues[i]||{};
  return `<div class="cms-group" style="padding:12px;min-width:0">
   <strong>Slide ${i+1}</strong>
   <label class="cms-field" style="margin-top:9px">Image URL<input type="url" data-slide-url="${i}" value="${safe(item.image||'')}" placeholder="https://…"></label>
   <label class="cms-field" style="margin-top:9px">Upload image<input type="file" data-slide-file="${i}" accept="image/*"></label>
   <label class="cms-field" style="margin-top:9px">Click destination (optional)<input type="text" data-slide-link="${i}" value="${safe(item.link||'collections.htm')}" placeholder="collections.htm or product.html"></label>
   <img data-slide-preview="${i}" src="${safe(item.image||'')}" alt="Slide ${i+1} preview" style="display:${item.image?'block':'none'};width:100%;height:105px;object-fit:cover;margin-top:9px;border:1px solid #e8e0d8">
   <button type="button" class="table-action danger" data-slide-remove="${i}" style="margin-top:8px">REMOVE IMAGE</button>
  </div>`;
 }).join('');
 host.querySelectorAll('[data-slide-url]').forEach(input=>input.addEventListener('input',()=>{
  const img=host.querySelector(`[data-slide-preview="${input.dataset.slideUrl}"]`);
  img.src=input.value;img.style.display=input.value?'block':'none';
 }));
 host.querySelectorAll('[data-slide-file]').forEach(input=>input.addEventListener('change',()=>{
  const file=input.files?.[0];if(!file)return;
  const img=host.querySelector(`[data-slide-preview="${input.dataset.slideFile}"]`);
  img.src=URL.createObjectURL(file);img.style.display='block';
 }));
 host.querySelectorAll('[data-slide-remove]').forEach(button=>button.addEventListener('click',()=>{
  const n=button.dataset.slideRemove;
  host.querySelector(`[data-slide-url="${n}"]`).value='';
  host.querySelector(`[data-slide-file="${n}"]`).value='';
  const img=host.querySelector(`[data-slide-preview="${n}"]`);img.removeAttribute('src');img.style.display='none';
 }));
 message.textContent='Slider settings loaded. Add at least one image, up to five.';
}
$('saveHomepageSlides')?.addEventListener('click',async()=>{
 const button=$('saveHomepageSlides'),message=$('homepageSlidesMessage'),host=$('homepageSlideEditor');
 button.disabled=true;button.textContent='SAVING…';message.textContent='Uploading images and saving…';
 try{
  const items=[];
  for(let n=0;n<5;n++){
   let image=host.querySelector(`[data-slide-url="${n}"]`).value.trim();
   const file=host.querySelector(`[data-slide-file="${n}"]`).files?.[0];
   if(file){
    if(!file.type.startsWith('image/'))throw new Error(`Slide ${n+1}: choose an image file.`);
    if(file.size>7*1024*1024)throw new Error(`Slide ${n+1}: image must be 7 MB or smaller.`);
    const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
    const path=`homepage-slides/slide-${n+1}-${Date.now()}.${ext}`;
    const {error:uploadError}=await sb.storage.from('product-images').upload(path,file,{upsert:true,contentType:file.type});
    if(uploadError)throw uploadError;
    image=sb.storage.from('product-images').getPublicUrl(path).data.publicUrl;
   }
   if(image){
    let parsed;try{parsed=new URL(image)}catch{throw new Error(`Slide ${n+1}: enter a valid image URL or upload an image.`)}
    if(!['http:','https:'].includes(parsed.protocol))throw new Error(`Slide ${n+1}: image URL must start with https://`);
    const link=host.querySelector(`[data-slide-link="${n}"]`).value.trim()||'collections.htm';
    items.push({image,link,alt:`Outfit Reload featured collection ${items.length+1}`});
   }
  }
  if(!items.length)throw new Error('Upload or add at least one banner image.');
  const {error}=await sb.from('store_settings').upsert({key:'homepage_slides',value:JSON.stringify(items)},{onConflict:'key'});
  if(error)throw error;
  homepageSlideValues=items;message.textContent=`Saved ${items.length} slider image${items.length===1?'':'s'}. Refresh the homepage to view.`;
  await loadHomepageSlides();
 }catch(error){message.textContent='Save failed: '+(error.message||error)}
 finally{button.disabled=false;button.textContent='SAVE SLIDER IMAGES'}
});

// HOMEPAGE SLIDER TIMING + CATEGORY CARD CUSTOMIZATION
const defaultHomeCategories=[
 {key:'Shoes',name:'SHOE',image:'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85',visible:true},
 {key:'Watch',name:'WATCH',image:'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=85',visible:true},
 {key:'Sweatshirt',name:'JACKET',image:'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=900&q=85',visible:true},
 {key:'T-shirt',name:'T-SHIRT',image:'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=85',visible:true},
 {key:'Shirts',name:'SHIRT',image:'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=900&q=85',visible:true},
 {key:'Pants',name:'PANT',image:'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=900&q=85',visible:true}
];
let homepageCategories=defaultHomeCategories.map(x=>({...x}));
let heroOptions={interval:5000,animation:'fade',duration:850};
async function readStoreSetting(key){
 const {data,error}=await sb.from('store_settings').select('value').eq('key',key).maybeSingle();
 if(error)throw error;return data?.value??null;
}
async function writeStoreSetting(key,value){
 const {error}=await sb.from('store_settings').upsert({key,value:JSON.stringify(value)},{onConflict:'key'});
 if(error)throw error;
}
async function loadHomepageDisplaySettings(){
 try{
  const [heroRaw,catRaw]=await Promise.all([readStoreSetting('homepage_slider_options'),readStoreSetting('homepage_categories')]);
  if(heroRaw){try{heroOptions={...heroOptions,...JSON.parse(heroRaw)}}catch{}}
  if(catRaw){try{const saved=JSON.parse(catRaw);const list=Array.isArray(saved)?saved:(saved.items||[]);if(list.length)homepageCategories=defaultHomeCategories.map(base=>({...base,...(list.find(x=>x.key===base.key)||{})}));if(!Array.isArray(saved)&&saved.layout)homepageCategories.layout=saved.layout}catch{}}
  $('heroInterval').value=String(heroOptions.interval||4800);
  $('heroAnimation').value=heroOptions.animation||'fade';
  $('heroDuration').value=String(heroOptions.duration||800);
  const layout=homepageCategories.layout||{};
  $('categoryDesktopCols').value=String(layout.desktopCols||4);
  $('categoryMobileCols').value=String(layout.mobileCols||2);
  $('categoryShape').value=String(layout.shape||.82);
  $('categoryGap').value=String(layout.gap||16);
  renderHomepageCategoryEditor();
 }catch(error){$('homepageCategoriesMessage').textContent='Could not load homepage settings: '+(error.message||error)}
}
function renderHomepageCategoryEditor(){
 const host=$('homepageCategoryEditor');if(!host)return;
 host.innerHTML=homepageCategories.map((item,i)=>`<div class="cms-group" style="padding:12px;min-width:0">
  <strong>${safe(item.key)}</strong>
  <label class="cms-field" style="margin-top:9px">Display name<input type="text" maxlength="28" data-cat-name="${i}" value="${safe(item.name||'')}" placeholder="Category name"></label>
  <label class="cms-field" style="margin-top:9px">Image URL<input type="url" data-cat-url="${i}" value="${safe(item.image||'')}" placeholder="https://…"></label>
  <label class="cms-field" style="margin-top:9px">Upload image<input type="file" data-cat-file="${i}" accept="image/*"></label>
  <img data-cat-preview="${i}" src="${safe(item.image||'')}" alt="${safe(item.name||item.key)} preview" style="display:${item.image?'block':'none'};width:100%;height:105px;object-fit:cover;margin-top:9px;border:1px solid #e8e0d8">
  <label style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:12px"><input type="checkbox" data-cat-visible="${i}" ${item.visible!==false?'checked':''}> Show this category</label>
 </div>`).join('');
 host.querySelectorAll('[data-cat-url]').forEach(input=>input.addEventListener('input',()=>{const img=host.querySelector(`[data-cat-preview="${input.dataset.catUrl}"]`);img.src=input.value;img.style.display=input.value?'block':'none'}));
 host.querySelectorAll('[data-cat-file]').forEach(input=>input.addEventListener('change',()=>{const file=input.files?.[0];if(!file)return;const img=host.querySelector(`[data-cat-preview="${input.dataset.catFile}"]`);img.src=URL.createObjectURL(file);img.style.display='block'}));
}
$('saveHeroOptions')?.addEventListener('click',async()=>{
 const b=$('saveHeroOptions'),m=$('heroOptionsMessage');b.disabled=true;m.textContent='Saving…';
 try{heroOptions={interval:Number($('heroInterval').value),animation:$('heroAnimation').value,duration:Number($('heroDuration').value)};await writeStoreSetting('homepage_slider_options',heroOptions);m.textContent='Slider settings saved.'}
 catch(e){m.textContent='Save failed: '+(e.message||e)}finally{b.disabled=false}
});
$('saveHomepageCategories')?.addEventListener('click',async()=>{
 const b=$('saveHomepageCategories'),m=$('homepageCategoriesMessage'),host=$('homepageCategoryEditor');b.disabled=true;m.textContent='Saving categories…';
 try{
  const updated=[];
  for(let i=0;i<homepageCategories.length;i++){
   const item={...homepageCategories[i]};
   item.name=host.querySelector(`[data-cat-name="${i}"]`).value.trim()||item.key.toUpperCase();
   item.image=host.querySelector(`[data-cat-url="${i}"]`).value.trim();
   item.visible=host.querySelector(`[data-cat-visible="${i}"]`).checked;
   const file=host.querySelector(`[data-cat-file="${i}"]`).files?.[0];
   if(file){
    if(!file.type.startsWith('image/'))throw new Error(`${item.key}: choose an image file.`);
    if(file.size>7*1024*1024)throw new Error(`${item.key}: image must be 7 MB or smaller.`);
    const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
    const path=`category-images/${item.key.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${Date.now()}.${ext}`;
    const {error}=await sb.storage.from('product-images').upload(path,file,{upsert:false,contentType:file.type});
    if(error)throw error;
    item.image=sb.storage.from('product-images').getPublicUrl(path).data.publicUrl;
   }
   updated.push(item);
  }
  updated.layout={desktopCols:Number($('categoryDesktopCols').value),mobileCols:Number($('categoryMobileCols').value),shape:Number($('categoryShape').value),gap:Number($('categoryGap').value)};
  await writeStoreSetting('homepage_categories',{items:updated,layout:updated.layout});
  homepageCategories=updated; m.textContent='Category settings saved. Refresh homepage to view.';
 }catch(e){m.textContent='Save failed: '+(e.message||e)}finally{b.disabled=false}
});

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

const adminSidebar=$('sidebar');
const adminMenuButton=$('adminMenu');
const closeAdminSidebar=()=>{adminSidebar.classList.remove('open');adminMenuButton.setAttribute('aria-expanded','false')};
adminMenuButton.setAttribute('aria-controls','sidebar');
adminMenuButton.setAttribute('aria-expanded','false');
adminMenuButton.addEventListener('click',e=>{e.stopPropagation();const isOpen=adminSidebar.classList.toggle('open');adminMenuButton.setAttribute('aria-expanded',String(isOpen))});
// Close after choosing a section on mobile, or tapping anywhere outside the drawer.
adminSidebar.querySelectorAll('.side-link').forEach(link=>link.addEventListener('click',()=>{if(window.matchMedia('(max-width: 800px)').matches)closeAdminSidebar()}));
document.addEventListener('click',e=>{if(window.matchMedia('(max-width: 800px)').matches&&adminSidebar.classList.contains('open')&&!adminSidebar.contains(e.target)&&!adminMenuButton.contains(e.target))closeAdminSidebar()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeAdminSidebar()});
window.addEventListener('resize',()=>{if(!window.matchMedia('(max-width: 800px)').matches)closeAdminSidebar()});
checkSession();


// LIVE ORDER MANAGEMENT
const orderStatuses=['pending','confirmed','processing','shipped','delivered','cancelled'];
const statusLabels={pending:'Pending',confirmed:'Confirmed',processing:'Processing',shipped:'Shipped',delivered:'Delivered',cancelled:'Cancelled'};
const bkashPaymentStatuses=['pending','verified','rejected'];
const bkashPaymentLabels={pending:'Pending',verified:'Verified',rejected:'Rejected'};
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
  const bkashStatus=o.bkash_payment_status||'pending';
  const bkashInfo=o.payment_method==='bkash_delivery_cod'?`<div class="bkash-review-box"><b>bKash payment: <span class="bkash-state bkash-state-${safe(bkashStatus)}">${safe(bkashPaymentLabels[bkashStatus]||bkashStatus.toUpperCase())}</span></b><br><b>Sender number:</b> ${safe(o.bkash_sender_number||'—')}<br><b>TrxID:</b> ${safe(o.bkash_trxid||'—')}<div class="bkash-review-actions"><select data-bkash-status-select="${o.id}" aria-label="bKash verification status">${bkashPaymentStatuses.map(st=>`<option value="${st}" ${bkashStatus===st?'selected':''}>${bkashPaymentLabels[st]}</option>`).join('')}</select><button type="button" class="table-action" data-save-bkash-status="${o.id}">Save payment status</button></div></div>`:'';
  return `<tr class="order-main-row"><td><strong>${safe(o.order_number)}</strong><br><small>${safe(o.payment_method||'cod').toUpperCase()}</small><details class="order-details"><summary>View details</summary><div class="order-detail-box"><b>Delivery:</b> ${area}<br><b>Address:</b> ${safe(o.delivery_address)}<br><b>Phone:</b> ${safe(o.customer_phone)}<br><b>Email:</b> ${safe(o.customer_email||'Not provided')}<br><b>Note:</b> ${safe(o.customer_note||'—')}${bkashInfo}<br><b>Items:</b><ul>${items||'<li>No item details</li>'}</ul><div>Subtotal ${money(o.subtotal)} · Delivery ${money(o.delivery_fee)} · <b>Total ${money(o.total)}</b></div></div></details></td><td><b>${safe(o.customer_name)}</b><br><small>${safe(o.customer_phone)}</small></td><td>${dateLabel(o.created_at)}</td><td><b>${money(o.total)}</b></td><td><span class="pill status-${safe(o.status)}">${statusLabels[o.status]||safe(o.status)}</span></td><td><div class="order-action"><select data-status-select="${o.id}" aria-label="New status for ${safe(o.order_number)}">${options}</select><button class="table-action" data-save-status="${o.id}" ${o.status==='cancelled'?'disabled':''}>Save</button></div></td></tr>`;
 }).join('')||`<tr><td colspan="6">${filter==='all'?'No orders found yet.':'No '+safe(filter)+' orders.'}</td></tr>`;
 document.querySelectorAll('[data-save-status]').forEach(btn=>btn.addEventListener('click',()=>saveOrderStatus(btn.dataset.saveStatus,btn)));
 document.querySelectorAll('[data-save-bkash-status]').forEach(btn=>btn.addEventListener('click',()=>saveBkashPaymentStatus(btn.dataset.saveBkashStatus,btn)));
}
async function loadOrders(){
 const target=$('adminOrderRows');if(!target)return;
 $('ordersMessage').textContent='Loading orders…';
 const {data,error}=await sb.from('orders').select('id,order_number,customer_name,customer_phone,customer_email,delivery_area,delivery_address,customer_note,payment_method,bkash_sender_number,bkash_trxid,bkash_payment_status,status,subtotal,delivery_fee,total,created_at,order_items(id,product_name,unit_price,size,color,quantity,line_total)').order('created_at',{ascending:false});
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
async function saveBkashPaymentStatus(id,btn){
 const select=document.querySelector(`[data-bkash-status-select="${id}"]`);
 const status=select?.value;
 if(!bkashPaymentStatuses.includes(status))return;
 const order=cachedOrders.find(o=>o.id===id);
 if(!order||order.payment_method!=='bkash_delivery_cod')return;
 if(status==='verified'&&!confirm('Confirm that you checked the bKash transaction and the delivery charge was received?'))return;
 if(status==='rejected'&&!confirm('Mark this bKash payment as rejected?'))return;
 btn.disabled=true;btn.textContent='Saving…';
 const {error}=await sb.rpc('admin_update_bkash_payment_status',{p_order_id:id,p_new_status:status});
 if(error){alert('Could not update bKash payment status: '+error.message+'\n\nRun the bKash verification SQL setup in Supabase first.');btn.disabled=false;btn.textContent='Save payment status';return}
 $('ordersMessage').textContent=`bKash payment marked ${bkashPaymentLabels[status]}.`;
 await loadOrders();
}
$('refreshOrders')?.addEventListener('click',loadOrders);
$('orderStatusFilter')?.addEventListener('change',renderOrders);


// Coupon administration
async function loadCoupons(){const host=$('couponRows');if(!host)return;const {data,error}=await sb.from('discount_coupons').select('*').order('created_at',{ascending:false});if(error){host.innerHTML=`<tr><td colspan="5">${safe(error.message)} — run the wishlist/reviews/coupons SQL upgrade.</td></tr>`;return}host.innerHTML=(data||[]).map(c=>`<tr><td><b>${safe(c.code)}</b></td><td>${c.discount_type==='percent'?Number(c.discount_value)+'%':'৳ '+Number(c.discount_value)}</td><td>${c.used_count}${c.usage_limit?'/'+c.usage_limit:''}</td><td>${c.is_active?'Active':'Disabled'}</td><td><button class="table-action" data-coupon-toggle="${c.id}" data-active="${c.is_active}">${c.is_active?'Disable':'Enable'}</button> <button class="table-action danger" data-coupon-delete="${c.id}">Delete</button></td></tr>`).join('')||'<tr><td colspan="5">No coupons created yet.</td></tr>';host.querySelectorAll('[data-coupon-toggle]').forEach(b=>b.onclick=async()=>{const {error}=await sb.from('discount_coupons').update({is_active:b.dataset.active!=='true'}).eq('id',b.dataset.couponToggle);if(error)alert(error.message);else loadCoupons()});host.querySelectorAll('[data-coupon-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('Delete this coupon?'))return;const {error}=await sb.from('discount_coupons').delete().eq('id',b.dataset.couponDelete);if(error)alert(error.message);else loadCoupons()});}
$('couponForm')?.addEventListener('submit',async e=>{e.preventDefault();const msg=$('couponAdminMessage');const code=$('couponCodeAdmin').value.trim().toUpperCase();const value=Number($('couponValue').value);if(!/^[A-Z0-9_-]{3,32}$/.test(code)){msg.textContent='Use 3–32 letters, numbers, hyphens or underscores.';return}const payload={code,discount_type:$('couponType').value,discount_value:value,min_order_amount:Number($('couponMinimum').value||0),max_discount:$('couponMaximum').value===''?null:Number($('couponMaximum').value),usage_limit:$('couponLimit').value===''?null:Number($('couponLimit').value),starts_at:$('couponStarts').value?new Date($('couponStarts').value).toISOString():null,expires_at:$('couponExpires').value?new Date($('couponExpires').value).toISOString():null,is_active:true};const {error}=await sb.from('discount_coupons').insert(payload);if(error){msg.textContent='Could not save coupon: '+error.message;return}e.target.reset();msg.textContent='Coupon saved successfully.';loadCoupons()});
async function loadReviews(){const host=$('reviewAdminRows');if(!host)return;const {data,error}=await sb.from('product_reviews').select('id,customer_name,rating,review_text,is_approved,created_at,products(name)').order('created_at',{ascending:false});if(error){host.innerHTML=`<tr><td colspan="5">${safe(error.message)} — run the SQL upgrade.</td></tr>`;return}host.innerHTML=(data||[]).map(r=>`<tr><td><b>${safe(r.products?.name||'Deleted product')}</b><br><small>${safe(r.customer_name)}</small></td><td>${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</td><td>${safe(r.review_text)}</td><td>${r.is_approved?'Approved':'Pending'}</td><td>${r.is_approved?`<button class="table-action" data-review-action="hide" data-review-id="${r.id}">Hide</button>`:`<button class="table-action" data-review-action="approve" data-review-id="${r.id}">Approve</button>`} <button class="table-action danger" data-review-action="delete" data-review-id="${r.id}">Delete</button></td></tr>`).join('')||'<tr><td colspan="5">No reviews submitted yet.</td></tr>';host.querySelectorAll('[data-review-action]').forEach(b=>b.onclick=async()=>{const action=b.dataset.reviewAction;if(action==='delete'&&!confirm('Delete this review?'))return;const update=action==='approve'?{is_approved:true}:action==='hide'?{is_approved:false}:null;const q=update?sb.from('product_reviews').update(update).eq('id',b.dataset.reviewId):sb.from('product_reviews').delete().eq('id',b.dataset.reviewId);const {error}=await q;if(error)alert(error.message);else loadReviews()});}
$('refreshReviews')?.addEventListener('click',loadReviews);

// CUSTOMER MANAGEMENT
let cachedCustomers=[];
function renderCustomers(){
 const host=$('adminCustomerRows');if(!host)return;
 const query=String($('customerSearch')?.value||'').trim().toLowerCase();
 const status=$('customerStatusFilter')?.value||'all';
 const rows=cachedCustomers.filter(c=>{
  const hay=[c.full_name,c.email,c.phone].join(' ').toLowerCase();
  return (!query||hay.includes(query))&&(status==='all'||(status==='enabled'?c.is_enabled:!c.is_enabled));
 });
 $('customerCount').textContent=`${rows.length} customer${rows.length===1?'':'s'}`;
 host.innerHTML=rows.map(c=>`<tr><td><b>${safe(c.full_name||'Customer')}</b><br><small>${safe(c.email||'No email')}</small></td><td>${safe(c.phone||'—')}</td><td><b>${Number(c.orders_count||0)}</b></td><td><span class="customer-status ${c.is_enabled?'':'disabled'}">${c.is_enabled?'Enabled':'Disabled'}</span></td><td>${c.is_enabled?'<span class="helper">—</span>':`<span class="customer-reason">${safe(c.disable_reason||'No reason entered')}</span>`}</td><td><div class="customer-action">${c.is_enabled?`<button class="table-action danger" data-customer-disable="${c.customer_id}">Disable</button>`:`<button class="table-action" data-customer-edit-reason="${c.customer_id}">Edit reason</button><button class="table-action" data-customer-enable="${c.customer_id}">Enable</button>`}</div></td></tr>`).join('')||'<tr><td colspan="6">No customers match this search.</td></tr>';
 host.querySelectorAll('[data-customer-disable]').forEach(b=>b.onclick=()=>changeCustomerStatus(b.dataset.customerDisable,false));
 host.querySelectorAll('[data-customer-edit-reason]').forEach(b=>b.onclick=()=>changeCustomerStatus(b.dataset.customerEditReason,false,true));
 host.querySelectorAll('[data-customer-enable]').forEach(b=>b.onclick=()=>changeCustomerStatus(b.dataset.customerEnable,true));
}
async function loadCustomers(){
 const host=$('adminCustomerRows');if(!host)return;
 host.innerHTML='<tr><td colspan="6">Loading customers…</td></tr>';
 $('customersMessage').textContent='';
 const {data,error}=await sb.rpc('admin_list_customers');
 if(error){host.innerHTML=`<tr><td colspan="6">Could not load customers: ${safe(error.message)}</td></tr>`;$('customersMessage').textContent='Run CUSTOMER-MANAGEMENT.sql in Supabase SQL Editor, then refresh this section.';return}
 cachedCustomers=data||[];renderCustomers();
 $('customersMessage').textContent=`Loaded ${cachedCustomers.length} customer account(s).`;
}
async function changeCustomerStatus(id,enabled,editingReason=false){
 const customer=cachedCustomers.find(c=>c.customer_id===id);if(!customer)return;
 let reason=null;
 if(!enabled){
  const promptText=editingReason?'Edit the reason shown to this customer:':'Enter the reason this account is being disabled. The customer will see this exact text when signing in:';
  reason=window.prompt(promptText,editingReason?(customer.disable_reason||''):'');
  if(reason===null)return;
  reason=reason.trim();
  if(reason.length<3){alert('Please enter a clear reason (at least 3 characters).');return}
 }else if(!window.confirm(`Enable ${customer.full_name||customer.email||'this customer'} account?`))return;
 $('customersMessage').textContent=enabled?'Enabling account…':'Saving account restriction…';
 const {error}=await sb.rpc('admin_set_customer_status',{p_customer_id:id,p_is_enabled:enabled,p_disable_reason:reason});
 if(error){$('customersMessage').textContent='Could not update account: '+error.message;return}
 $('customersMessage').textContent=enabled?'Customer account enabled.':'Customer account disabled and reason saved.';
 await loadCustomers();
}
$('refreshCustomers')?.addEventListener('click',loadCustomers);
$('customerSearch')?.addEventListener('input',renderCustomers);
$('customerStatusFilter')?.addEventListener('change',renderCustomers);

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
 const labelStep=days<=7?1:Math.max(1,Math.ceil(buckets.length/6));
 $('analyticsChart').innerHTML=buckets.map((b,i)=>{const showLabel=i%labelStep===0||i===buckets.length-1;return `<div class="analytics-bar-col" title="${dateLabel(b.date)} · ${money(b.value)}"><span class="analytics-bar-value">${showLabel&&b.value?Math.round(b.value).toLocaleString('en-BD'):''}</span><div class="analytics-bar" title="${dateLabel(b.date)} · ${money(b.value)}" style="height:${Math.max(2,b.value/max*72)}%"></div><span class="analytics-bar-label ${showLabel?'':'is-hidden'}">${safe(b.label)}</span></div>`}).join('');
 const best={};cachedOrders.filter(o=>o.status!=='cancelled').forEach(o=>(o.order_items||[]).forEach(i=>{const name=i.product_name||'Unknown product';best[name]=(best[name]||0)+Number(i.quantity||0)}));
 const bestRows=Object.entries(best).sort((a,b)=>b[1]-a[1]).slice(0,6),bestMax=Math.max(...bestRows.map(x=>x[1]),1);
 $('analyticsBestSellers').innerHTML=bestRows.map(([name,qty])=>`<div><div class="analytics-list-row"><span>${safe(name)}</span><b>${qty} sold</b></div><div class="analytics-track"><span style="width:${qty/bestMax*100}%"></span></div></div>`).join('')||'<p class="helper">No sales data yet.</p>';
 $('analyticsOrderSummary').innerHTML=`<table class="analytics-table"><tbody>${orderStatuses.map(s=>`<tr><td>${statusLabels[s]}</td><td>${counts[s]}</td></tr>`).join('')}<tr><td><b>Total orders</b></td><td>${cachedOrders.length}</td></tr></tbody></table>`;
 $('analyticsMessage').textContent=`Based on ${cachedOrders.length} orders currently available to your admin account.`;
}
async function loadAnalyticsInventory(){const host=$('analyticsLowStock');if(!host)return;const {data,error}=await sb.from('products').select('id,name,stock,is_active').order('stock',{ascending:true}).limit(100);if(error){host.innerHTML=`<p class="helper">Could not load inventory: ${safe(error.message)}</p>`;return}const low=(data||[]).filter(p=>p.is_active&&Number(p.stock)<=5);const stat=document.querySelectorAll('#overview .stat-card')[3];if(stat){stat.querySelector('strong').textContent=String(low.length);stat.querySelector('small').textContent='5 or fewer units'}host.innerHTML=low.map(p=>`<div class="analytics-list-row" style="padding:8px 0;border-bottom:1px solid #eee7e1"><span>${safe(p.name)}</span><b>${Number(p.stock)} left</b></div>`).join('')||'<p class="helper">No low-stock products. Inventory looks healthy.</p>'}
$('analyticsRange')?.addEventListener('change',renderAnalytics);
$('refreshAnalytics')?.addEventListener('click',async()=>{await loadOrders();await loadAnalyticsInventory();renderAnalytics()});
