const sb=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);
const $=id=>document.getElementById(id);
const login=$('adminLogin'), app=$('adminApp'), msg=$('loginMessage');
function safe(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function checkSession(){
 const {data:{session}}=await sb.auth.getSession();
 if(!session){login.hidden=false;app.hidden=true;return}
 const {data:owner,error}=await sb.from('admin_users').select('role,email').eq('user_id',session.user.id).maybeSingle();
 if(error||!owner){await sb.auth.signOut();login.hidden=false;app.hidden=true;msg.textContent='This account is not authorized as an admin.';return}
 login.hidden=true;app.hidden=false;$('adminEmail').textContent=owner.email||session.user.email;await loadProducts();
}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();msg.textContent='Signing in…';const {error}=await sb.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value});if(error){msg.textContent=error.message;return}msg.textContent='';await checkSession()});
$('logoutBtn').addEventListener('click',async()=>{await sb.auth.signOut();await checkSession()});
async function loadProducts(){
 const {data,error}=await sb.from('products').select('id,name,sku,price,stock,is_active,categories(name)').order('created_at',{ascending:false});
 if(error){$('adminProductRows').innerHTML=`<tr><td colspan="6">Could not load products: ${safe(error.message)}</td></tr>`;return}
 $('productTotal').textContent=data.length;
 $('adminProductRows').innerHTML=data.map(p=>`<tr><td><strong>${safe(p.name)}</strong><br><small>${safe(p.sku||'SKU pending')}</small></td><td>${safe(p.categories?.name||'—')}</td><td>৳ ${Number(p.price).toLocaleString('en-BD')}</td><td>${p.stock}</td><td><span class="pill">${p.is_active?'Active':'Hidden'}</span></td><td><button data-delete="${p.id}" style="border:0;background:none;color:#9a5a45;cursor:pointer">Delete</button></td></tr>`).join('')||'<tr><td colspan="6">No products yet. Add your first product.</td></tr>';
 document.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('Delete this product?'))return;const {error}=await sb.from('products').delete().eq('id',b.dataset.delete);if(error)alert(error.message);else await loadProducts()}));
}
const modal=$('productModal');$('addProductBtn').addEventListener('click',()=>modal.classList.add('open'));$('closeModal').addEventListener('click',()=>modal.classList.remove('open'));modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('open')});
$('productForm').addEventListener('submit',async e=>{
 e.preventDefault();const btn=e.submitter;btn.disabled=true;btn.textContent='SAVING…';
 try{
  const name=$('pName').value.trim(),category=$('pCategory').value,price=Number($('pPrice').value),stock=Number($('pStock').value);
  const {data:cat,error:ce}=await sb.from('categories').select('id').eq('name',category).single();if(ce)throw ce;
  const files=[...$('pImages').files], urls=[];
  for(const file of files){const ext=(file.name.split('.').pop()||'jpg').toLowerCase(),filePath=`${crypto.randomUUID()}.${ext}`;const {error:ue}=await sb.storage.from('product-images').upload(filePath,file,{upsert:false,contentType:file.type});if(ue)throw ue;const {data}=sb.storage.from('product-images').getPublicUrl(filePath);urls.push(data.publicUrl)}
  const sku='OR-'+Date.now().toString().slice(-8);
  const {error}=await sb.from('products').insert({name,slug:name.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-'+Date.now().toString().slice(-4),category_id:cat.id,price,stock,sku,description:$('pDescription').value,image_urls:urls,is_active:true});
  if(error)throw error;
  e.target.reset();modal.classList.remove('open');await loadProducts();alert('Product saved to the live store.');
 }catch(err){alert('Could not save product: '+(err.message||err))}finally{btn.disabled=false;btn.textContent='SAVE PRODUCT ONLINE'}
});
$('saveAnnouncement').addEventListener('click',async()=>{
 const value=$('announcementInput').value.trim();const {error}=await sb.from('store_settings').upsert({key:'announcement',value},{onConflict:'key'});
 if(error){alert('Announcement table is not ready yet.');return}alert('Announcement updated.');
});
$('adminMenu').addEventListener('click',()=>$('sidebar').classList.toggle('open'));
checkSession();
