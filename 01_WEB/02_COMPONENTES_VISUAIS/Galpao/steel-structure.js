/* Plastamp: geometry inferred from 60 photographs and sampled sequences from 16 videos.
 * Approximate envelope supplied by the owner: 100 x 50 x 14 m.
 * This is a visual reconstruction, not a structural/as-built drawing.
 * Units are metres x .24. Thirteen portal lines form the twelve bays confirmed by the owner;
 * hidden elevations/opening positions remain visual approximations.
 * VID-20250518-WA0204: audio at 05.93–06.73, 10.31–11.81 and
 * 24.76–25.48 gives 4 m, 3.5 m and 3 m for the three accesses.
 * Door positions/types follow the owner's marked screenshot (11 October 2026).
 * Widths and emergency-door sizes remain visual estimates.
 * Internal parapet sheet lining: 20250610_150729 and 20250611_090146.
 * Bracing: alternating side/roof bays; every central bay per owner correction.
 * Local references: 20250224_144117, 20250417_164726, 20250531_160926,
 * 20250605_165701, 20250611_090146, VID-20251022-WA0101.
 */
(() => {
  const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const mul=(a,s)=>a.map(v=>v*s),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const norm=a=>mul(a,1/(Math.hypot(...a)||1));
  window.createMetalloStructure=()=>{
    const parts=[],steel=[204,216,222],edge=[123,151,174],metal=[176,198,215],concrete=[93,110,119],glass=[49,101,127];
    const X=6,Z=12,top=3.36,eave=2.96,ridge=3.18,wall=.77;
    const roof=x=>ridge-Math.abs(x)/X*(ridge-eave);
    const bayCount=12,bays=Array.from({length:bayCount+1},(_,i)=>-Z+i*2*Z/bayCount);
    const bayCenter=i=>(bays[i]+bays[i+1])/2;
    const roofPurlins=Array.from({length:24},(_,i)=>-5.75+i*.5);
    const insetEnd=z=>Math.abs(z)>Z-.001?z-Math.sign(z)*.025:z;
    // Back/west follow the first marked photo; east follows the later purple/yellow lateral photo.
    // Only the three large-access heights are given by the audio/owner.
    const accesses=[
      {id:'p1',wall:'east',center:bayCenter(6),width:.96,height:.96,metres:4,label:'Porta 1 · 4 m',type:'portao',yaw:Math.PI/2},
      {id:'p2',wall:'back',center:-5.2,width:1.2,height:.84,metres:3.5,label:'Porta 2 · 3,5 m',type:'portao',yaw:Math.PI},
      {id:'p3',wall:'west',center:bayCenter(0),width:.96,height:.72,metres:3,label:'Porta 3 · 3 m',type:'portao',yaw:-Math.PI/2},
      {id:'e1',wall:'east',center:bayCenter(5),width:.48,height:.528,type:'emergencia',leaves:2},
      {id:'e2',wall:'west',center:bayCenter(5),width:.48,height:.528,type:'emergencia',leaves:2},
      {id:'e3',wall:'back',center:-.7,width:.48,height:.528,type:'emergencia',leaves:2},
      {id:'e4',wall:'back',center:5.62,width:.288,height:.528,type:'emergencia',leaves:1}
    ].map(o=>({...o,a:o.center-o.width/2,b:o.center+o.width/2,low:0,high:o.height}));
    const onWall=id=>accesses.filter(o=>o.wall===id);
    const wallPoint=(id,u,y,offset=0)=>id==='east'?[X+offset,y,u]:id==='west'?[-X-offset,y,u]:[u,y,(id==='back'?1:-1)*(Z+offset)];
    function intervals(a,b,holes){
      let spans=[[a,b]];
      for(const o of holes)spans=spans.flatMap(([l,r])=>o.b<=l||o.a>=r?[[l,r]]:[[l,Math.max(l,o.a)],[Math.min(r,o.b),r]].filter(([s,t])=>t-s>.0001));
      return spans;
    }
    function girt(id,a,b,y){for(const [l,r] of intervals(a,b,onWall(id).filter(o=>y-.018<o.high)))bar(wallPoint(id,l,y),wallPoint(id,r,y),.017,metal)}
    let active;
    function part(kind,delay,duration=.8,offset=[0,1,0]){active={kind,delay,duration,offset,faces:[]};parts.push(active);return active}
    function face(pts,color=steel,style='metal'){
      const n=pts.length>2?norm(cross(sub(pts[1],pts[0]),sub(pts[2],pts[0]))):[0,1,0];
      active.faces.push({pts,normal:n,color,style});
    }
    function line(a,b,color=edge){face([a,b],color,'line')}
    function extrusion(a,b,profile,color=steel){
      const axis=norm(sub(b,a)),ref=Math.abs(axis[1])>.95?[0,0,1]:[0,1,0];
      const u=norm(cross(axis,ref)),v=cross(axis,u);
      const section=o=>profile.map(([x,y])=>add(o,add(mul(u,x),mul(v,y))));
      const q=section(a),r=section(b);
      for(let i=0;i<q.length;i++){const j=(i+1)%q.length;face([q[i],q[j],r[j],r[i]],color)}
      face([...q].reverse(),color);face(r,color);
    }
    function beam(a,b,s=1,color=steel){
      const w=.035*s,d=.057*s,f=.012*s,t=.006*s;
      extrusion(a,b,[[-w,-d],[w,-d],[w,-d+f],[t,-d+f],[t,d-f],[w,d-f],[w,d],[-w,d],[-w,d-f],[-t,d-f],[-t,-d+f],[-w,-d+f]],color);
    }
    function bar(a,b,r=.016,color=steel){extrusion(a,b,[[-r,-r],[r,-r],[r,r],[-r,r]],color)}
    function box(c,s,color=steel){const [x,y,z]=c;extrusion([x,y-s[1]/2,z],[x,y+s[1]/2,z],[[-s[0]/2,-s[2]/2],[s[0]/2,-s[2]/2],[s[0]/2,s[2]/2],[-s[0]/2,s[2]/2]],color)}
    // Individual plates and four anchors stay visible in the structural view.
    bays.forEach((z,i)=>[-X,0,X].forEach((x,j)=>{
      part('bases',.12+i*.12+j*.09,.6,[0,.45,0]);
      box([x,0,z],[.22,.04,.23],edge);
      for(const dx of [-.076,.076])for(const dz of [-.08,.08])box([x+dx,.031,z+dz],[.025,.045,.025],[207,218,228]);
      part('pilares',2.5+i*.15+j*.09,.9,[0,1.1,0]);
      // The full I flange stays behind the end sheet, rather than piercing it.
      beam([x,.05,insetEnd(z)],[x,x===0?ridge:top,insetEnd(z)],1.12);
      // Cap/connection plates at the roof level.
      // Keep the connection plate inside the sheet plane, including at grazing angles.
      box([x-Math.sign(x)*.025,roof(x)-.08,insetEnd(z)],[.12,.17,.10],edge);
    }));
    // Solid-web portal rafters and the characteristic central double knee braces.
    bays.forEach((z,i)=>{
      part('vigas',5.5+i*.18,.9,[0,1.35,0]);
      beam([-X,eave,z],[0,ridge,z],1.1);beam([0,ridge,z],[X,eave,z],1.1);
      for(const x of [-X,0,X])for(const dir of (x===0?[-1,1]:[x<0?1:-1])){
        beam([x,roof(x)-.64,z],[x+dir*.8,roof(x+dir*.8)-.06,z],.82);
        box([x-Math.sign(x)*.025,roof(x)-.63,z],[.11,.13,.1],edge);
        box([x+dir*.8,roof(x+dir*.8)-.05,z],[.15,.12,.1],edge);
      }
      // Small splice plates on the two rafters.
      for(const x of [-3,3])box([x,roof(x),z],[.18,.12,.095],edge);
    });
    // Shared side/roof pattern: first and last bay braced, skip one then brace two.
    // The owner's later correction makes EVERY central bay braced.
    const sideRoofBracing=bays.slice(0,-1).map((_,i)=>i===0||i===bays.length-2||i%3!==1);
    // Roof purlins and side girts are installed bay by bay.
    for(let i=0;i<bays.length-1;i++){
      const a=bays[i],b=bays[i+1];part('tercas',9+i*.21,.8,[0,.75,0]);
      for(const x of roofPurlins)bar([x,roof(x)+.082,a],[x,roof(x)+.082,b],.018,metal);
      for(const id of ['west','east'])for(const y of [.78,1.28,1.78,2.28,2.78,3.33])girt(id,a,b,y);
      // Each passador connects neighboring purlin webs, with no floating ends.
      // The two roof slopes have separate chains, below the sheet undersides.
      for(const side of [-1,1]){
        const row=roofPurlins.filter(x=>Math.sign(x)===side);
        for(let j=0;j<row.length-1;j++){
          const x=row[j],nx=row[j+1],z=(a+b)/2;
          part('passadores',10.2+i*.16,.7,[0,.5,0]);active.bayIndex=i;
          bar([x,roof(x)+.075,z],[nx,roof(nx)+.075,z],.008,metal);
        }
        part('ligacoes-passadores',10.2+i*.16,.7,[0,.5,0]);active.bayIndex=i;
        for(const x of row)box([x,roof(x)+.075,(a+b)/2],[.026,.026,.03],edge);
      }
      // Continuous longitudinal tie connecting the central columns at mid-height.
      part('travamento-central',10.8+i*.12,.75,[0,.45,0]);active.bayIndex=i;
      beam([0,1.65,a],[0,1.65,b],.66);
      for(const z of [a,b])box([0,1.65,insetEnd(z)],[.11,.12,.11],edge);
      if(sideRoofBracing[i]){
        for(const side of [-1,1]){
          part('contraventos',11.3+i*.13,.8,[0,.28,0]);active.bayIndex=i;active.bracingPlane=side<0?'roof-west':'roof-east';
          line([side*.15,roof(.15)-.015,a],[side*5.8,roof(5.8)-.015,b],metal);
          line([side*.15,roof(.15)-.015,b],[side*5.8,roof(5.8)-.015,a],metal);
          part('contraventos',11.3+i*.13,.8,[side*.35,0,0]);active.bayIndex=i;active.bracingPlane=side<0?'west':'east';
          line([side*X,.78,a],[side*X,2.92,b],metal);line([side*X,2.92,a],[side*X,.78,b],metal);
        }
      }
      part('contraventos',11.3+i*.13,.8,[0,.28,0]);active.bayIndex=i;active.bracingPlane='center';
      line([0,1.69,a],[0,ridge-.18,b],metal);line([0,ridge-.18,a],[0,1.69,b],metal);
    }
    // End-wall framing extends above the shallow roof into a straight parapet.
    for(const z of [-Z,Z]){
      const id=z>0?'back':'front';
      part('tercas',10.8,.9,[0,.8,0]);
      for(let x=-4.5;x<6;x+=1.5)if(x!==0)beam([x,.05,z],[x,top,z],.7);
      for(const y of [.78,1.28,1.78,2.28,2.78,3.33])girt(id,-X,X,y);
      // Close both end elevations with X rods between the existing column axes.
      // Raise the lower connection above a gate lintel wherever an opening shares a bay.
      for(let i=0;i<8;i++){
        const a=-X+i*1.5,b=a+1.5,plane=insetEnd(z);
        const low=Math.max(.78,...onWall(id).filter(o=>o.b>a&&o.a<b).map(o=>o.high+.07));
        part('contraventos',11.3+i*.13,.8,[0,.28,0]);active.bayIndex=i;active.bracingPlane=id;
        line([a,low,plane],[b,roof(b)-.13,plane],metal);
        line([a,roof(a)-.13,plane],[b,low,plane],metal);
      }
    }
    // Steel jambs and lintels are erected before the masonry and door leaves.
    for(const o of accesses){
      part('requadros',12.8,.8,[0,.45,0]);
      for(const u of [o.a-.024,o.b+.024])bar(wallPoint(o.wall,u,.035),wallPoint(o.wall,u,o.high+.024),.023,steel);
      bar(wallPoint(o.wall,o.a-.046,o.high+.025),wallPoint(o.wall,o.b+.046,o.high+.025),.024,steel);
    }
    // Open U-shaped eaves gutters: inserted before roof/wall cladding.
    for(const s of [-1,1])for(let i=0;i<bays.length-1;i++){
      const a=bays[i],b=bays[i+1],x=s*5.85;
      part('calhas',14+i*.12,.6,[s*.8,.5,0]);
      face([[x-s*.16,2.97,a],[x-s*.16,2.81,a],[x+s*.12,2.81,a],[x+s*.12,2.97,a]],metal);
      face([[x-s*.16,2.81,a],[x+s*.12,2.81,a],[x+s*.12,2.81,b],[x-s*.16,2.81,b]],edge);
      for(const dx of [-.16,.12])face([[x+s*dx,2.81,a],[x+s*dx,2.99,a],[x+s*dx,2.99,b],[x+s*dx,2.81,b]],metal);
    }
    for(const x of [-5.82,5.82])for(const z of [bays[1],bays[6],10.8]){
      part('calhas',15.2,.7,[0,.45,0]);bar([x,2.83,z],[x,.15,z],.028,metal);
      bar([x,.15,z],[x+Math.sign(x)*.12,.09,z],.028,metal);
    }
    // Roof sheets: real shallow double slope, ribs running from ridge to gutter.
    for(let i=0;i<88;i++)for(const s of [-1,1]){
      const z=-Z+i*24/88,nz=z+24/88;
      part('cobertura',17+i*.027,.72,[0,.9,0]);
      for(let j=0;j<4;j++){
        const za=z+(nz-z)*j/4,zb=z+(nz-z)*(j+1)/4,ha=(j===1?.018:0),hb=(j===0?.018:0);
        face([[0,ridge+.12+ha,za],[s*5.75,roof(5.75)+.12+ha,za],[s*5.75,roof(5.75)+.12+hb,zb],[0,ridge+.12+hb,zb]],j===1?[201,216,227]:metal,'panel');
      }
    }
    // The civil work rises course by course around actual voids for each access.
    const windows=bays.slice(0,-1).flatMap((z,i)=>[z+(bays[i+1]-z)*.3,z+(bays[i+1]-z)*.7]);
    const elevations=[{id:'west',length:24,windows,delay:20.5},{id:'east',length:24,windows,delay:20.65},
      {id:'back',length:12,windows:[-4.7,-3.4,-2.1,2.1,3.4,4.7],delay:20.8},
      {id:'front',length:12,windows:[-4.7,-3.4,-2.1,2.1,3.4,4.7],delay:20.9}];
    for(const e of elevations){
      const point=(u,y)=>wallPoint(e.id,u,y,.035),doors=onWall(e.id);
      const openings=[...doors,...e.windows.filter(u=>!doors.some(o=>u+.25>o.a&&u-.25<o.b)).map(u=>({a:u-.21,b:u+.21,low:.48,high:.71,type:'janela'}))];
      const cuts=[-e.length/2,e.length/2,...openings.flatMap(o=>[o.a,o.b])].sort((a,b)=>a-b);
      for(let i=0;i<cuts.length-1;i++){
        const a=cuts[i],b=cuts[i+1],mid=(a+b)/2,op=openings.find(o=>mid>o.a&&mid<o.b);
        for(let course=0;course<9;course++){
          const low=course*.09,high=Math.min(wall,low+.09);
          const spans=op?[[low,Math.min(high,op.low)],[Math.max(low,op.high),high]]:[[low,high]];
          for(const [lo,hi] of spans){
            if(hi-lo<.001)continue;
            part('alvenaria',e.delay+(a+e.length/2)/e.length*.65+course*.07,.42,[0,-.08,0]);
            active.wallId=e.id;
            face([point(a,lo),point(b,lo),point(b,hi),point(a,hi)],concrete,'wall');
            line(point(a,hi),point(b,hi),[111,129,137]);
            for(let u=a+.17+(course%2)*.09;u<b;u+=.18)line(point(u,lo+.006),point(u,hi-.006),[107,124,133]);
          }
        }
      }
      for(const o of openings.filter(o=>o.type==='janela')){
        part('janelas',e.delay+1.9,.6,[0,0,0]);
        face([point(o.a+.012,o.low+.008),point(o.b-.012,o.low+.008),point(o.b-.012,o.high-.008),point(o.a+.012,o.high-.008)],glass,'glass');
        for(const u of [o.a,(o.a+o.b)/2,o.b])bar(point(u,o.low),point(u,o.high),.008,metal);
        for(const y of [o.low,o.high])bar(point(o.a,y),point(o.b,y),.009,metal);
      }
    }
    part('piso',22,.9,[0,-.09,0]);face([[-6,.01,-12],[6,.01,-12],[6,.01,12],[-6,.01,12]],[48,65,76],'floor');
    // Sheets are split exactly at the access jambs, so none cover a doorway.
    elevations.forEach((e,k)=>{
      const count=Math.round(e.length/.2),step=e.length/count,point=(u,y)=>wallPoint(e.id,u,y,.06);
      const cuts=[...Array.from({length:count+1},(_,i)=>-e.length/2+i*step),...onWall(e.id).flatMap(o=>[o.a,o.b])].sort((a,b)=>a-b);
      for(let i=0;i<cuts.length-1;i++){
        const a=cuts[i],b=cuts[i+1];if(b-a<.0001)continue;
        const access=onWall(e.id).find(o=>(a+b)/2>o.a&&(a+b)/2<o.b),low=Math.max(wall,access?.high||0);
        part('fechamento',24.5+k*.25+(a+e.length/2)/e.length*1.8,.75,[point(0,0)[0]*.13,.1,point(0,0)[2]*.06]);
        active.wallId=e.id;
        for(let j=0;j<4;j++){
          const u=a+(b-a)*j/4,v=a+(b-a)*(j+1)/4;
          face([point(u,low),point(v,low),point(v,top),point(u,top)],j===1?[198,215,227]:j===2?[142,166,185]:metal,'panel');
        }
      }
    });
    // Separate inner parapet skin, corrugated vertically, visible from the roof.
    // It covers the inside framing while leaving the eaves gutter channel open.
    for(const e of elevations){
      const count=Math.round(e.length/.2),step=e.length/count;
      for(let i=0;i<count;i++){
        const a=-e.length/2+i*step;
        part('fechamento-interno',26.4+i/count*.85,.6,[0,.4,0]);active.wallId=e.id;
        const point=(u,y,rib)=>wallPoint(e.id,u,y,-.095-rib);
        for(let j=0;j<4;j++){
          const u=a+step*j/4,v=a+step*(j+1)/4,ra=j===1?.013:0,rb=j===0?.013:0;
          const low=t=>(e.id==='west'||e.id==='east')?2.80:roof(t)+.068;
          face([point(u,low(u),ra),point(v,low(v),rb),point(v,top,rb),point(u,top,ra)],j===1?[198,215,227]:metal,'panel');
        }
      }
    }
    part('arremates',28.3,1,[0,.35,0]);
    // Caps, corner flashings and ridge finish.
    for(const x of [-6.06,6.06]){
      box([Math.sign(x)*6.01,top+.024,0],[.24,.04,24.18],metal);
      for(const z of [-12.065,12.065])box([x,(top+wall)/2,z],[.075,top-wall,.08],metal);
    }
    for(const z of [-12.06,12.06])box([0,top+.024,Math.sign(z)*12.01],[12.22,.04,.24],metal);
    box([0,ridge+.16,0],[.15,.035,24],metal);
    // Finished access leaves arrive last; masonry and frames remain inspectable before them.
    for(const [i,o] of accesses.entries()){
      const point=(u,y)=>wallPoint(o.wall,u,y,.078),emergency=o.type==='emergencia';
      part(emergency?'emergencia':'portoes',28.8+i*.09,.65,[0,.22,0]);
      active.accessId=o.id;active.doorLeaves=emergency?o.leaves:1;
      face([point(o.a+.007,.02),point(o.b-.007,.02),point(o.b-.007,o.high-.008),point(o.a+.007,o.high-.008)],emergency?[180,43,43]:[65,89,106],'panel');
      for(const u of [o.a,o.b])bar(point(u,.016),point(u,o.high),.012,metal);
      bar(point(o.a,o.high),point(o.b,o.high),.013,metal);
      if(emergency){
        // Red single/double leaves; each leaf has its own horizontal panic bar.
        if(o.leaves===2)for(const offset of [.09,.061])bar(wallPoint(o.wall,o.center,.022,offset),wallPoint(o.wall,o.center,o.high-.012,offset),.006,[73,32,34]);
        for(let leaf=0;leaf<o.leaves;leaf++){
          const l=o.a+o.width*leaf/o.leaves,r=o.a+o.width*(leaf+1)/o.leaves;
          part('barra-antipanico',29.15+i*.06,.45,[0,.22,0]);active.accessId=o.id;active.leafIndex=leaf;
          const pushPoint=(u,y)=>wallPoint(o.wall,u,y,.105);
          for(const u of [l+.043,r-.043])box(pushPoint(u,.245),o.wall==='west'||o.wall==='east'?[.025,.044,.033]:[.033,.044,.025],[193,204,211]);
          bar(pushPoint(l+.037,.245),pushPoint(r-.037,.245),.011,[221,228,231]);
          part('barra-antipanico-interna',29.15+i*.06,.45,[0,.22,0]);active.accessId=o.id;active.leafIndex=leaf;
          const inner=(u,y)=>wallPoint(o.wall,u,y,.047);
          for(const u of [l+.043,r-.043])box(inner(u,.245),o.wall==='west'||o.wall==='east'?[.025,.044,.033]:[.033,.044,.025],[193,204,211]);
          bar(inner(l+.037,.245),inner(r-.037,.245),.011,[221,228,231]);
        }
        part('sinalizacao',29.2+i*.06,.45,[0,.22,0]);active.accessId=o.id;
        const sign=(u,y)=>wallPoint(o.wall,u,y,.087);
        face([sign(o.center-.067,o.high+.05),sign(o.center+.067,o.high+.05),sign(o.center+.067,o.high+.105),sign(o.center-.067,o.high+.105)],[70,153,135],'panel');
        line(sign(o.center-.04,o.high+.077),sign(o.center+.035,o.high+.077),[226,243,237]);
      }else{
        for(const offset of [.086,.068])for(let y=.07;y<o.high-.025;y+=.07)line(wallPoint(o.wall,o.a+.01,y,offset),wallPoint(o.wall,o.b-.01,y,offset),[114,141,160]);
      }
    }
    const roofAccess=window.appendMetalloRoofAccess({part,box,bar,extrusion,line,bays,insetEnd,X,Z,top,ridge});
    return {parts,accesses,bays,sideRoofBracing,roofAccess,details:roofAccess.details,bounds:{x:X,z:Z,height:top},duration:31,
      phases:[
        {time:0,end:2.4,label:'Chapas de base e chumbadores'},
        {time:2.5,end:5.4,label:'Pilares laterais e centrais'},
        {time:5.5,end:8.9,label:'Vigas e mãos francesas'},
        {time:9,end:13.9,label:'Terças, travamentos e X'},
        {time:14,end:16.9,label:'Calhas e condutores'},
        {time:17,end:20.4,label:'Cobertura metálica'},
        {time:20.5,end:24.4,label:'Alvenaria, piso e janelas'},
        {time:24.5,end:28.2,label:'Fechamento externo e interno'},
        {time:28.3,end:31,label:'Portas e arremates · obra completa'}]};
  };
})();
