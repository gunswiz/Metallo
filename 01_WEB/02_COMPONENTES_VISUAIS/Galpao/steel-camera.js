/* Shared perspective camera for interior walking and unrestricted inspection. */
(() => {
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const presets={
    inside:{label:'Percorrer o interior',position:[3,.432,-10.5],heading:-.16,pitch:.12},
    'inside-joints':{label:'Ligações dos pilares',position:[.85,2.38,-1],heading:-.70,pitch:.28},
    'inside-roof':{label:'Cobertura por dentro',position:[2.7,2.45,-5],heading:-.8,pitch:.63},
    'inside-bases':{label:'Bases soldadas · 3 passes',position:[.28,.26,-.30],heading:-.75,pitch:-.54}
  };
  window.createMetalloInteriorCamera=(model,{free=false}={})=>{
    let position,heading,pitch;
    const near=free?.008:.018,far=free?320:80;
    function reset(name='inside'){
      const p=presets[name]||presets.inside;
      position=[...p.position];heading=p.heading;pitch=p.pitch;
    }
    function basis(){
      const sh=Math.sin(heading),ch=Math.cos(heading),sp=Math.sin(pitch),cp=Math.cos(pitch);
      return {right:[ch,0,-sh],up:[-sh*sp,cp,-ch*sp],forward:[sh*cp,sp,ch*cp]};
    }
    function height(metres){
      position[1]=free?clamp(metres*.24,.025,40):clamp(metres*.24,.25,3.18-Math.abs(position[0])/6*.22-.22);
    }
    function blocked(x,z){
      return model.bays.some(b=>Math.hypot(x,z-b)<.14);
    }
    function constrainFree(){
      position[0]=clamp(position[0],-model.bounds.x-60,model.bounds.x+60);
      position[2]=clamp(position[2],-model.bounds.z-60,model.bounds.z+60);
      height(position[1]/.24);
    }
    function move(forward,sideways=0,vertical=0){
      if(free){
        const axes=basis();
        position=position.map((v,i)=>v+axes.forward[i]*forward+axes.right[i]*sideways+(i===1?vertical:0));
        constrainFree();return;
      }
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
      heading=(heading+horizontal)%(2*Math.PI);pitch=clamp(pitch+vertical,free?-1.55:-1.35,free?1.55:1.35);
    }
    function pan(sideways,vertical){
      if(!free)return;
      const {right,up}=basis();
      position=position.map((v,i)=>v+right[i]*sideways+up[i]*vertical);constrainFree();
    }
    function setPose(pose){position=[...pose.position];heading=pose.heading;pitch=pose.pitch}
    function frame(bounds,yaw,tilt,aspect=1,zoom=1){
      heading=-yaw;pitch=-tilt;
      const center=[bounds.x,bounds.y,bounds.z].map(([a,b])=>(a+b)/2),axes=basis(),f=1/Math.tan(Math.PI*66/360);
      let distance=.1;
      for(const x of bounds.x)for(const y of bounds.y)for(const z of bounds.z){
        const rel=[x,y,z].map((v,i)=>v-center[i]),depth=dot(rel,axes.forward);
        distance=Math.max(distance,Math.abs(dot(rel,axes.right))*f/aspect-depth,Math.abs(dot(rel,axes.up))*f-depth);
      }
      position=center.map((v,i)=>v-axes.forward[i]*(distance*1.12+.1)/zoom);
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
    return {presets,reset,move,look,height,pan,setPose,frame,matrix,project,snapshot:()=>({position:[...position],heading,pitch,near,far})};
  };
})();
