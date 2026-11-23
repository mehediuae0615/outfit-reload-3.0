/* Outfit Reload 3.0 promotional popup */
(function(){
 const loadScript=(src)=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error('Could not load '+src));document.head.appendChild(s)});
 async function start(){
  try{
   if(!window.SUPABASE_URL||!window.SUPABASE_ANON_KEY)await loadScript('config.js');
   if(!window.supabase)await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
   if(!window.supabase||!window.SUPABASE_URL||!window.SUPABASE_ANON_KEY)return;
   const client=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);
   const {data,error}=await client.from('store_settings').select('value').eq('key','promotion_popup').maybeSingle();
   if(error||!data?.value)return;let c;try{c=JSON.parse(data.value)}catch{return}
   if(!c.enabled)return;
   const sessionKey='or_promo_closed_'+(c.updated_at||c.title||'campaign');
   try{if(sessionStorage.getItem(sessionKey))return}catch{}
   const overlay=document.createElement('div');overlay.className='or-promo-overlay';overlay.setAttribute('role','presentation');
   const panel=document.createElement('section');panel.className='or-promo-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',c.title||'Promotion');
   const close=document.createElement('button');close.className='or-promo-close';close.type='button';close.setAttribute('aria-label','Close popup');close.textContent='×';
   const dismiss=()=>{overlay.remove();try{sessionStorage.setItem(sessionKey,'1')}catch{}};close.addEventListener('click',dismiss);overlay.addEventListener('click',e=>{if(e.target===overlay)dismiss()});document.addEventListener('keydown',function esc(e){if(e.key==='Escape'&&document.body.contains(overlay)){dismiss();document.removeEventListener('keydown',esc)}});
   panel.appendChild(close);
   if(c.image){const img=document.createElement('img');img.className='or-promo-image';img.src=c.image;img.alt=c.title||'Promotion';img.loading='eager';panel.appendChild(img)}
   const body=document.createElement('div');body.className='or-promo-copy';
   if(c.title){const h=document.createElement('h2');h.textContent=c.title;body.appendChild(h)}
   if(c.text){const p=document.createElement('p');p.textContent=c.text;body.appendChild(p)}
   if(c.button&&c.link){const a=document.createElement('a');a.className='or-promo-cta';a.textContent=c.button;a.href=c.link;a.addEventListener('click',()=>{try{sessionStorage.setItem(sessionKey,'1')}catch{}});body.appendChild(a)}
   panel.appendChild(body);overlay.appendChild(panel);
   const css=document.createElement('style');css.textContent='.or-promo-overlay{position:fixed;inset:0;z-index:99999;background:rgba(20,15,12,.62);display:flex;align-items:center;justify-content:center;padding:18px;animation:orPromoFade .2s ease}.or-promo-panel{position:relative;width:min(520px,100%);max-height:90vh;overflow:auto;background:#fffaf5;color:#30241d;border-radius:14px;box-shadow:0 22px 80px rgba(0,0,0,.3);animation:orPromoPop .24s ease}.or-promo-close{position:absolute;right:10px;top:10px;z-index:2;width:36px;height:36px;border:0;border-radius:50%;background:rgba(255,255,255,.94);color:#30241d;font-size:27px;line-height:1;cursor:pointer;box-shadow:0 2px 10px #0002}.or-promo-image{display:block;width:100%;max-height:310px;object-fit:cover}.or-promo-copy{padding:26px;text-align:center}.or-promo-copy h2{font:600 clamp(23px,5vw,32px)/1.2 Georgia,serif;margin:0 0 10px}.or-promo-copy p{font:14px/1.65 Arial,sans-serif;color:#6e6258;margin:0 0 18px;white-space:pre-line}.or-promo-cta{display:inline-block;padding:12px 23px;background:#30241d;color:white!important;text-decoration:none;font:700 11px Arial,sans-serif;letter-spacing:1px;border-radius:4px}.or-promo-cta:hover{opacity:.88}@keyframes orPromoFade{from{opacity:0}to{opacity:1}}@keyframes orPromoPop{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}@media(max-width:480px){.or-promo-copy{padding:22px 18px}.or-promo-image{max-height:240px}}';document.head.appendChild(css);
   setTimeout(()=>{if(document.body)document.body.appendChild(overlay);else document.addEventListener('DOMContentLoaded',()=>document.body.appendChild(overlay),{once:true})},900);
  }catch(e){console.warn('Promotional popup unavailable:',e)}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
