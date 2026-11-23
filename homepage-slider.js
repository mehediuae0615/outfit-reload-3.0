(() => {
  const track=document.getElementById('heroSlides');
  const dots=document.getElementById('heroDots');
  const root=document.getElementById('homeHero');
  if(!track||!dots)return;
  const fallback=[{image:'https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=1800&q=88',link:'collections.htm',alt:"Men's premium fashion collection"}];
  let slides=fallback,index=0,timer=null;
  const safeUrl=(v)=>{try{const u=new URL(v,location.href);return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return ''}};
  function render(){
    track.innerHTML=slides.map((s,n)=>`<a class="or-hero-slide${n===index?' is-active':''}" href="${safeUrl(s.link||'collections.htm')||'collections.htm'}" aria-label="${String(s.alt||'Explore collection').replace(/[<>"']/g,'')}"><img src="${safeUrl(s.image)}" alt="${String(s.alt||'Featured fashion').replace(/[<>"']/g,'')}" ${n===0?'fetchpriority="high"':'loading="lazy"'}></a>`).join('');
    dots.innerHTML=slides.map((s,n)=>`<button type="button" class="or-hero-dot${n===index?' is-active':''}" aria-label="Go to slide ${n+1}" data-slide="${n}"></button>`).join('');
    dots.querySelectorAll('[data-slide]').forEach(b=>b.addEventListener('click',()=>{show(Number(b.dataset.slide));restart()}));
  }
  function show(n){if(!slides.length)return;index=(n+slides.length)%slides.length;track.querySelectorAll('.or-hero-slide').forEach((el,k)=>el.classList.toggle('is-active',k===index));dots.querySelectorAll('.or-hero-dot').forEach((el,k)=>el.classList.toggle('is-active',k===index))}
  function restart(){clearInterval(timer);if(slides.length>1&&!matchMedia('(prefers-reduced-motion: reduce)').matches)timer=setInterval(()=>show(index+1),4800)}
  root.querySelector('.or-hero-prev')?.addEventListener('click',()=>{show(index-1);restart()});
  root.querySelector('.or-hero-next')?.addEventListener('click',()=>{show(index+1);restart()});
  root.addEventListener('mouseenter',()=>clearInterval(timer));
  root.addEventListener('mouseleave',restart);
  root.addEventListener('touchstart',()=>clearInterval(timer),{passive:true});
  root.addEventListener('touchend',restart,{passive:true});
  async function load(){
    try{
      const client=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);
      const {data,error}=await client.from('store_settings').select('value').eq('key','homepage_slides').maybeSingle();
      if(error)throw error;
      const parsed=JSON.parse(data?.value||'[]');
      const valid=(Array.isArray(parsed)?parsed:parsed.slides||[]).filter(x=>x&&safeUrl(x.image)).slice(0,5);
      if(valid.length)slides=valid;
    }catch(e){console.warn('Homepage slides are using the default image:',e.message||e)}
    render();restart();
  }
  load();
})();