(() => {
  const track=document.getElementById('heroSlides');
  const dots=document.getElementById('heroDots');
  const root=document.getElementById('homeHero');
  if(!track||!dots)return;
  const fallback=[{image:'https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=1800&q=88',link:'collections.htm',alt:"Men's premium fashion collection"}];
  let slides=fallback,index=0,timer=null,interval=5000,animation='fade',duration=850;
  const safeUrl=(v)=>{try{const u=new URL(v,location.href);return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return ''}};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function render(){
    root.dataset.animation=animation;
    root.style.setProperty('--or-hero-duration',`${duration}ms`);
    track.innerHTML=slides.map((s,n)=>`<a class="or-hero-slide${n===index?' is-active':''}" href="${safeUrl(s.link||'collections.htm')||'collections.htm'}" aria-label="${esc(s.alt||'Explore collection')}"><img src="${safeUrl(s.image)}" alt="${esc(s.alt||'Featured fashion')}" ${n===0?'fetchpriority="high"':'loading="lazy"'}></a>`).join('');
    dots.innerHTML=slides.map((s,n)=>`<button type="button" class="or-hero-dot${n===index?' is-active':''}" aria-label="Go to slide ${n+1}" data-slide="${n}"></button>`).join('');
    dots.querySelectorAll('[data-slide]').forEach(b=>b.addEventListener('click',()=>{show(Number(b.dataset.slide));restart()}));
  }
  function show(n){
    if(!slides.length)return;
    const old=index;index=(n+slides.length)%slides.length;
    track.querySelectorAll('.or-hero-slide').forEach((el,k)=>{el.classList.toggle('is-active',k===index);el.classList.toggle('was-active',k===old&&old!==index)});
    dots.querySelectorAll('.or-hero-dot').forEach((el,k)=>el.classList.toggle('is-active',k===index));
    window.setTimeout(()=>track.querySelectorAll('.was-active').forEach(el=>el.classList.remove('was-active')),duration+40);
  }
  function restart(){clearInterval(timer);if(slides.length>1&&!matchMedia('(prefers-reduced-motion: reduce)').matches)timer=setInterval(()=>show(index+1),interval)}
  root.querySelector('.or-hero-prev')?.addEventListener('click',()=>{show(index-1);restart()});
  root.querySelector('.or-hero-next')?.addEventListener('click',()=>{show(index+1);restart()});
  root.addEventListener('mouseenter',()=>clearInterval(timer));
  root.addEventListener('mouseleave',restart);
  root.addEventListener('touchstart',()=>clearInterval(timer),{passive:true});
  root.addEventListener('touchend',restart,{passive:true});
  async function load(){
    try{
      const client=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);
      const {data,error}=await client.from('store_settings').select('key,value').in('key',['homepage_slides','homepage_slider_options','homepage_categories']);
      if(error)throw error;
      const settings=Object.fromEntries((data||[]).map(x=>[x.key,x.value]));
      const parsed=JSON.parse(settings.homepage_slides||'[]');
      const valid=(Array.isArray(parsed)?parsed:parsed.slides||[]).filter(x=>x&&safeUrl(x.image)).slice(0,5);
      if(valid.length)slides=valid;
      if(settings.homepage_slider_options){const o=JSON.parse(settings.homepage_slider_options);interval=Math.max(1500,Math.min(15000,Number(o.interval)||5000));animation=o.animation==='slide'?'slide':'fade';duration=Math.max(200,Math.min(1500,Number(o.duration)||850))}
      if(settings.homepage_categories){
        const cfg=JSON.parse(settings.homepage_categories),items=Array.isArray(cfg)?cfg:(cfg.items||[]),layout=cfg.layout||{};
        const grid=document.querySelector('#shop-categories .category-grid');
        if(grid&&items.length){
          const cols=Math.max(2,Math.min(4,Number(layout.desktopCols)||4)),mobile=Math.max(1,Math.min(2,Number(layout.mobileCols)||2));
          const shape=Math.max(.65,Math.min(1.4,Number(layout.shape)||.82)),gap=Math.max(6,Math.min(28,Number(layout.gap)||16));
          grid.style.setProperty('--or-category-cols',cols);grid.style.setProperty('--or-category-mobile-cols',mobile);grid.style.setProperty('--or-category-shape',shape);grid.style.setProperty('--or-category-gap',`${gap}px`);
          const byKey=new Map(items.map(x=>[x.key,x]));
          grid.querySelectorAll('.category-card').forEach(card=>{
            const item=byKey.get(card.dataset.category);if(!item)return;
            if(item.visible===false){card.hidden=true;return}
            card.hidden=false;
            const title=card.querySelector('b'),img=card.querySelector('img');
            if(title)title.textContent=String(item.name||item.key).toUpperCase();
            if(img&&safeUrl(item.image)){img.src=safeUrl(item.image);img.alt=String(item.name||item.key)}
          });
        }
      }
    }catch(e){console.warn('Homepage display settings could not be loaded:',e.message||e)}
    render();restart();
  }
  load();
})();