/* Outfit Reload 3.0 - public content loader. Existing announcement key is preserved. */
(function(){
  if(!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) return;
  const client=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);
  const page=(location.pathname.split('/').pop()||'index.html').replace('.html','').replace('.htm','');
  const selector='main h1,main h2,main h3,main p,main li';
  const excluded='a,button,label,script,style,.product-grid,.helper,[hidden]';
  const getTextNodes=()=>Array.from(document.querySelectorAll(selector)).filter(el=>!el.closest(excluded)&&!el.querySelector('a')&&!el.querySelector('button')&&el.textContent.trim());
  function setLink(selector,value){if(!value)return;document.querySelectorAll(selector).forEach(a=>a.href=value)}
  async function load(){
    const {data,error}=await client.from('store_settings').select('key,value');
    if(error){console.warn('Website content settings could not be loaded:',error.message);return}
    const settings=Object.fromEntries((data||[]).map(x=>[x.key,x.value]));
    const announcementEnabled=settings.announcement_enabled!=='false';document.querySelectorAll('.announcement,#announcement').forEach(el=>{if(settings.announcement){const span=document.createElement('span');span.className='announcement-marquee-text';span.textContent=settings.announcement;el.replaceChildren(span);}el.hidden=!announcementEnabled;});
    const raw=settings['cms_page_'+page];
    if(raw){try{const values=JSON.parse(raw),nodes=getTextNodes();values.forEach((v,i)=>{if(nodes[i]!==undefined)nodes[i].textContent=v})}catch(e){console.warn('Invalid page content for '+page,e)}}
    const cfg={};try{Object.assign(cfg,JSON.parse(settings.cms_global||'{}'))}catch{}
    if(cfg.whatsapp){const n=String(cfg.whatsapp).replace(/[^0-9]/g,'');setLink('a[href*="wa.me"],a[href*="whatsapp"]','https://wa.me/'+n)}
    if(cfg.phone)setLink('a[href^="tel:"]','tel:'+cfg.phone.replace(/[^+0-9]/g,''));
    if(cfg.email)setLink('a[href^="mailto:"]','mailto:'+cfg.email);
    if(cfg.facebook)setLink('a[href*="facebook.com"]',cfg.facebook);
    if(cfg.instagram)setLink('a[href*="instagram.com"]',cfg.instagram);
    if(cfg.tiktok)setLink('a[href*="tiktok.com"]',cfg.tiktok);
    if(cfg.otherSocial)setLink('[data-other-social]',cfg.otherSocial);
    document.querySelectorAll('[data-cms-contact="address"]').forEach(el=>el.textContent=cfg.address||'Bangladesh');
    document.querySelectorAll('[data-cms-contact="whatsapp"]').forEach(el=>el.textContent=cfg.whatsapp||'');
    document.querySelectorAll('[data-cms-contact="phone"]').forEach(el=>el.textContent=cfg.phone||'');
    document.querySelectorAll('[data-cms-contact="email"]').forEach(el=>el.textContent=cfg.email||'Not set');
    document.querySelectorAll('[data-cms-setting="return_days"]').forEach(el=>el.textContent=String(Number(cfg.returnDays??7)));
    document.querySelectorAll('footer').forEach(footer=>{let box=footer.querySelector('.cms-social-links');if(!box){box=document.createElement('div');box.className='cms-social-links';box.style.cssText='display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin:14px auto';footer.appendChild(box)}box.innerHTML='';[['Facebook',cfg.facebook],['Instagram',cfg.instagram],['TikTok',cfg.tiktok],['Other',cfg.otherSocial]].filter(x=>x[1]).forEach(([label,url])=>{const a=document.createElement('a');a.textContent=label;a.href=url;a.target='_blank';a.rel='noopener noreferrer';box.appendChild(a)})});
    const fees={inside:Number(cfg.deliveryInside??80),outside:Number(cfg.deliveryOutside??130)};
    const insideOption=document.querySelector('#deliveryArea option[value="inside_dhaka"]');
    const outsideOption=document.querySelector('#deliveryArea option[value="outside_dhaka"]');
    if(insideOption)insideOption.textContent='Inside Dhaka · ৳'+fees.inside.toLocaleString('en-BD');
    if(outsideOption)outsideOption.textContent='Outside Dhaka · ৳'+fees.outside.toLocaleString('en-BD');
    document.querySelectorAll('[data-cms-setting="delivery_inside"]').forEach(el=>el.textContent='৳'+fees.inside.toLocaleString('en-BD'));
    document.querySelectorAll('[data-cms-setting="delivery_outside"]').forEach(el=>el.textContent='৳'+fees.outside.toLocaleString('en-BD'));
    if(cfg.deliveryTimeInside)document.querySelectorAll('[data-cms-setting="delivery_time_inside"]').forEach(el=>el.textContent=cfg.deliveryTimeInside);
    if(cfg.deliveryTimeOutside)document.querySelectorAll('[data-cms-setting="delivery_time_outside"]').forEach(el=>el.textContent=cfg.deliveryTimeOutside);
    window.OUTFIT_RELOAD_SETTINGS={deliveryInside:fees.inside,deliveryOutside:fees.outside,returnDays:Number(cfg.returnDays??7),...cfg};
    document.dispatchEvent(new CustomEvent('outfit:content-loaded',{detail:window.OUTFIT_RELOAD_SETTINGS}));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();
