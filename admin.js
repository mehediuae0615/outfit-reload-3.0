const sb=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);
const $=id=>document.getElementById(id);
const login=$('adminLogin'), app=$('adminApp'), msg=$('loginMessage');
let editingId=null, existingImages=[];
function safe(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function splitList(v){return [...new Set(String(v||'').split(',').map(x=>x.trim()).filter(Boolean))]}
async function checkSession(){
 const {data:{session}}=await sb.auth.getSession();
 if(!session){login.hidden=false;app.hidden=true;return}
 const {data:owner,error}=await sb.from('admin_users').select('role,email').eq('user_id',session.user.id).maybeSingle();
 if(error||!owner){await sb.auth.signOut();login.hidden=false;app.hidden=true;msg.textContent='This account is not authorized as an admin.';return}
 login.hidden=true;app.hidden=false;$('adminEmail').textContent=owner.email||session.user.email;await loadProducts();await loadAnnouncement();await loadOrders();
}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();msg.textContent='Signing in…';const {error}=await sb.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value});if(error){msg.textContent=error.message;return}msg.textContent='';await checkSession()});
$('logoutBtn').addEventListener('click',async()=>{await sb.auth.signOut();await checkSession()});
async function loadProducts(){
 const {data,error}=await sb.from('products').select('id,name,sku,price,stock,is_active,new_arrival,best_seller,featured,trending,categories(name)').order('created_at',{ascending:false});
 if(error){$('adminProductRows').innerHTML=`<tr><td colspan="7">Could not load products: ${safe(error.message)}</td></tr>`;return}
 $('productTotal').textContent=data.length;
 $('adminProductRows').innerHTML=data.map(p=>`<tr><td><strong>${safe(p.name)}</strong><br><small>${safe(p.sku||'SKU pending')}</small></td><td>${safe(p.categories?.name||'—')}</td><td>৳ ${Number(p.price).toLocaleString('en-BD')}</td><td>${Number(p.stock)||0}</td><td><span class="pill">${p.is_active?'Active':'Hidden'}</span></td><td><button data-edit="${p.id}" class="table-action">Edit</button> <button data-delete="${p.id}" class="table-action danger">Delete</button></td></tr>`).join('')||'<tr><td colspan="7">No products yet. Add your first product.</td></tr>';
 document.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('Delete this product permanently?'))return;const {error}=await sb.from('products').delete().eq('id',b.dataset.delete);if(error)alert(error.message);else await loadProducts()}));
 document.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>openEdit(b.dataset.edit)));
}
const modal=$('productModal');
function resetForm(){editingId=null;existingImages=[];$('productForm').reset();$('modalTitle').textContent='Add a product';$('saveProductBtn').textContent='SAVE PRODUCT ONLINE';$('existingImages').textContent='';$('variantRows').innerHTML='';$('pActive').checked=true}
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
 $('pName').value=p.name||'';$('pCategory').value=cat?.name||'Shirts';$('pPrice').value=p.price||'';$('pStock').value=p.stock||0;$('pDescription').value=p.description||'';$('pMaterial').value=p.material||'';$('pSizeGuide').value=p.size_guide||'';
 $('pSizes').value=(p.sizes||[]).join(', ');$('pColors').value=(p.colors||[]).join(', ');
 $('pNewArrival').checked=!!p.new_arrival;$('pBestSeller').checked=!!p.best_seller;$('pFeatured').checked=!!p.featured;$('pTrending').checked=!!p.trending;$('pActive').checked=!!p.is_active;
 $('existingImages').textContent=existingImages.length?`Current images: ${existingImages.length}. New uploads will be added.`:'No current images.';
 renderVariantRows(variants||[]);modal.classList.add('open');
}
$('productForm').addEventListener('submit',async e=>{
 e.preventDefault();const btn=$('saveProductBtn');const wasEditing=!!editingId;btn.disabled=true;btn.textContent='SAVING…';
 try{
  const name=$('pName').value.trim(),category=$('pCategory').value,price=Number($('pPrice').value),stock=Number($('pStock').value);
  const {data:cat,error:ce}=await sb.from('categories').select('id').eq('name',category).single();if(ce)throw ce;
  const files=[...$('pImages').files], urls=[...existingImages];
  for(const file of files){const ext=(file.name.split('.').pop()||'jpg').toLowerCase(),filePath=`${crypto.randomUUID()}.${ext}`;const {error:ue}=await sb.storage.from('product-images').upload(filePath,file,{upsert:false,contentType:file.type});if(ue)throw ue;const {data}=sb.storage.from('product-images').getPublicUrl(filePath);urls.push(data.publicUrl)}
  const payload={name,slug:name.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-'+Date.now().toString().slice(-5),category_id:cat.id,price,stock,description:$('pDescription').value.trim(),material:$('pMaterial').value.trim(),size_guide:$('pSizeGuide').value.trim(),image_urls:urls,sizes:splitList($('pSizes').value),colors:splitList($('pColors').value),new_arrival:$('pNewArrival').checked,best_seller:$('pBestSeller').checked,featured:$('pFeatured').checked,trending:$('pTrending').checked,is_active:$('pActive').checked,updated_at:new Date().toISOString()};
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
$('saveAnnouncement').addEventListener('click',async()=>{const value=$('announcementInput').value.trim();const {error}=await sb.from('store_settings').upsert({key:'announcement',value},{onConflict:'key'});if(error){alert('Could not save announcement: '+error.message);return}alert('Announcement updated.')});
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
