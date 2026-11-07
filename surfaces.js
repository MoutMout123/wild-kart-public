/* Matériaux PBR partagés : cartes CC0 locales, métrique constante et projection sur les falaises.
   Garde-fous de normales (Claude 2, ticket #27, surfaces noires sur Mali) : normale nulle ou non finie → normale géométrique. */
(function(root){
  'use strict';
  const T=root.THREE,cache=new Map(),pending=[],errors=[];
  let mobile=false,anisotropy=4;
  function configure(low,maxAnisotropy){mobile=low;anisotropy=Math.min(8,maxAnisotropy||4);}
  function texture(id,role){
    const profile=mobile?'mobile':'pc',key=id+':'+role+':'+profile;if(cache.has(key))return cache.get(key);
    const url='assets/materials/'+profile+'/'+id+'-'+role+'.webp';
    let done;const task=new Promise(resolve=>done=resolve);pending.push(task);
    const tex=new T.TextureLoader().load(url,()=>done(),undefined,()=>{errors.push(url);done();});
    tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.minFilter=T.LinearMipmapLinearFilter;tex.magFilter=T.LinearFilter;tex.anisotropy=anisotropy;
    tex.colorSpace=role==='albedo'?T.SRGBColorSpace:T.NoColorSpace;tex.userData.wkShared=true;tex.name=key;cache.set(key,tex);return tex;
  }
  const noise=`
    float wkN(vec3 p){return sin(p.x*.63+sin(p.z*.71))*sin(p.z*.47+p.y*.53);}
    vec2 wkOffset(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
    vec4 wkSample(sampler2D tex,vec2 p){
      vec2 cell=floor(p*.37),f=fract(p*.37);f=f*f*(3.0-2.0*f);
      vec4 a=texture2D(tex,p+wkOffset(cell)),b=texture2D(tex,p+wkOffset(cell+vec2(1,0)));
      vec4 c=texture2D(tex,p+wkOffset(cell+vec2(0,1))),d=texture2D(tex,p+wkOffset(cell+vec2(1,1)));
      return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
    }
  `;
  function make(kind,color='#ffffff',world=false){
    const id=kind==='asphalt'?'clean_asphalt':'sandstone_cracks';
    const m=new T.MeshStandardMaterial({color,map:texture(id,'albedo'),normalMap:texture(id,'normal'),roughnessMap:texture(id,'roughness'),roughness:1,metalness:0,envMapIntensity:.2});
    m.normalScale.set(.55,.55);m.userData.wkProduction=true;m.userData.wkSurface=kind;m.userData.wkWorldMapped=world;m.userData.wkPBR=true;
    m.onBeforeCompile=shader=>{
      shader.vertexShader=`varying vec3 wkWorld; varying vec3 wkNWorld; varying vec2 wkUV; varying vec2 wkPaint;
        ${world?'':'attribute vec2 wkSurfaceUv; attribute float wkPaintWeight; varying float wkPaintAlpha;'}
      `+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <defaultnormal_vertex>',`#include <defaultnormal_vertex>
        wkNWorld=inverseTransformDirection(transformedNormal,viewMatrix);`);
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        vec4 wkPos=vec4(transformed,1.0);
        #ifdef USE_INSTANCING
        wkPos=instanceMatrix*wkPos;
        #endif
        wkWorld=(modelMatrix*wkPos).xyz;
        wkPaint=uv;wkUV=${world?'uv':'wkSurfaceUv'};${world?'':'wkPaintAlpha=wkPaintWeight;'}`);
      shader.fragmentShader=`varying vec3 wkWorld; varying vec3 wkNWorld; varying vec2 wkUV; varying vec2 wkPaint;
        ${world?'':'varying float wkPaintAlpha;'}
        ${noise}
        ${world?`vec3 wkNw(){return dot(wkNWorld,wkNWorld)>1e-12?normalize(wkNWorld):vec3(0.0,1.0,0.0);}
        vec3 wkWeights(){vec3 w=pow(abs(wkNw()),vec3(4.0));return w/max(w.x+w.y+w.z,1e-6);}
        vec4 wkTri(sampler2D tex){vec3 w=wkWeights();vec3 p=wkWorld*.16;
          return texture2D(tex,p.zy)*w.x+texture2D(tex,p.xz)*w.y+texture2D(tex,p.xy)*w.z;}`:''}
      `+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',world?(kind==='asphalt'?`
        vec3 asphalt=wkTri(map).rgb;
        diffuseColor.rgb*=asphalt*(.88+.06*wkN(wkWorld*.04));
      `:`
        vec3 stone=wkTri(map).rgb;
        float macro=1.0+.065*wkN(wkWorld*.023)+.035*wkN(wkWorld*.081);
        float strata=sin(wkWorld.y*.72+wkN(wkWorld*.035)*1.4);
        diffuseColor.rgb*=stone*1.45*macro*(1.0+strata*.035);
      `):`
        vec3 asphalt=wkSample(map,wkUV).rgb;
        diffuseColor.rgb*=asphalt*(.88+.06*wkN(wkWorld*.04));
        float edge=max(1.0-smoothstep(.006,.012,abs(wkPaint.x-.038)),1.0-smoothstep(.006,.012,abs(wkPaint.x-.962)));
        float center=(1.0-smoothstep(.004,.007,abs(wkPaint.x-.5)))*(1.0-step(.36,fract(wkPaint.y)));
        float paint=max(edge,center)*(.9+.1*asphalt.r)*wkPaintAlpha;
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.83,.85,.82),paint);
      `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',world?'float roughnessFactor=roughness*clamp(wkTri(roughnessMap).g,.65,1.0);':'float roughnessFactor=roughness*clamp(wkSample(roughnessMap,wkUV).g,.65,1.0);');
      const normals=world?`
        vec3 w=wkWeights(),p=wkWorld*.16,baseN=wkNw();
        vec3 nx=texture2D(normalMap,p.zy).xyz*2.0-1.0,ny=texture2D(normalMap,p.xz).xyz*2.0-1.0,nz=texture2D(normalMap,p.xy).xyz*2.0-1.0;
        nx.xy*=.48;ny.xy*=.48;nz.xy*=.48;
        vec3 mapped=vec3(nx.z*sign(baseN.x),nx.y,nx.x)*w.x+vec3(ny.x,ny.z*sign(baseN.y),ny.y)*w.y+vec3(nz.x,nz.y,nz.z*sign(baseN.z))*w.z;
        if(dot(mapped,mapped)>1e-12){vec3 wkM=mix(normal,normalize(mat3(viewMatrix)*mapped)*faceDirection,.6);if(dot(wkM,wkM)>1e-12)normal=normalize(wkM);}
      `:`vec3 mapN=wkSample(normalMap,wkUV).xyz*2.0-1.0;mapN.xy*=normalScale;{vec3 wkNm=tbn*mapN;float wkL=dot(wkNm,wkNm);normal=(wkL>1e-12&&wkL<1e12)?normalize(wkNm):normal;}`;
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`\n#ifdef USE_NORMALMAP_TANGENTSPACE\n${normals}\n#endif\n`);
    };
    m.customProgramCacheKey=()=>world?'wk-pbr-triplanar-r158-v3-'+kind:'wk-pbr-road-r158-v3';return m;
  }
  root.WKSurfaces={configure,make,ready:()=>Promise.all(pending),errors,stats:()=>({textures:cache.size,bytesEstimate:[...cache.values()].reduce((n,t)=>n+(t.image?.width||0)*(t.image?.height||0)*4*4/3,0)})};
})(window);
