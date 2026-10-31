/* Animation de démarrage officielle de Wild Kart (assets/identite/animation-demarrage.html), script séparé pour la politique de sécurité.
   Pilotée par boot.js : demarrage.html?production, puis WildKartLoader.finish() ; fin classique (par défaut). */
(()=>{
const $=i=>document.getElementById(i),svg=$("s"),rd=$("r"),L=rd.getTotalLength(),NS='http://www.w3.org/2000/svg',
md=$("mdu"),mb=$("mbu"),kt=$("kart"),ph=$("ph"),pc=$("pc"),lq=$("lq"),fx=$("fx"),rn=$("rn"),wr=$("wr"),wf=$("wf"),hd=$("hd"),
gW=$("gW"),gK=$("gK"),sa=$("sa"),sb=$("sb"),fl2=$("fl2"),cap=$("cap"),blk=$("blackout"),bam=$("bam"),flyingCap=$("flyingCap"),
progressFill=$("progressFill"),percentHud=$("percentHud"),progress=$("progress"),hudSub=$("hudSub");
const cl=(v,a=0,b=1)=>Math.min(b,Math.max(a,v)),eo=x=>1-Math.pow(1-cl(x),3),sm=(a,b,x)=>{x=cl((x-a)/(b-a));return x*x*(3-2*x)},
eio=x=>{x=cl(x);return x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2},eb=u=>{u=cl(u);return u*u*(2.1*u-1.1)};
const PH=['Préparation de la piste…','Gonflage des pneus…','Remplissage de la bouteille…','Dernière ligne droite…','C’EST PARTI !'];
const ENDING_MODES={CLASSIC:'classic',ALT:'alt'};
let endingMode=ENDING_MODES.CLASSIC;

/* Lettres */
const mk=(t,i,j,k,g)=>'<g class="lt" style="--i:'+i+';--j:'+j+'"><g class="pp"><use href="#t'+t+'" fill="#0a1a4a" fill-opacity=".55" stroke="#4fd2ff" stroke-width="2.5" stroke-linejoin="round"/><g class="'+k+'"><use href="#t'+t+'" x="5" y="6" fill="#1d3fd0"/><use href="#t'+t+'" fill="url(#'+g+')"/></g></g></g>';
$('wild').innerHTML=mk('W',0,0,'lw','wg')+mk('L',2,2,'lw','wg')+mk('D',3,3,'lw','wg');
$('kartw').innerHTML=mk('K',4,0,'lk','kg')+mk('A',5,1,'lk','kg')+mk('R',6,2,'lk','kg')+mk('T',7,3,'lk','kg');
let h='';
for(let r=0;r<3;r++){h+='<g class="cr">';for(let i=-3;i<30;i++)if((i+r)%2==0)h+='<rect x="'+i*22+'" y="'+(-66+r*22)+'" width="22" height="22"/>';h+='</g>'}
$('ckr').innerHTML=h;
const rows=[...document.querySelectorAll('.cr')];

/* Kart : géométrie rigide, sans déformation dans les virages */
const KS=.15,XM=710,YM=370;
const BODY='M135,440L135,300C135,265 150,238 190,228L262,216L240,162C215,163 160,165 128,147C105,133 95,105 95,85C95,72 103,66 118,68L322,98C345,102 365,118 368,138C370,155 358,165 340,167L318,167L346,212L468,198C464,188 464,170 470,158C477,141 497,136 522,142C552,150 572,170 592,207C614,246 637,281 682,299C732,319 800,322 860,320C905,318 930,300 945,275C955,258 965,238 978,215C990,192 1005,172 1030,167C1100,175 1200,205 1270,262C1310,295 1335,325 1352,345C1375,345 1395,355 1405,375C1415,400 1410,425 1395,437C1385,443 1375,440 1360,440L1231,440A146,146 0 0 0 943,440L477,440A146,146 0 0 0 189,440L135,440Z';
const EDGE='M135,300'+BODY.slice(BODY.indexOf('C135,265'),BODY.lastIndexOf('L135,440Z'));
const SRC={
  hole:['M189,440A146,146 0 0 1 477,440Z','M943,440A146,146 0 0 1 1231,440Z'],
  body:[BODY],edge:[EDGE],
  stick:['M910.9,245.8L971.9,219.8A15,15 0 0 0 960.1,192.2L899.1,218.2A15,15 0 0 0 910.9,245.8Z'],
  bar:['M879.3,259.9L955.3,149.9A21,21 0 0 0 920.7,126.1L844.7,236.1A21,21 0 0 0 879.3,259.9Z'],
  sw:['M500,240C525,310 575,350 650,368C700,380 740,382 780,380'],
  streak:['M120,262C65,262 35,250 5,240','M150,215C100,215 68,205 30,190']
};
const EL={};document.querySelectorAll('[data-k]').forEach(e=>(EL[e.dataset.k]=EL[e.dataset.k]||[]).push(e));
function setD(k,d){(EL[k]||[]).forEach(e=>e.setAttribute('d',d))}
for(const k in SRC)setD(k,SRC[k].join(''));

const P0=rd.getPointAtLength(0),P0b=rd.getPointAtLength(4),PL=rd.getPointAtLength(L),PLb=rd.getPointAtLength(L-4);
const T0x=(P0b.x-P0.x)/4,T0y=(P0b.y-P0.y)/4,TLx=(PL.x-PLb.x)/4,TLy=(PL.y-PLb.y)/4;
function positionOnRoad(s){
  let x,y,tx,ty;
  if(s<0){x=P0.x+s*T0x;y=P0.y+s*T0y;tx=T0x;ty=T0y}
  else if(s>L){x=PL.x+(s-L)*TLx;y=PL.y+(s-L)*TLy;tx=TLx;ty=TLy}
  else {const a=rd.getPointAtLength(s),b=rd.getPointAtLength(Math.min(L,s+2)),c=rd.getPointAtLength(Math.max(0,s-2));
    x=a.x;y=a.y;tx=b.x-c.x;ty=b.y-c.y}
  const m=Math.hypot(tx,ty)||1;
  return {x,y,a:Math.atan2(ty/m,tx/m)*180/Math.PI};
}
function drawKart(sc,op,scale,spd){
  const p=positionOnRoad(sc), k=KS*scale;
  // Un SEUL mouvement de translation + rotation, aucune déformation de la carrosserie.
  kt.setAttribute('transform',`translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${p.a.toFixed(2)}) scale(${k.toFixed(4)}) translate(${-XM} ${-YM})`);
  kt.setAttribute('opacity',op);
  const spin=(sc/(89*KS)*180/Math.PI).toFixed(2);
  wr.setAttribute('transform',`translate(333 407) rotate(${spin})`);
  wf.setAttribute('transform',`translate(1087 407) rotate(${spin})`);
  const trail=cl(spd/190,0,1.15)*op;
  (EL.streak||[]).forEach(e=>e.setAttribute('opacity',(0.8*trail).toFixed(2)));
}

/* Position de la ligne d’arrivée sur le tracé */
let SF=0,bd=1e9;
for(let s=0;s<=L;s+=3){const p=rd.getPointAtLength(s),d=(p.x-531)**2+(p.y-690)**2;if(d<bd){bd=d;SF=s}}

/* Boucle d’animation */
const HW=377*KS,SC0=HW,SC1=L-HW+24;
let clock=0,last=0,shown=0,target=0,demo=true,done=false,tD=0,fv=0,rv=-1,sPrev=0,vS=0,off=0,phI=-1,phT=0,pcT='',ready=false,loopRunning=false;
function schedule(){if(!loopRunning){loopRunning=true;requestAnimationFrame(frame)}}
function setMobileProgress(value){
  const n=Math.round(cl(value)*100);
  progressFill.style.width=n+'%';percentHud.textContent=n+' %';progress.setAttribute('aria-valuenow',n);
  hudSub.textContent=done?'COURSE PRÊTE':n<100?'PRÉPARATION DE LA COURSE':'DERNIERS RÉGLAGES';
}

function resetFinishFx(){
  gW.removeAttribute('transform');gK.removeAttribute('transform');
  sa.setAttribute('opacity',1);sb.setAttribute('opacity',1);fl2.setAttribute('opacity',1);
  kt.setAttribute('opacity',0);kt.setAttribute('transform','');hd.setAttribute('opacity',0);rn.setAttribute('opacity',0);fx.setAttribute('opacity',0);
  blk.style.opacity='0';bam.setAttribute('opacity',0);bam.removeAttribute('transform');
  flyingCap.setAttribute('opacity','0');flyingCap.removeAttribute('transform');
  cap.removeAttribute('transform');cap.setAttribute('opacity',1);
  gK.setAttribute('opacity',1);
}
function restart(){
  svg.classList.remove('play','done');void svg.getBoundingClientRect();svg.classList.add('play');
  clock=0;last=performance.now();shown=0;target=0;done=false;fv=0;rv=-1;sPrev=0;vS=0;phI=-1;pcT='';ready=false;setMobileProgress(0);
  ph.setAttribute('font-size',17);ph.setAttribute('fill','#9fd6ff');
  resetFinishFx();schedule();
}
function eraseRoad(progress){
  // Le dash ne montre plus que la partie APRES le point d'effacement.
  const e=L*eio(progress),tail=Math.max(0,L-e),gap=L*3;
  const dash=tail.toFixed(3)+' '+gap.toFixed(1);
  md.setAttribute('stroke-dasharray',dash);mb.setAttribute('stroke-dasharray',dash);
  md.setAttribute('stroke-dashoffset',(-e).toFixed(3));mb.setAttribute('stroke-dashoffset',(-e).toFixed(3));
  fl2.setAttribute('opacity',cl((SF-e)/26));
  if(progress>0&&progress<1){
    const p=rd.getPointAtLength(e);
    hd.setAttribute('transform',`translate(${p.x} ${p.y})`);
    hd.setAttribute('opacity',String(Math.min(1,5*progress,5*(1-progress))));
  }else hd.setAttribute('opacity',0);
}
function announceReady(){
  if(ready)return;
  ready=true;
  window.dispatchEvent(new CustomEvent('wildkart:ready'));
  if(typeof window.WildKartLoader.onReady==='function')window.WildKartLoader.onReady();
}
function classicEnd(q){
  const kf=eo((q-.14)/.42);
  if(kf<1)drawKart(SC1,1-kf,1+.18*kf,vS);else kt.setAttribute('opacity',0);

  eraseRoad(cl((q-.24)/1.12));

  gW.setAttribute('transform','translate('+(-1900*eb((q-.44)/.7))+ ' 0)');
  gK.setAttribute('transform','translate('+(1900*eb((q-.50)/.7))+ ' 0)');
  const sf=1-cl((q-.40)/.36);sa.setAttribute('opacity',sf);sb.setAttribute('opacity',sf);
  const xf=1-cl((q-.92)/.34);
  if(q>1.72)announceReady();
  if(q>3.2&&demo)restart();
  return xf;
}
function altEnd(q){
  /* on garde la voiture jusqu’à la fin du tracé, puis on passe à une fin plus cinématique */
  const kf=eo((q-.14)/.42);
  if(kf<1)drawKart(SC1,1-kf,1+.15*kf,vS);else kt.setAttribute('opacity',0);

  eraseRoad(cl((q-.24)/1));

  const hold=1-cl((q-.55)/.18);
  gK.setAttribute('opacity',hold);sa.setAttribute('opacity',hold);sb.setAttribute('opacity',hold);

  /* Bouteille sur le i : son bouchon jaillit vers la caméra. */
  const pop=cl((q-.65)/.20),fly=cl((q-.84)/.38),impact=cl((q-1.12)/.15),black=cl((q-1.23)/.19);
  const startFly=sm(0,.08,fly);
  cap.setAttribute('opacity',String(1-startFly));
  if(fly>0&&fly<1){
    const z=1+40*eio(fly),x=503+(400-503)*eio(fly),y=267+(400-267)*eio(fly);
    flyingCap.setAttribute('transform',`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${(360*fly).toFixed(1)}) scale(${z.toFixed(3)})`);
    flyingCap.setAttribute('opacity',String(sm(0,.08,fly)*(1-sm(.90,1,fly))));
  }else flyingCap.setAttribute('opacity','0');
  bam.setAttribute('opacity',String(sm(0,.4,impact)*(1-sm(.65,1,impact))));
  const bs=1+.6*eio(impact);
  bam.setAttribute('transform',`translate(${400*(1-bs)} ${400*(1-bs)}) scale(${bs.toFixed(3)})`);
  blk.style.opacity=black.toFixed(3);
  fx.setAttribute('opacity',String(.52*(1-black)*sm(0,.75,impact)));

  if(q>1.51)announceReady();
  if(q>2.7&&demo)restart();
  return 1-black;
}
function frame(now){
  loopRunning=false;
  if(document.hidden){last=now;schedule();return}
  if(now-last<14){schedule();return} // 60 images/s maximum, batterie préservée
  const dt=Math.max(.001,Math.min(.055,(now-last)/1e3));last=now;clock+=dt;
  const T=clock;
  if(!done){
    md.setAttribute('stroke-dasharray',(L*eo((T-.2)/1.5)+.01)+' '+L*2);
    md.setAttribute('stroke-dashoffset',0);mb.setAttribute('stroke-dashoffset',0);
  }
  const go=T>1.9;
  if(demo&&!done){const x=cl((T-1.9)/7);target=cl(x+.035*Math.sin(x*20))}
  if(go&&!done){shown+=(target-shown)*(1-Math.exp(-dt*6));if(Math.abs(target-shown)<.0015)shown=target}
  if(!done)mb.setAttribute('stroke-dasharray',(L*shown+.01)+' '+L*2);
  setMobileProgress(shown);
  lq.setAttribute('transform','translate(0 '+(-(.08+.92*shown)*148)+')');
  if(!done&&go&&shown>=.998){done=true;tD=T;fv=.75;rv=0;svg.classList.add('done');ph.setAttribute('font-size',28);ph.setAttribute('fill','#ffbb2e');pc.textContent='';pcT=''}
  svg.style.setProperty('--lw',done?1:sm(.08,.5,shown));
  svg.style.setProperty('--lk',done?1:sm(.45,.97,shown));
  const i=done?4:shown<.2?0:shown<.45?1:shown<.7?2:3;
  if(i!==phI){phI=i;ph.textContent=PH[i];phT=T}
  const ta=cl((T-1.2)/.4);let xf=1;
  if(!done){const t=Math.round(shown*100)+' %';if(t!==pcT){pc.textContent=t;pcT=t}}
  pc.setAttribute('opacity',done?0:ta);
  const k=cl((T-1.3)/.5);
  if(!done){
    const sc=SC0+shown*(SC1-SC0);
    vS+=((sc-sPrev)/dt-vS)*(1-Math.exp(-dt*8));sPrev=sc;
    drawKart(sc-(1-eo(k))*260,k,1,vS);
  }else{
    const q=T-tD;vS*=Math.exp(-dt*5);
    xf=(endingMode===ENDING_MODES.ALT?altEnd(q):classicEnd(q));
  }
  ph.setAttribute('opacity',cl((T-phT)/.3)*ta*xf);
  off+=dt*(36+vS*.45);
  rows.forEach((g,r)=>g.setAttribute('transform','translate('+((r==1?-off:off)%44)+' 0)'));
  if(fv>.002 && endingMode!==ENDING_MODES.ALT){fv*=Math.exp(-dt*3.2);fx.setAttribute('opacity',fv)}else if(endingMode!==ENDING_MODES.ALT)fx.setAttribute('opacity',0);
  if(rv>=0){rv+=dt*1.6;rn.setAttribute('r',10+rv*130);rn.setAttribute('opacity',Math.max(0,1-rv));if(rv>1)rv=-1}
  if(demo||!ready)schedule();
}
function setEndingMode(mode,replay=false){
  endingMode=mode==='alt'?ENDING_MODES.ALT:ENDING_MODES.CLASSIC;
  $('classic').setAttribute('aria-pressed',String(endingMode==='classic'));
  $('alternative').setAttribute('aria-pressed',String(endingMode==='alt'));
  if(replay){demo=true;restart()}
}
$('classic').addEventListener('click',()=>setEndingMode('classic',true));
$('alternative').addEventListener('click',()=>setEndingMode('alt',true));
$('re').addEventListener('click',()=>{demo=true;restart()});
window.WildKartLoader={
  set(p){demo=false;target=cl(p>1?p/100:p);$('preview').style.display='none';schedule()},
  finish(){demo=false;target=1;$('preview').style.display='none';schedule()},
  restart(){restart()},
  setEndingMode(mode){setEndingMode(mode)},
  setProductionMode(value=true){$('preview').style.display=value?'none':'flex';},
  ENDING_MODES,
  onReady:null
};
if(new URLSearchParams(window.location.search).get('ending')==='alt')endingMode='alt';
if(new URLSearchParams(window.location.search).has('production'))$('preview').style.display='none';
$('classic').setAttribute('aria-pressed',String(endingMode==='classic'));
$('alternative').setAttribute('aria-pressed',String(endingMode==='alt'));
restart();
})();
