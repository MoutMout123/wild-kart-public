/* Wild Kart — compilation des données et repères de production, sans dépendance DOM. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./three.min.js'));
  else root.WKProduction=factory(root.THREE);
})(typeof window==='object'?window:globalThis,function(T){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function definition(data){
    const t=JSON.parse(JSON.stringify(data.legacy));
    Object.assign(t,{id:data.id,name:data.name,pts:data.route.nodes.map(n=>[n.position[0],n.position[2],n.position[1]]),width:data.route.nodes[0].width,
      branches:JSON.parse(JSON.stringify(data.alternatives)),warp:JSON.parse(JSON.stringify(data.specials.warp)),glide:JSON.parse(JSON.stringify(data.specials.glide)),tunnels:JSON.parse(JSON.stringify(data.specials.tunnels)),massifs:JSON.parse(JSON.stringify(data.specials.massifs||[])),vivants:JSON.parse(JSON.stringify(data.specials.vivants||[])),eaux:JSON.parse(JSON.stringify(data.specials.eaux||[]))});
    t.sourceData=data;
    // « relief refait » : altitudes nouvelles, mais pipeline historique (murs, décors, physique) conservé.
    // « coupe refaite » : sections spéciales, relief ou parcelles ajoutés pour la difficulté de la coupe, pipeline historique.
    // « référence refaite » : carte de référence de sa coupe (Prairie), pipeline historique avec murs réels.
    // « refonte concepteur » : carte remodelée avec le concepteur (massifs, tunnels, branches, décors interactifs), pipeline historique.
    if(!['non refait','relief refait','coupe refaite','référence refaite','refonte concepteur'].includes(data.status))t.production=data;
    return t;
  }
  function install(tracks,data){
    if(!data || data.length!==tracks.length)throw new Error('Catalogue de circuits incomplet');
    const ids=new Set(tracks.map(t=>t.id));for(const t of data)if(!ids.has(t.id))throw new Error('ID de circuit inconnu : '+t.id);
    tracks.splice(0,tracks.length,...data.map(definition));
  }
  // Transport minimal par rotation entre tangentes ; correction du résidu sur une boucle fermée.
  // Le repère est droit avec X = -latéral historique, Y = haut et Z = tangente.
  function frames(points,closed=true,initialUp=[0,1,0],banks){
    const n=points.length,forward=[],right=[],up=[],distance=new Float64Array(n+1),q=new T.Quaternion();
    for(let i=0;i<n;i++){
      const a=points[closed?(i-1+n)%n:Math.max(0,i-1)],b=points[closed?(i+1)%n:Math.min(n-1,i+1)];
      const f=new T.Vector3().subVectors(b,a);if(f.lengthSq()<1e-12)throw new Error('Tangente nulle au point '+i);forward.push(f.normalize());
      if(i)distance[i]=distance[i-1]+points[i].distanceTo(points[i-1]);
    }
    distance[n]=distance[n-1]+(closed?points[n-1].distanceTo(points[0]):0);
    let u=new T.Vector3(...initialUp);u.addScaledVector(forward[0],-u.dot(forward[0]));
    if(u.lengthSq()<1e-8){u.set(1,0,0);u.addScaledVector(forward[0],-u.dot(forward[0]));}u.normalize();
    up.push(u.clone());
    for(let i=1;i<n;i++){q.setFromUnitVectors(forward[i-1],forward[i]);u=u.clone().applyQuaternion(q);u.addScaledVector(forward[i],-u.dot(forward[i])).normalize();up.push(u);}
    let residual=0;
    if(closed){q.setFromUnitVectors(forward[n-1],forward[0]);const end=up[n-1].clone().applyQuaternion(q);residual=Math.atan2(new T.Vector3().crossVectors(end,up[0]).dot(forward[0]),end.dot(up[0]));}
    for(let i=0;i<n;i++){
      const roll=residual*distance[i]/(distance[n]||1)+(banks?banks[i]||0:0);up[i].applyAxisAngle(forward[i],roll).normalize();
      right.push(new T.Vector3().crossVectors(forward[i],up[i]).normalize());up[i].crossVectors(right[i],forward[i]).normalize();
    }
    return {forward,right,up,distance};
  }
  function applyFrames(S,def){
    if(!def.production)return;
    const positions=Array.from({length:S.N},(_,i)=>S.wz&&S.wz[i]?new T.Vector3().fromArray(S.wo,i*3):new T.Vector3(S.px[i],S.py[i],S.pz[i]));
    // Le dévers est défini indépendamment de la courbure (aucune normale de Frenet).
    const banks=new Float64Array(S.N);
    for(const z of def.warp||[])if(z.type!=='loop'){
      const a=Math.floor(z.from*S.N),b=Math.floor(z.to*S.N);
      for(let i=a;i<=b;i++){const u=(i-a)/(b-a),smooth=x=>x*x*(3-2*x),r=u<.25?smooth(u*4):u>.75?smooth((1-u)*4):1;banks[i]=(z.angle||60)*Math.PI/180*(z.side||1)*r;}
    }
    const F=frames(positions,true,def.production.route.nodes[0].up,banks);
    // Le moteur arcade emploie des sections verticales hors anti-gravité. Un transport
    // libre sur la boucle complète introduisait du roulis jusque dans les jonctions.
    // Ancrer les sections ordinaires à cette convention ; transporter les loopings seulement.
    for(let i=0;i<S.N;i++){
      const loop=(def.warp||[]).some(z=>z.type==='loop'&&i>=z.from*S.N&&i<=z.to*S.N);
      if(loop)continue;
      const right=new T.Vector3(S.rx[i],0,S.rz[i]),up=new T.Vector3(0,1,0);
      if(S.wz&&S.wz[i]){
        const f=F.forward[i];right.addScaledVector(f,-right.dot(f)).normalize();up.crossVectors(right,f).normalize();
        const angle=banks[i];right.applyAxisAngle(f,-angle);up.applyAxisAngle(f,-angle);
      }
      F.right[i]=right;F.up[i]=up;
    }
    if(!S.wz){S.wz=new Uint8Array(S.N);S.wscale=new Float32Array(S.N).fill(1);S.ag=new Uint8Array(S.N);}
    for(const name of ['wo','wr','wu','wf'])S[name]=new Float32Array(S.N*3);
    for(let i=0;i<S.N;i++){
      positions[i].toArray(S.wo,i*3);F.right[i].toArray(S.wr,i*3);F.up[i].toArray(S.wu,i*3);F.forward[i].toArray(S.wf,i*3);
      // Conserver le masque spécial : les items et respawns utilisent wz pour exclure l'anti-gravité.
      const prev=(i-1+S.N)%S.N,next=(i+1)%S.N,visual=positions[prev].distanceTo(positions[next]),logical=Math.hypot(S.px[next]-S.px[prev],S.py[next]-S.py[prev],S.pz[next]-S.pz[prev]);
      S.wscale[i]=clamp(logical/(visual||1),.15,1);
    }
    S.distance=F.distance;S.productionFrames=true;
  }
  function point(P,i,lat=0,h=0){
    if(P.productionFrames || P.wz&&P.wz[i])return new T.Vector3(P.wo[i*3]+P.wr[i*3]*lat+P.wu[i*3]*h,P.wo[i*3+1]+P.wr[i*3+1]*lat+P.wu[i*3+1]*h,P.wo[i*3+2]+P.wr[i*3+2]*lat+P.wu[i*3+2]*h);
    const x=P.px[i]+P.rx[i]*lat,z=P.pz[i]+P.rz[i]*lat;
    return new T.Vector3(x,(P.heightAt?P.heightAt(x,z,i,P.py[i]):P.py[i])+h,z);
  }
  function nearMain(W,B,i,x,z){
    const S=W.S,guess=B.map[i];let best=Infinity,result=null;
    for(let q=-5;q<=5;q++){
      const j=(guess+q+S.N)%S.N,n=(j+1)%S.N,dx=S.px[n]-S.px[j],dz=S.pz[n]-S.pz[j],t=clamp(((x-S.px[j])*dx+(z-S.pz[j])*dz)/(dx*dx+dz*dz||1),0,1);
      const ex=x-S.px[j]-dx*t,ez=z-S.pz[j]-dz*t,d=ex*ex+ez*ez;
      if(d<best){best=d;result={distance:Math.sqrt(d),height:S.py[j]+(S.py[n]-S.py[j])*t};}
    }
    return result;
  }
  function installJunctions(W){
    if(!W.def.production)return;
    for(const B of W.branches){
      B.paintWeight=(x,z,i)=>clamp((nearMain(W,B,i,x,z).distance-W.hw-1)/3,0,1);
      B.heightAt=(x,z,i,base)=>{
        if(i>B.noseA+28&&i<B.noseB-28)return base;
        const m=nearMain(W,B,i,x,z),u=clamp((m.distance-W.wallD)/18,0,1),blend=u*u*(3-2*u);
        return m.height+(base-m.height)*blend;
      };
    }
  }
  function openMerge(W,P,i,side,kartX,kartZ){
    if(!W.def.production||P===W.S||!P.heightAt||i>P.noseA+4&&i<P.noseB-4)return false;
    const x=kartX??(P.px[i]+P.rx[i]*side*P.wallD),z=kartZ??(P.pz[i]+P.rz[i]*side*P.wallD),m=nearMain(W,P,i,x,z);
    return m.distance<(kartX==null?W.wallD-.2:W.lim);
  }
  function branchMesh(B){
    const pos=[],uv=[],detail=[],paint=[],indices=[],cols=Math.ceil(B.hw*2/1.2),stride=cols+1;
    for(let i=0;i<B.N;i++)for(let c=0;c<=cols;c++){
      const lat=(c/cols-.5)*B.hw*2,p=point(B,i,lat,.115);pos.push(...p.toArray());uv.push(c/cols,i*B.seg/24);detail.push(lat/3,i*B.seg/3);
      paint.push(B.paintWeight?B.paintWeight(p.x,p.z,i):1);
      if(i<B.N-1&&c<cols){const a=i*stride+c;indices.push(a,a+1,a+stride,a+1,a+stride+1,a+stride);}
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('wkSurfaceUv',new T.Float32BufferAttribute(detail,2));g.setAttribute('wkPaintWeight',new T.Float32BufferAttribute(paint,1));g.setIndex(indices);g.computeVertexNormals();return g;
  }
  function deckNeeded(W,P,i){
    if(P.glide?.[i])return false;
    // Les jonctions partagent déjà la chaussée principale : ne pas y superposer
    // une coque indépendante pouvant traverser l'autre voie.
    if(P.heightAt&&(i<=P.noseA+30||i>=P.noseB-30))return false;
    const p=point(P,i);
    return !!P.wz?.[i]||!!W.hAt&&p.y-W.hAt(p.x,p.z)>3;
  }
  function deckGeometry(P,segments,width,depth=1.4,roadWidth=width){
    const pos=[],uv=[],ix=[],selected=new Set(segments),N=P.N,half=width/2,hw=roadWidth/2,columns=hw<half?[-half,-hw,hw,half]:[-half,half];let sections=0;
    function quad(a,b,c,d,normal){
      const points=[a,b,c,d],cross=b.clone().sub(a).cross(c.clone().sub(a));
      const offset=pos.length/3;for(const p of points){pos.push(...p.toArray());uv.push(p.x/3,p.z/3);}
      if(cross.dot(normal)<0)ix.push(offset,offset+3,offset+1,offset+1,offset+3,offset+2);
      else ix.push(offset,offset+1,offset+3,offset+1,offset+2,offset+3);
    }
    function row(i){return [point(P,i,-half,.025),point(P,i,half,.025),point(P,i,-half,-depth),point(P,i,half,-depth)];}
    for(let cursor=0;cursor<segments.length;){
      const i=segments[cursor],a=row(i);let end=cursor;
      // Regrouper les sections presque droites sans déformer le tablier de plus
      // de 2,5 cm aux sections du tracé. Les transitions de dévers restent fines.
      while(end+1<segments.length&&end-cursor<7&&segments[end+1]===segments[end]+1){
        const next=segments[end+1]+1,last=row(next%N);let acceptable=true;
        if(P.wz?.[i]||P.wz?.[next%N])break;
        for(let k=i+1;k<next&&acceptable;k++){
          const middle=row(k%N),t=(k-i)/(next-i);
          for(let corner=0;corner<4;corner++)if(a[corner].clone().lerp(last[corner],t).distanceTo(middle[corner])>.025){acceptable=false;break;}
        }
        if(!acceptable)break;end++;
      }
      const j=(segments[end]+1)%N,b=row(j),up=point(P,i,0,1).sub(point(P,i)),right=a[1].clone().sub(a[0]).normalize(),forward=b[0].clone().add(b[1]).sub(a[0]).sub(a[1]).normalize();cursor=end+1;sections++;
      for(let col=0;col<columns.length-1;col++){
        const l=columns[col],r=columns[col+1],tl=point(P,i,l,.025),tr=point(P,i,r,.025),bl=point(P,i,l,-depth),br=point(P,i,r,-depth),ntl=point(P,j,l,.025),ntr=point(P,j,r,.025),nbl=point(P,j,l,-depth),nbr=point(P,j,r,-depth);
        // Même séparation chaussée/accotements et même diagonale que bandGeo.
        quad(tl,tr,ntr,ntl,up);quad(bl,br,nbr,nbl,up.clone().negate());
        if(!selected.has((i-1+N)%N))quad(tl,tr,br,bl,forward.clone().negate());
        if(!selected.has(j))quad(ntl,ntr,nbr,nbl,forward);
      }
      quad(a[0],a[2],b[2],b[0],right.clone().negate());
      quad(a[1],a[3],b[3],b[1],right);
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();g.userData.wkClosed=true;g.userData.deckSections=sections;return g;
  }
  // Barrières réellement construites : capsules horizontales dans l'espace arcade.
  // Le quadrilatère visible reste exporté, notamment pour contrôler le repli anti-gravité.
  function barrierStrip(g,logical,path){
    const p=g.attributes.position,ix=g.index.array,segments=[];
    for(let j=0;j<ix.length;j+=6){
      const a=ix[j],b=ix[j+2],at=ix[j+1],bt=ix[j+4];
      const read=i=>logical.slice(i*3,i*3+3),world=i=>[p.getX(i),p.getY(i),p.getZ(i)];
      segments.push({path,a:read(a),b:read(b),at:read(at),bt:read(bt),world:[world(a),world(b),world(at),world(bt)]});
    }
    g.userData.barriers=segments;
  }
  function terrainNormals(g){
    // Pondérer par l'angle au sommet : une grande face de falaise ne doit pas
    // retourner l'éclairage d'un petit triangle voisin au bord d'un plateau.
    const p=g.attributes.position,ix=g.index.array,n=new Float64Array(p.count*3),v=[new T.Vector3(),new T.Vector3(),new T.Vector3()],a=new T.Vector3(),b=new T.Vector3(),normal=new T.Vector3();
    for(let i=0;i<ix.length;i+=3){
      for(let j=0;j<3;j++)v[j].fromBufferAttribute(p,ix[i+j]);
      normal.crossVectors(a.subVectors(v[1],v[0]),b.subVectors(v[2],v[0])).normalize();
      for(let j=0;j<3;j++){
        const weight=Math.acos(clamp(a.subVectors(v[(j+1)%3],v[j]).normalize().dot(b.subVectors(v[(j+2)%3],v[j]).normalize()),-1,1));
        for(let c=0;c<3;c++)n[ix[i+j]*3+c]+=normal.getComponent(c)*weight;
      }
    }
    for(let i=0;i<n.length;i+=3){const length=Math.hypot(n[i],n[i+1],n[i+2])||1;for(let c=0;c<3;c++)n[i+c]/=length;}
    g.setAttribute('normal',new T.Float32BufferAttribute(n,3));
  }
  function lowerTerrain(heights,columns,iterations=3){
    const original=heights.slice();
    for(let pass=0;pass<iterations;pass++){
      const previous=heights.slice();
      for(let z=1;z<columns-1;z++)for(let x=1;x<columns-1;x++){
        const i=z*columns+x,mean=(previous[i-1]+previous[i+1]+previous[i-columns]+previous[i+columns]+4*previous[i])/8;
        // Éroder les ruptures sans relever le terrain dans une chaussée ou un tunnel.
        heights[i]=Math.min(previous[i],mean);
      }
    }
    let changed=0,maximumDrop=0;
    for(let i=0;i<heights.length;i++){if(original[i]-heights[i]>1e-5)changed++;maximumDrop=Math.max(maximumDrop,original[i]-heights[i]);}
    return {iterations,changed,maximumDrop};
  }
  function barrierIndex(segments){
    const cell=16,grid=new Map();
    for(let i=0;i<segments.length;i++){
      const s=segments[i];
      for(let x=Math.floor(Math.min(s.a[0],s.b[0])/cell);x<=Math.floor(Math.max(s.a[0],s.b[0])/cell);x++)
        for(let z=Math.floor(Math.min(s.a[2],s.b[2])/cell);z<=Math.floor(Math.max(s.a[2],s.b[2])/cell);z++){
          const key=x+','+z;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(i);
        }
    }
    return {segments,query(x,z,dx,dz,r){
      const ids=new Set();
      for(let a=Math.floor((Math.min(x,x+dx)-r)/cell);a<=Math.floor((Math.max(x,x+dx)+r)/cell);a++)
        for(let b=Math.floor((Math.min(z,z+dz)-r)/cell);b<=Math.floor((Math.max(z,z+dz)+r)/cell);b++)for(const i of grid.get(a+','+b)||[])ids.add(i);
      return Array.from(ids,i=>segments[i]);
    }};
  }
  function installBarriers(W){
    const segments=[];W.scene.traverse(o=>{if(o.isMesh&&W.roles.get(o.material)==='wall')segments.push(...(o.geometry.userData.barriers||[]));});
    if(W.def.production)fermerFentes(W,segments);
    W.barriers=barrierIndex(segments);
  }
  /* Correctif préparé (8 nov., défaut hérité de Grand Saut, wall-scrape P1@0,1139) : sur les cartes de production, les fermetures de
     jonction (closeJunctionWalls) ne sont pas construites ; au nez d'une branche, la reprise du mur principal pouvait s'arrêter à 2,3 m
     du muret gore : fente plus étroite qu'un kart, où il se coince. Toute extrémité libre d'un mur de route située à moins de 3 m
     d'un muret gore (même niveau à 1,5 m près) est reliée à son point le plus proche par un segment de collision invisible. */
  function fermerFentes(W,segments){
    const cle=(p)=>p[0].toFixed(2)+','+p[2].toFixed(2),n=new Map();for(const s of segments)if(!s.gore)for(const p of [s.a,s.b])n.set(cle(p),(n.get(cle(p))||0)+1);
    const gores=segments.filter(s=>s.gore),ajout=[];W.fentesFermees=[];
    for(const s of segments){if(s.gore||s.closure)continue;for(const [p,pt] of [[s.a,s.at],[s.b,s.bt]]){if(n.get(cle(p))!==1)continue;let best=null;
      for(const g of gores){const ex=g.b[0]-g.a[0],ez=g.b[2]-g.a[2],L2=ex*ex+ez*ez||1,u=Math.max(0,Math.min(1,((p[0]-g.a[0])*ex+(p[2]-g.a[2])*ez)/L2)),q=[g.a[0]+ex*u,g.a[1]+(g.b[1]-g.a[1])*u,g.a[2]+ez*u],d=Math.hypot(p[0]-q[0],p[2]-q[2]);
        if(d>.05&&d<3&&Math.abs(q[1]-p[1])<1.5&&(!best||d<best.d))best={d,q,qt:[q[0],g.at[1]+(g.bt[1]-g.at[1])*u,q[2]]};}
      if(best){ajout.push({path:s.path,a:p.slice(),b:best.q,at:pt.slice(),bt:best.qt,world:[p.slice(),best.q,pt.slice(),best.qt],closure:'fente'});W.fentesFermees.push({x:+p[0].toFixed(1),z:+p[2].toFixed(1),largeur:+best.d.toFixed(2)});}}}
    segments.push(...ajout);
    // face visible du raccord (deux faces, matériau des murs) : le contrôleur refuse un mur physique invisible
    if(ajout.length){let mat=null;W.scene.traverse(o=>{if(!mat&&o.isMesh&&W.roles.get(o.material)==='wall')mat=o.material;});const P=[];
      for(const c of ajout){const [a,b,at,bt]=c.world;P.push(...a,...b,...at,...b,...bt,...at,...a,...at,...b,...b,...at,...bt);}
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.computeVertexNormals();if(mat){const m=new T.Mesh(g,mat);m.name='Raccord de fente';W.scene.add(m);}}
  }
  function sweepBarrier(s,x,z,dx,dz,y,r=1.3,height=2.2){
    const ex=s.b[0]-s.a[0],ez=s.b[2]-s.a[2],len=Math.hypot(ex,ez);if(len<1e-7)return null;
    const tx=ex/len,tz=ez/len,nx=-tz,nz=tx,px=x-s.a[0],pz=z-s.a[2],along=px*tx+pz*tz,dist=px*nx+pz*nz;
    let result=null;
    const candidate=(time,cx,cz,u,depth=0)=>{
      if(time<0||time>1||result&&time>=result.time)return;
      const bottom=s.a[1]+(s.b[1]-s.a[1])*u,top=s.at[1]+(s.bt[1]-s.at[1])*u;
      if(y>top+(height>0?.08:1e-7)||y+height<bottom)return;
      if(dx*cx+dz*cz>=-1e-9)return;
      result={time,nx:cx,nz:cz,depth,segment:s};
    };
    const u=clamp(along/len,0,1),qx=px-ex*u,qz=pz-ez*u,ql=Math.hypot(qx,qz);
    if(ql<r&&ql>1e-7)candidate(0,qx/ql,qz/ql,u,r-ql);
    const speed=dx*nx+dz*nz;
    if(ql<1e-7&&r>0){const sign=speed>0?-1:1;candidate(0,nx*sign,nz*sign,u,r);}
    if(Math.abs(speed)>1e-10)for(const sign of [-1,1]){
      const t=(sign*r-dist)/speed,v=along+(dx*tx+dz*tz)*t;
      if(v>=-1e-6&&v<=len+1e-6)candidate(t,nx*sign,nz*sign,clamp(v/len,0,1));
    }
    const aa=dx*dx+dz*dz;
    if(aa>1e-12&&r>0)for(const end of [0,1]){
      const rx=px-ex*end,rz=pz-ez*end,bb=rx*dx+rz*dz,cc=rx*rx+rz*rz-r*r,disc=bb*bb-aa*cc;
      if(disc<0)continue;const t=(-bb-Math.sqrt(disc))/aa;
      candidate(t,(rx+dx*t)/r,(rz+dz*t)/r,end);
    }
    return result;
  }
  function moveBarriers(index,x,z,dx,dz,y,r=1.3,height=2.2){
    const contacts=[];
    for(let iteration=0;iteration<5;iteration++){
      let hit=null;for(const s of index.query(x,z,dx,dz,r)){const h=sweepBarrier(s,x,z,dx,dz,y,r,height);if(h&&(!hit||h.time<hit.time))hit=h;}
      if(!hit){x+=dx;z+=dz;break;}
      x+=dx*hit.time+hit.nx*(hit.depth+.001);z+=dz*hit.time+hit.nz*(hit.depth+.001);
      dx*=1-hit.time;dz*=1-hit.time;const inward=Math.min(0,dx*hit.nx+dz*hit.nz);dx-=inward*hit.nx;dz-=inward*hit.nz;contacts.push(hit);
      if(dx*dx+dz*dz<1e-12)break;
    }
    return {x,z,contacts};
  }
  function colliders(W,openSide){
    const group=new T.Group();group.name='Volumes de collision — production';const paths=[];
    for(const P of [W.S,...W.branches]){
      const pos=[],idx=[],walls=[],wi=[],rows=P.closed===false?P.N-1:P.N;
      for(let i=0;i<=rows;i++)for(const side of [-1,1])pos.push(...point(P,i%P.N,side*(P.hw||W.hw),.1).toArray());
      for(let i=0;i<rows;i++){
        const n=(i+1)%P.N;if(P.glide&&P.glide[i]&&P.glide[n])continue;
        const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);
        for(const side of [-1,1]){
          const open=(P.nowall && (P.nowall[i]&(side<0?1:2))) || (P.def&&P.def.open) || openSide(P,i)===side || openSide(P,n)===side;
          if(open)continue;
          const d=(P.wallD||W.wallD)*side,j=walls.length/3;
          for(const [k,h] of [[i,0],[i,2.6],[n,0],[n,2.6]])walls.push(...point(P,k,d,h).toArray());
          wi.push(j,j+1,j+2,j+1,j+3,j+2);
        }
      }
      const make=(p,ix,color)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();const m=new T.Mesh(g,new T.MeshBasicMaterial({color,side:T.DoubleSide,wireframe:true}));group.add(m);return m;};
      const floor=make(pos,idx,'#38dfb3');
      if(P.heightAt){floor.geometry.dispose();floor.geometry=branchMesh(P);}
      if(W.barriers){
        walls.length=0;wi.length=0;
        for(const s of W.barriers.segments.filter(s=>s.path===P.id)){const j=walls.length/3;for(const p of s.world)walls.push(...p);wi.push(j,j+2,j+1,j+2,j+3,j+1);}
      }
      paths.push({path:P.id,floor,walls:make(walls,wi,'#ffad56')});
    }
    // Hors de la scène rendue : maillage d'audit séparé, aucune fausse prétention de moteur rigide.
    W.productionCollision={group,paths,dispose(){group.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});}};
    return W.productionCollision;
  }
  function progress(k,P,i,W){
    const data=W.def.production;if(!data)return;
    const fraction=P===W.S?i/W.S.N:(P.i0+(P.i1-P.i0)*i/(P.N-1))/W.S.N;
    if(!k.routeProgress || k.routeProgress.lap!==k.lap)k.routeProgress={lap:k.lap,last:fraction,next:1,missed:false};
    const r=k.routeProgress,cp=data.checkpoints,delta=fraction-r.last;
    // Un grand saut logique ne valide pas des checkpoints : le respawn n'en gagne aucun.
    if(delta>0&&delta<.04&&r.next<cp.length&&r.last<=cp[r.next].at&&fraction>=cp[r.next].at)r.next++;
    if(delta>.04)r.missed=true;r.last=fraction;
  }
  function canFinish(k,W){return !W.def.production || !!(k.routeProgress&&k.routeProgress.next===W.def.production.checkpoints.length&&!k.routeProgress.missed);}
  function joinBranch(points,A,B,forwardA,forwardB){
    const count=Math.min(18,Math.floor(points.length/4));
    for(let i=0;i<count;i++){
      const blend=i<3?0:Math.pow((i-2)/(count-3),2)*(3-2*(i-2)/(count-3));
      const da=points[i].distanceTo(A),db=points[points.length-1-i].distanceTo(B);
      points[i].lerp(A.clone().addScaledVector(forwardA,da),1-blend);
      points[points.length-1-i].lerp(B.clone().addScaledVector(forwardB,-db),1-blend);
    }
  }
  return {definition,install,frames,applyFrames,point,colliders,progress,canFinish,joinBranch,installJunctions,openMerge,branchMesh,deckNeeded,deckGeometry,barrierStrip,barrierIndex,installBarriers,sweepBarrier,moveBarriers,terrainNormals,lowerTerrain};
});
