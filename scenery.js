/* Assets originaux Wild Kart : formes modelées, semis déterministe, matériaux monde. */
(function(root){
  'use strict';
  const T=root.THREE,TAU=Math.PI*2,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function random(seed){return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
  function material(color,rock=false){
    if(rock&&root.WKSurfaces)return root.WKSurfaces.make('sandstone',color,true);
    const m=new T.MeshStandardMaterial({color,roughness:.91,metalness:0});m.userData.wkProduction=true;
    if(!rock)return m;
    m.onBeforeCompile=shader=>{
      shader.vertexShader='varying vec3 wkWorld;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        vec4 wkP=vec4(transformed,1.0);
        #ifdef USE_INSTANCING
        wkP=instanceMatrix*wkP;
        #endif
        wkWorld=(modelMatrix*wkP).xyz;`);
      shader.fragmentShader=`varying vec3 wkWorld;
        float wkHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
        float wkNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
          return mix(mix(mix(wkHash(i),wkHash(i+vec3(1,0,0)),f.x),mix(wkHash(i+vec3(0,1,0)),wkHash(i+vec3(1,1,0)),f.x),f.y),
                     mix(mix(wkHash(i+vec3(0,0,1)),wkHash(i+vec3(1,0,1)),f.x),mix(wkHash(i+vec3(0,1,1)),wkHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      `+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float macro=wkNoise(wkWorld*.012)+.4*wkNoise(wkWorld*.041);
        float grain=wkNoise(wkWorld*.7);
        float strata=smoothstep(.35,.65,sin(wkWorld.y*.65+wkNoise(wkWorld*.04)*1.6)*.5+.5);
        diffuseColor.rgb*=.77+macro*.22+grain*.1;
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.09,.90,.74),strata*.22);
      `);
    };
    m.customProgramCacheKey=()=> 'wk-world-rock-v1';return m;
  }
  function groundMaterial(){
    const m=material('#d2b08b',true);m.vertexColors=true;return m;
  }
  function merge(parts){
    const p=[],n=[],c=[],uv=[];
    for(const {g,matrix,color} of parts){g.applyMatrix4(matrix||new T.Matrix4());const flat=g.index?g.toNonIndexed():g,co=new T.Color(color||'#ffffff');
      for(let i=0;i<flat.attributes.position.count;i++){p.push(flat.attributes.position.getX(i),flat.attributes.position.getY(i),flat.attributes.position.getZ(i));n.push(flat.attributes.normal.getX(i),flat.attributes.normal.getY(i),flat.attributes.normal.getZ(i));c.push(co.r,co.g,co.b);uv.push(0,0);}if(flat!==g)flat.dispose();g.dispose();}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('normal',new T.Float32BufferAttribute(n,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));return g;
  }
  function matrix(x,y,z,sx=1,sy=sx,sz=sx,angle=0){return new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),angle),new T.Vector3(sx,sy,sz));}
  function branch(a,b,r,color){const A=new T.Vector3(...a),B=new T.Vector3(...b),d=B.clone().sub(A),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.clone().normalize());return{g:new T.CylinderGeometry(r*.62,r,d.length(),7),matrix:new T.Matrix4().compose(A.add(B).multiplyScalar(.5),q,new T.Vector3(1,1,1)),color};}
  function tree(variant=0,coarse=false){
    const pieces=[branch([0,0,0],[.2,4.5,0],.46,'#67442c'),branch([.2,3,0],[-2.2,6,.5],.23,'#805938'),branch([.2,3.4,0],[2.8,5.8,-.6],.22,'#805938'),branch([0,4,0],[.6,7.2,1.5],.19,'#805938')];
    const rng=random(81+variant*31);
    const crowns=coarse?7:12;
    for(let i=0;i<crowns;i++){const a=i/crowns*TAU,r=1+rng()*1.9,x=Math.cos(a)*r,z=Math.sin(a)*r,y=5.8+rng()*1.2;pieces.push({g:coarse?new T.IcosahedronGeometry(1,0):new T.DodecahedronGeometry(1,0),matrix:matrix(x,y,z,1.9+rng(),.6+rng()*.45,1.6+rng(),rng()*TAU),color:['#526f35','#73964c','#8da953','#42623a'][i%4]});}
    return merge(pieces);
  }
  function cactus(){return merge([branch([0,0,0],[0,4.6,0],.42,'#4e775b'),branch([0,2,0],[1.3,2.2,0],.25,'#628c5d'),branch([1.3,2.2,0],[1.3,3.9,0],.24,'#628c5d'),branch([0,2.7,0],[-1.1,2.9,0],.24,'#446f51'),branch([-1.1,2.9,0],[-1.1,4.4,0],.22,'#446f51')]);}
  function yucca(){const parts=[];for(let i=0;i<13;i++){const g=new T.ConeGeometry(.22,2.5,3);g.translate(0,1,0);g.rotateZ(.55+(i%3)*.16);g.rotateY(i/13*TAU);parts.push({g,color:i%2?'#7d8d46':'#adb16a'});}return merge(parts);}
  // Profils sculptés en anneaux, faces cassées et corniches : pas de sphères déformées.
  function formation(variant=0,coarse=false){
    const rings=coarse?6:16,sides=coarse?10:28,p=[],uv=[],idx=[],colors=[],rng=random(193+variant*919),radii=Array.from({length:sides},()=>.80+rng()*.32),family=variant===2?'table':variant===4?'spire':'butte';
    const palette=['#985738','#bd7547','#d0925b','#e0ad76','#c08859'].map(c=>new T.Color(c));
    for(let j=0;j<=rings;j++){
      const y=j/rings,profile=family==='table'?1-.16*y+.05*Math.sin(y*15+variant):family==='spire'?1-Math.pow(y,.65)*.69+.035*Math.sin(y*18):1-Math.pow(y,.48)*.4+.035*Math.sin(y*24+variant)+.09*(1-y)**3,bend=Math.sin(y*3+variant)*.07;
      for(let i=0;i<=sides;i++){const k=i%sides,a=k/sides*TAU,r=profile*radii[k]*(1+.035*Math.sin(j*.9+k*1.7)),top=j===rings?.025*Math.sin(k*.8+variant):0;
        p.push(Math.cos(a)*r+bend,j===0?-.22:y+top,Math.sin(a)*r);uv.push(i/sides*4,y*4);const c=palette[1].clone().lerp(palette[3],y*.52+.08*Math.sin(y*26+variant));colors.push(c.r,c.g,c.b);
        if(j<rings&&i<sides){const q=j*(sides+1)+i;idx.push(q,q+sides+1,q+1,q+1,q+sides+1,q+sides+2);}}
    }
    const center=p.length/3;p.push(0,1,0);uv.push(.5,.5);colors.push(...palette[3].toArray());for(let i=0;i<sides;i++)idx.push(center,rings*(sides+1)+i+1,rings*(sides+1)+i);
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(idx);g.computeVertexNormals();
    for(let j=0;j<=rings;j++){const a=j*(sides+1),b=a+sides,n=g.attributes.normal,v=new T.Vector3().fromBufferAttribute(n,a).add(new T.Vector3().fromBufferAttribute(n,b)).normalize();n.setXYZ(a,v.x,v.y,v.z);n.setXYZ(b,v.x,v.y,v.z);}
    return g;
  }
  function build(W,quality){
    const art=W.def.production.art,rng=random(art.scatter.seed),group=new T.Group();group.name='Canyon des vents — production';W.scene.add(group);
    const mats={stone:material('#ffffff',true),plants:material('#ffffff'),wood:material('#7d4a2c'),metal:material('#326e75'),cream:material('#ead4a0')};mats.stone.vertexColors=mats.plants.vertexColors=true;
    const state={group,placements:[],batches:[],landmarks:[],stats:{trees:0,rocks:0,plants:0,formations:0},quality};W.productionScenery=state;
    const low=quality==='low',geometries={tree0:tree(0,low),tree1:tree(1,low),cactus:cactus(),yucca:yucca(),rock0:formation(0,true),rock1:formation(3,true),mesa0:formation(1,low),mesa1:formation(2,low),mesa2:formation(4,low)};
    // Recherche exacte en projection sur chaque segment, y compris les branches et la route déformée.
    const paths=[W.S,...W.branches].map(P=>({P,points:Array.from({length:P.N},(_,i)=>root.WKProduction.point(P,i))}));
    function clear(x,z,r){for(const {P,points} of paths)for(let i=0;i<points.length-1;i+=2){const a=points[i],b=points[Math.min(i+2,points.length-1)],dx=b.x-a.x,dz=b.z-a.z,t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);if(Math.hypot(x-a.x-t*dx,z-a.z-t*dz)<(P.wallD||W.wallD)+r+7)return false;}return true;}
    const batches=new Map();
    function add(asset,x,z,sx,sy= sx,sz=sx,angle=0,kind='detail',base){
      const radius=Math.max(sx,sz)*(asset.startsWith('tree')?3.4:asset==='cactus'?1.5:asset==='yucca'?1.5:1.15);
      if(!clear(x,z,radius))return false;
      const h=base??(W.hAt?W.hAt(x,z):0),slope=W.hAt?Math.hypot(W.hAt(x+1,z)-h,W.hAt(x,z+1)-h):0;
      if(kind==='detail'&&slope>.65)return false;
      if(kind==='detail'&&state.placements.some(p=>p.kind==='detail'&&Math.hypot(x-p.x,z-p.z)<Math.min(5,(radius+p.radius)*.65)))return false;
      const entry={asset,x,y:h-.12,z,sx,sy,sz,angle,radius,kind,slope};state.placements.push(entry);
      if(!batches.has(asset))batches.set(asset,[]);batches.get(asset).push(entry);
      if(asset.startsWith('tree'))state.stats.trees++;else if(asset.startsWith('mesa'))state.stats.formations++;else if(asset.startsWith('rock'))state.stats.rocks++;else state.stats.plants++;
      return true;
    }
    // Les points structurants sont explicitement définis dans le fichier du circuit.
    for(const spec of art.landmarks){
      if(spec.kind==='mesa') {const ok=add('mesa'+(spec.variant||0),spec.x,spec.z,spec.radius,spec.height,spec.radius*(spec.aspect||.75),spec.rotation||0,'landmark');state.landmarks.push({...spec,placed:ok});}
    }
    // Horizon irrégulier fermé derrière la zone jouable ; trois familles de silhouettes.
    for(let i=0;i<38;i++){const a=i/38*TAU,d=W.bb.ext+400+rng()*160,family=i%3,r=family===1?140+rng()*90:75+rng()*65,height=family===1?65+rng()*55:95+rng()*175;add('mesa'+family,W.bb.cx+Math.cos(a)*d,W.bb.cz+Math.sin(a)*d,r,height,r*(family===2?.45:.6+rng()*.5),rng()*TAU,'horizon',-35);}
    const S=W.S;
    for(let i=0;i<1700;i++){
      const fraction=rng(),j=Math.floor(fraction*S.N),side=rng()<.5?-1:1,offset=side*(W.wallD+10+Math.pow(rng(),1.9)*120),x=S.px[j]+S.rx[j]*offset,z=S.pz[j]+S.rz[j]*offset;
      const zone=art.zones.find(z=>fraction>=z.from&&fraction<z.to)||art.zones[0],oasis=zone&&zone.palette==='oasis',roll=rng();
      let asset,scale;
      if(roll<(oasis?.3:.075)){asset='tree'+(i%2);scale=.8+rng()*1.2;}
      else if(roll<.45){asset=i%3?'rock0':'rock1';scale=.5+rng()*3;}
      else {asset=i%4?'yucca':'cactus';scale=.45+rng()*.9;}
      add(asset,x,z,scale,asset.startsWith('rock')?scale*(.35+rng()*.6):scale,scale,rng()*TAU);
    }
    for(const [asset,list] of batches){
      const mesh=new T.InstancedMesh(geometries[asset],asset.startsWith('rock')||asset.startsWith('mesa')?mats.stone:mats.plants,list.length);
      const matrices=list.map(p=>matrix(p.x,p.y,p.z,p.sx,p.sy,p.sz,p.angle));matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.computeBoundingSphere();mesh.geometry.computeBoundingSphere();
      const spheres=matrices.map(m=>mesh.geometry.boundingSphere.clone().applyMatrix4(m));
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.name=asset;mesh.receiveShadow=true;mesh.castShadow=asset.startsWith('tree');mesh.userData.wkProduction=true;mesh.userData.wkSourceMatrices=matrices;group.add(mesh);state.batches.push({mesh,full:list.length,asset,matrices,spheres,visibleIds:null});
    }
    // Ouvrage spectaculaire : trois éoliennes à voile au sommet des mesas, signe distinctif original.
    for(const spec of art.landmarks.filter(x=>x.kind==='windmill')){
      if(!clear(spec.x,spec.z,9)){state.landmarks.push({...spec,placed:false});continue;}
      const g=new T.Group(),base=W.hAt(spec.x,spec.z),tower=new T.Mesh(new T.CylinderGeometry(1.7,3.6,spec.height,10),mats.cream);tower.position.y=spec.height/2;g.add(tower);
      const rotor=new T.Group();rotor.position.set(0,spec.height,2.6);g.add(rotor);
      const sail=merge(Array.from({length:4},(_,i)=>{const geo=new T.BoxGeometry(2,13,.22);geo.translate(1,7,0);geo.rotateZ(i/4*TAU);return{g:geo,color:i%2?'#2f7b81':'#e0ad51'};}));const sailMat=material('#ffffff');sailMat.vertexColors=true;rotor.add(new T.Mesh(sail,sailMat));g.position.set(spec.x,base,spec.z);g.rotation.y=spec.rotation||0;group.add(g);(W.tick||(W.tick=[])).push((dt)=>{rotor.rotation.z+=dt*.17;});state.landmarks.push({...spec,placed:true});
    }
    // Colonnes et contreforts sous les tabliers, ancrés au terrain ; jamais dans une autre voie.
    const supports=[];
    for(const P of [S,...W.branches])for(let i=8;i<P.N-8;i+=24){if(P.glide&&P.glide[i]||P.wz&&P.wz[i])continue;const x=P.px[i],z=P.pz[i],top=root.WKProduction.point(P,i).y-1.4,bottom=W.hAt(x,z);if(top-bottom<5)continue;
      // Pas de pilier indépendant aux bouches partagées : sa tête risque
      // de traverser la chaussée raccordée de l'autre voie.
      if(P.heightAt&&(i<=P.noseA+28||i>=P.noseB-28))continue;
      // Un pilier à tête plane ne convient pas sous un raccord fortement bombé.
      if(P.heightAt&&[-3,3].some(lat=>Math.abs(root.WKProduction.point(P,i,lat).y-top-1.4)>.6))continue;
      if(P.heightAt&&[-3,3].some(o=>Math.abs(root.WKProduction.point(P,clamp(i+o,0,P.N-1)).y-top-1.4)>2))continue;
      let blocked=false;for(const {P:other,points} of paths)for(let j=0;j<other.N;j+=3)if(Math.abs(points[j].y-top-1.4)>5&&points[j].y>bottom-2&&points[j].y<top+3&&Math.hypot(points[j].x-x,points[j].z-z)<(other.wallD||W.wallD)+4)blocked=true;
      if(!blocked)supports.push(matrix(x,(bottom+top)/2,z,2.3,top-bottom,2.3));}
    if(supports.length){const geo=new T.CylinderGeometry(.65,1,1,8),im=new T.InstancedMesh(geo,mats.wood,supports.length);im.name='Piliers de tablier';supports.forEach((m,i)=>im.setMatrixAt(i,m));im.computeBoundingSphere();group.add(im);}
    // Nuages hauts, larges et translucides ; pas de nappes au sol.
    const cloudMat=new T.MeshLambertMaterial({color:'#fff3df',emissive:'#657f94',emissiveIntensity:.18,transparent:true,opacity:.86,depthWrite:false,fog:true});
    const lobes=[[-.6,0,0,.6,.38,.45],[.1,.15,0,.7,.55,.48],[.7,-.04,0,.55,.35,.38],[-.25,.2,.35,.55,.45,.45],[.45,.25,-.22,.45,.38,.4]];
    const cloudGeo=merge(lobes.slice(0,low?3:5).map(([x,y,z,sx,sy,sz])=>({g:new T.SphereGeometry(1,low?8:12,low?5:8),matrix:matrix(x,y,z,sx,sy,sz)}))),clouds=new T.InstancedMesh(cloudGeo,cloudMat,14);
    for(let i=0;i<14;i++){const a=i/14*TAU;clouds.setMatrixAt(i,matrix(W.bb.cx+Math.cos(a)*850,300+rng()*110,W.bb.cz+Math.sin(a)*700,50+rng()*35,24+rng()*16,30+rng()*15,rng()*.5));}clouds.computeBoundingSphere();group.add(clouds);
    setBudget(W,quality==='low'?0:quality==='high'?2:1);
    const previous=W.scene.onBeforeRender;
    W.scene.onBeforeRender=function(renderer,scene,camera,...rest){previous.call(this,renderer,scene,camera,...rest);cullInstances(W,camera);};
    return state;
  }
  function setBudget(W,budget){
    if(!W.productionScenery)return;
    for(const b of W.productionScenery.batches){const isLand=b.asset.startsWith('mesa'),f=isLand?1:budget===0?.28:budget===1?.8:1;b.budgetCount=Math.ceil(b.full*f);b.mesh.userData.wkBudgetCount=b.budgetCount;b.mesh.count=b.budgetCount;}
  }
  const viewProjection=new T.Matrix4(),viewFrustum=new T.Frustum(),worldSphere=new T.Sphere();
  function cullInstances(W,camera){
    const state=W.productionScenery;if(!state)return;
    viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);viewFrustum.setFromProjectionMatrix(viewProjection);
    let tested=0,visible=0;
    for(const b of state.batches){
      const ids=[];for(let i=0;i<b.budgetCount;i++){
        tested++;worldSphere.copy(b.spheres[i]).applyMatrix4(b.mesh.matrixWorld);
        if(viewFrustum.intersectsSphere(worldSphere))ids.push(i);
      }
      const changed=!b.visibleIds||ids.length!==b.visibleIds.length||ids.some((id,i)=>id!==b.visibleIds[i]);
      if(changed){ids.forEach((id,i)=>b.mesh.setMatrixAt(i,b.matrices[id]));b.mesh.instanceMatrix.needsUpdate=true;b.visibleIds=ids;}
      b.mesh.count=ids.length;visible+=ids.length;
    }
    state.visibility={tested,visible,culled:tested-visible};
  }
  function mergeRoad(W){
    const batches=new Map();W.scene.updateMatrixWorld(true);
    W.scene.traverse(o=>{if(o.isMesh&&W.roles.get(o.material)==='road'&&!o.geometry.attributes.wkPaintWeight)o.geometry.setAttribute('wkPaintWeight',new T.Float32BufferAttribute(new Float32Array(o.geometry.attributes.position.count).fill(1),1));});
    for(const o of W.scene.children){const role=W.roles.get(o.material);if(!o.isMesh||o.isInstancedMesh||o.material.transparent||!['road','curb','wall','shoulder','skirt','mud','rail'].includes(role)||o.geometry.groups.length)continue;
      const key=o.material.uuid+':'+Object.keys(o.geometry.attributes).sort().join(',');if(!batches.has(key))batches.set(key,[]);batches.get(key).push(o);}
    for(const list of batches.values()){
      if(list.length<2)continue;
      const attrs={},indices=[];let offset=0;
      for(const o of list){const g=o.geometry.clone().applyMatrix4(o.matrixWorld);for(const [key,a] of Object.entries(g.attributes)){if(!attrs[key])attrs[key]={values:[],size:a.itemSize};for(const v of a.array)attrs[key].values.push(v);}if(g.index)for(const v of g.index.array)indices.push(v+offset);else for(let i=0;i<g.attributes.position.count;i++)indices.push(i+offset);offset+=g.attributes.position.count;g.dispose();}
      const g=new T.BufferGeometry();for(const [key,a] of Object.entries(attrs))g.setAttribute(key,new T.Float32BufferAttribute(a.values,a.size));g.setIndex(indices);g.computeBoundingSphere();
      const merged=new T.Mesh(g,list[0].material);merged.name='Route fusionnée : '+W.roles.get(merged.material);merged.receiveShadow=true;W.scene.add(merged);
      for(const o of list){W.scene.remove(o);if(!o.geometry.userData.keep)o.geometry.dispose();}
    }
  }
  function buildDecks(W){
    const production=root.WKProduction,mat=root.WKSurfaces.make('asphalt','#ffffff',true);
    W.roles.set(mat,'structure');W.deckSegments=[];
    for(const P of [W.S,...W.branches]){
      const segments=[],count=P.closed===false?P.N-1:P.N;
      for(let i=0;i<count;i++){
        const j=(i+1)%P.N;
        if(P.glide?.[i]||P.glide?.[j])continue;
        if(production.deckNeeded(W,P,i)||production.deckNeeded(W,P,j))segments.push(i);
      }
      if(!segments.length)continue;
      // Petits tronçons pour que le frustum élimine les tabliers hors champ.
      // La route et ses collisions restent continues et indépendantes de ces lots.
      const chunks=[];for(const i of segments){let chunk=chunks[chunks.length-1];if(!chunk||chunk.length>=96||i!==chunk[chunk.length-1]+1){chunk=[];chunks.push(chunk);}chunk.push(i);}
      chunks.forEach((chunk,index)=>{
        const g=production.deckGeometry(P,chunk,(P.wallD||W.wallD)*2,1.4,(P.hw||W.hw)*2),mesh=new T.Mesh(g,mat);
        mesh.name='Tablier fermé '+P.id+'/'+index;mesh.receiveShadow=true;W.scene.add(mesh);
      });
      W.deckSegments.push({path:P.id,segments});
    }
  }
  function updateKartLOD(W,k,camera){
    if(!W.productionScenery)return;
    const M=k.mesh;if(!M.productionLOD){
      const parts=[{g:new T.BoxGeometry(2.4,.8,3.8),matrix:matrix(0,.8,0),color:k.cfg.color},{g:new T.BoxGeometry(1.3,.65,1.2),matrix:matrix(0,1.4,-.25),color:k.cfg.helmet},{g:new T.SphereGeometry(.48,7,5),matrix:matrix(0,1.95,-.25),color:k.cfg.helmet}];
      for(const x of [-1.2,1.2])for(const z of [-1.15,1.15]){const g=new T.CylinderGeometry(.55,.55,.45,8);g.rotateZ(Math.PI/2);parts.push({g,matrix:matrix(x,.55,z),color:'#242838'});}
      const mat=new T.MeshLambertMaterial({vertexColors:true});M.productionLOD=new T.Mesh(merge(parts),mat);M.productionLOD.name='Kart lointain';W.scene.add(M.productionLOD);
    }
    const proxy=M.productionLOD,limit=W.gfx&&W.gfx.budget===0?100:160,visible=M.g.visible,far=M.g.position.distanceToSquared(camera.position)>limit*limit;
    proxy.visible=visible&&far;proxy.position.copy(M.g.position);proxy.quaternion.copy(M.g.quaternion);proxy.scale.copy(M.g.scale);
    if(far)M.g.visible=false;
  }
  root.WKScenery={material,groundMaterial,build,setBudget,cullInstances,formation,tree,cactus,yucca,mergeRoad,buildDecks,updateKartLOD};
})(window);
