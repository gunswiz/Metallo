/* Interior inspection camera. Coordinates use the same .24 scale as the structure. */
(() => {
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const presets={
    inside:{label:'Percorrer o interior',position:[3,.432,-10.5],heading:-.16,pitch:.12},
    'inside-joints':{label:'Ligações dos pilares',position:[.85,2.38,-1],heading:-.70,pitch:.28},
    'inside-roof':{label:'Cobertura por dentro',position:[2.7,2.45,-5],heading:-.8,pitch:.63},
    'inside-bases':{label:'Bases e chumbadores',position:[.6,.27,-.65],heading:-.74,pitch:-.36}
  };
  window.createMetalloInteriorCamera=model=>{
    let position,heading,pitch;
    const near=.018,far=80;
    function reset(name='inside'){
      const p=presets[name]||presets.inside;
      position=[...p.position];heading=p.heading;pitch=p.pitch;
    }
    function basis(){
      const sh=Math.sin(heading),ch=Math.cos(heading),sp=Math.sin(pitch),cp=Math.cos(pitch);
      return {right:[ch,0,-sh],up:[-sh*sp,cp,-ch*sp],forward:[sh*cp,sp,ch*cp]};
    }
    function height(metres){
      position[1]=clamp(metres*.24,.25,3.18-Math.abs(position[0])/6*.22-.22);
    }
    function blocked(x,z){
      return model.bays.some(b=>Math.hypot(x,z-b)<.14);
    }
    function move(forward,sideways=0){
      const sh=Math.sin(heading),ch=Math.cos(heading);
      const dx=sh*forward+ch*sideways,dz=ch*forward-sh*sideways;
      const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.06));
      for(let i=0;i<steps;i++){
        const x=clamp(position[0]+dx/steps,-model.bounds.x+.3,model.bounds.x-.3);
        if(!blocked(x,position[2]))position[0]=x;
        const z=clamp(position[2]+dz/steps,-model.bounds.z+.3,model.bounds.z-.3);
        if(!blocked(position[0],z))position[2]=z;
      }
      height(position[1]/.24);
    }
    function look(horizontal,vertical){
      heading=(heading+horizontal)%(2*Math.PI);pitch=clamp(pitch+vertical,-1.35,1.35);
    }
    function matrix(width,height,zoom=1){
      const {right,up,forward}=basis(),f=zoom/Math.tan(Math.PI*66/360),fx=f/(width/height);
      const a=(far+near)/(far-near),b=-2*far*near/(far-near);
      return new Float32Array([
        right[0]*fx,up[0]*f,forward[0]*a,forward[0],
        right[1]*fx,up[1]*f,forward[1]*a,forward[1],
        right[2]*fx,up[2]*f,forward[2]*a,forward[2],
        -dot(right,position)*fx,-dot(up,position)*f,b-dot(forward,position)*a,-dot(forward,position)
      ]);
    }
    // Near-plane clipping also keeps the Canvas fallback finite when walking past a face.
    function project(vertices,width,height,zoom=1){
      const {right,up,forward}=basis(),f=height*.5*zoom/Math.tan(Math.PI*66/360);
      let points=vertices.map(v=>{const rel=v.map((n,i)=>n-position[i]);return [dot(rel,right),dot(rel,up),dot(rel,forward)]});
      const intersect=(a,b)=>{const t=(near-a[2])/(b[2]-a[2]);return a.map((v,i)=>v+(b[i]-v)*t)};
      if(points.length===2){
        const [a,b]=points;
        if(a[2]<near&&b[2]<near)return [];
        if(a[2]<near)points[0]=intersect(a,b);else if(b[2]<near)points[1]=intersect(b,a);
      }else{
        const clipped=[];
        for(let i=0;i<points.length;i++){
          const a=points[i],b=points[(i+1)%points.length],ain=a[2]>=near,bin=b[2]>=near;
          if(ain)clipped.push(a);if(ain!==bin)clipped.push(intersect(a,b));
        }
        points=clipped;
      }
      return points.map(([x,y,z])=>[width*.5+x*f/z,height*.5-y*f/z,z]);
    }
    reset();
    return {presets,reset,move,look,height,matrix,project,snapshot:()=>({position:[...position],heading,pitch,near,far})};
  };
})();