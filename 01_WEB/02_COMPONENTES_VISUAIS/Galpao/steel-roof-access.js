/* Exterior roof access and lifelines, visually reconstructed from the owner's 11 photos.
 * Supports connect to column axes (owner clarification); sizes are visual estimates.
 * This module adds display geometry only, not an engineered installation specification.
 */
(() => {
  window.appendMetalloRoofAccess=({part,box,bar,extrusion,line,bays,insetEnd,X,Z,top,ridge})=>{
    const yellow=[248,194,32],galvanized=[145,163,177],cableColor=[77,94,106],seal=[196,207,214];
    const round=(a,b,r,color=galvanized,sides=8)=>extrusion(a,b,Array.from({length:sides},(_,i)=>[Math.cos(i*2*Math.PI/sides)*r,Math.sin(i*2*Math.PI/sides)*r]),color);
    const polyline=(points,r,color)=>{for(let i=1;i<points.length;i++)round(points[i-1],points[i],r,color)};
    const addPart=(kind,extra={},delay=29.4)=>Object.assign(part(kind,delay,.55,[0,.08,0]),{roofAccess:true,...extra});
    // Facade-local coordinates: outward distance, height, distance from the corner.
    // The marked empty destination is on the BACK face, immediately beside the east corner.
    const layout={lower:.90,upper:.40,plane:.16,landing:1.72,top:top+.27,return:-.44};
    const ladder={wall:'back',lowerX:X-layout.lower,upperX:X-layout.upper,planeZ:-Z-layout.plane,
      landing:layout.landing,top:layout.top,returnZ:-Z-layout.return};
    ladder.roofLanding=ridge-ladder.upperX/X*.22+.138;
    const place=([out,y,along])=>[X-along,y,-Z-out];
    const ladderBox=(c,s,color)=>box(place(c),[s[2],s[1],s[0]],color);
    const ladderBar=(a,b,r,color)=>bar(place(a),place(b),r,color);
    const ladderRound=(a,b,r,color)=>round(place(a),place(b),r,color);
    const ladderPolyline=(points,r,color)=>polyline(points.map(place),r,color);
    const {plane,landing}=layout,half=.08;
    function flight(id,z,lo,hi,cageLow,cageHigh){
      addPart('escada-montantes',{flight:id},28.8+(id==='upper'?.12:0));
      for(const side of [-1,1]){
        ladderBox([plane,(lo+hi)/2,z+side*half],[.024,hi-lo,.014],yellow);
        if(lo===.025)ladderBox([plane,.024,z+side*half],[.08,.016,.055],yellow);
      }
      addPart('escada-degraus',{flight:id},29+(id==='upper'?.12:0));
      for(let y=lo+.06;y<hi-.02;y+=.072)ladderRound([plane,y,z-half],[plane,y,z+half],.0045,yellow);
      addPart('escada-fixacoes',{flight:id},28.9);
      for(let y=lo+.18;y<Math.min(hi,top)-.05;y+=.35)for(const side of [-1,1]){
        const u=z+side*half;
        ladderBox([.072,y,u],[.024,.06,.055],galvanized);
        ladderBar([.08,y,u],[plane,y,u],.007,yellow);
        ladderRound([.079,y-.018,u],[.094,y-.018,u],.005,galvanized);
        ladderRound([.079,y+.018,u],[.094,y+.018,u],.005,galvanized);
      }
      // Open-backed hoops and five continuous cage strips.
      const cagePoint=(angle,y)=>[plane+.014+Math.sin(angle)*.195,y,z+Math.cos(angle)*.115];
      const count=Math.ceil((cageHigh-cageLow)/.23);
      addPart('escada-gaiola',{flight:id},29.15+(id==='upper'?.1:0));
      for(let i=0;i<=count;i++){
        const y=cageLow+(cageHigh-cageLow)*i/count;
        ladderPolyline(Array.from({length:17},(_,j)=>cagePoint(j*Math.PI/16,y)),.0038,yellow);
      }
      for(const angle of [0,Math.PI/4,Math.PI/2,3*Math.PI/4,Math.PI])
        ladderBar(cagePoint(angle,cageLow),cagePoint(angle,cageHigh),.003,yellow);
      for(const y of [cageLow,cageHigh])for(const side of [-1,1])
        ladderBar([plane,y,z+side*half],[plane+.014,y,z+side*.115],.0038,yellow);
    }
    flight('lower',layout.lower,.025,landing+.04,.60,landing+.24);
    flight('upper',layout.upper,landing,ladder.top,landing+.43,ladder.top);
    // Side-step landing, with an open lower-flight arrival and upper-flight entry.
    const z0=layout.upper-.12,z1=layout.lower+.13,x0=plane-.05,x1=plane+.23;
    addPart('escada-patamar',{landing},29.12);
    for(const x of [x0,x1])ladderBar([x,landing,z0],[x,landing,z1],.01,yellow);
    for(const z of [z0,z1])ladderBar([x0,landing,z],[x1,landing,z],.01,yellow);
    // Grating stays open at the lower ladder so the arrival is not blocked by a solid deck.
    for(let z=z0+.02;z<layout.lower-half-.014;z+=.018)
      ladderBar([x0,landing+.005,z],[x1,landing+.005,z],.0028,yellow);
    for(const x of [x0+.06,x0+.14,x0+.22])
      ladderBar([x,landing+.003,z0],[x,landing+.003,layout.lower-half-.014],.0025,yellow);
    for(const z of [z0,z1]){
      ladderBar([.078,landing-.30,z],[x1,landing-.01,z],.009,yellow);
      ladderBox([.075,landing-.29,z],[.025,.09,.065],yellow);
      ladderBar([x1,landing,z],[x1,landing+.27,z],.007,yellow);
    }
    for(const y of [landing+.14,landing+.27])ladderBar([x1,y,z0],[x1,y,z1],.007,yellow);
    for(const y of [landing+.14,landing+.27])for(const z of [z0,z1])ladderBar([plane+.012,y,z],[x1,y,z],.007,yellow);
    // Owner-requested return ladder descends inside the parapet onto the roof, beyond the gutter.
    addPart('escada-saida-cobertura',{},29.25);
    for(const side of [-1,1]){
      const z=layout.upper+side*half;
      ladderBar([plane,ladder.top,z],[layout.return,ladder.top,z],.007,yellow);
      ladderBar([plane,top+.058,z],[layout.return,top+.058,z],.009,yellow);
    }
    for(let x=layout.return;x<plane;x+=.025)ladderBar([x,top+.058,layout.upper-half],[x,top+.058,layout.upper+half],.003,yellow);
    addPart('escada-descida-interna',{flight:'return',roofLanding:ladder.roofLanding},29.3);
    for(const side of [-1,1]){
      const z=layout.upper+side*half;
      ladderBox([layout.return,(ladder.roofLanding+ladder.top)/2,z],[.024,ladder.top-ladder.roofLanding,.014],yellow);
      ladderBox([layout.return,ladder.roofLanding+.006,z],[.065,.012,.04],yellow);
    }
    for(let y=ladder.roofLanding+.06;y<top+.04;y+=.072)
      ladderRound([layout.return,y,layout.upper-half],[layout.return,y,layout.upper+half],.0045,yellow);

    // Every lifeline support has a welded root at a real column, not at the sheet alone.
    const anchors=[],runs=[];
    const cableY={side:3.235,ridge:ridge+.32};
    function clampCable(at,tangent){
      const perpendicular=[-tangent[2],0,tangent[0]];
      const p=(along,up,across=0)=>at.map((v,i)=>v+tangent[i]*along+(i===1?up:0)+perpendicular[i]*across);
      round(p(-.022,-.009),p(.022,-.009),.009,galvanized);
      for(const along of [-.017,.017]){
        box(p(along,-.012),[.016,.012,.014],galvanized);
        for(const across of [-.008,.008])round(p(along,-.022,across),p(along,.003,across),.0026,galvanized);
        polyline(Array.from({length:9},(_,i)=>p(along,.004+Math.sin(i*Math.PI/8)*.009,Math.cos(i*Math.PI/8)*.008)),.0025,galvanized);
      }
    }
    for(const side of [-1,1]){
      const points=[];
      bays.forEach((bay,columnIndex)=>{
        const columnZ=insetEnd(bay),endShift=Math.abs(bay)===Z?-Math.sign(bay)*.20:0;
        const z=columnZ+endShift,root=[side*X,3.22,columnZ],tip=[side*(X-.245),cableY.side,z];
        addPart('linha-vida-suporte',{lineId:side<0?'west':'east',columnIndex,columnPosition:[side*X,0,columnZ],weldRoot:root},29.45);
        // The short exposed arm continues through the sealed inner sheet to the column.
        bar(root,[side*(X-.245),3.22,z],.008,galvanized);
        box([side*(X-.012),3.22,columnZ],[.027,.052,.055],galvanized);
        box([side*(X-.117),3.22,columnZ+endShift*.48],[.012,.105,.105],seal);
        box([side*(X-.113),3.22,columnZ+endShift*.48],[.022,.048,.048],galvanized);
        clampCable(tip,[0,0,1]);
        anchors.push({lineId:side<0?'west':'east',columnIndex,root,tip});points.push(tip);
      });
      runs.push({id:side<0?'west':'east',points});
    }
    const ridgePoints=[];
    bays.forEach((bay,columnIndex)=>{
      const z=insetEnd(bay),root=[0,ridge-.06,z],tip=[0,cableY.ridge,z];
      addPart('linha-vida-suporte',{lineId:'ridge',columnIndex,columnPosition:[0,0,z],weldRoot:root},29.45);
      bar(root,[0,tip[1]-.01,z],.009,galvanized);
      box([0,ridge-.055,z],[.043,.06,.05],galvanized);
      // Cross saddle above the ridge cap; bolts stay clear of the underside sheets.
      box([0,ridge+.187,z],[.31,.008,.047],galvanized);
      for(const x of [-.13,-.065,.065,.13])round([x,ridge+.190,z],[x,ridge+.201,z],.0045,galvanized);
      clampCable(tip,[0,0,1]);
      anchors.push({lineId:'ridge',columnIndex,root,tip});ridgePoints.push(tip);
    });
    runs.push({id:'ridge',points:ridgePoints});
    const sag=.010;
    const cable=(points,lineId)=>{
      const p=addPart('linha-vida-cabo',{lineId,cablePath:points.map(v=>[...v])},29.70);
      for(let i=1;i<points.length;i++){
        round(points[i-1],points[i],.0024,cableColor,6);
        line(points[i-1],points[i],cableColor);
      }
      return p;
    };
    const atZ=(run,z)=>{
      let i=run.points.findIndex(p=>p[2]>=z);if(i<1)i=1;
      const a=run.points[i-1],b=run.points[i],t=(z-a[2])/(b[2]-a[2]);
      return [a[0],a[1]-sag*4*t*(1-t),z];
    };
    for(const run of runs)for(let i=1;i<run.points.length;i++){
      const a=run.points[i-1],b=run.points[i];
      cable(Array.from({length:13},(_,j)=>{const t=j/12;return a.map((v,k)=>v+(b[k]-v)*t-(k===1?sag*4*t*(1-t):0))}),run.id);
    }
    // Transverse connector is clipped onto the longitudinal cables, as shown in close-ups.
    const crossingZ=-9,connectionPoints=runs.map(run=>({lineId:run.id,point:atZ(run,crossingZ)}));
    const west=connectionPoints.find(p=>p.lineId==='west').point,east=connectionPoints.find(p=>p.lineId==='east').point,center=connectionPoints.find(p=>p.lineId==='ridge').point;
    function link(at,direction,id){
      addPart('linha-vida-conector',{lineId:id,connection:at},29.8);
      const loop=Array.from({length:21},(_,i)=>{const a=i*2*Math.PI/20;return [at[0]+direction*(.032+Math.cos(a)*.035),at[1]+Math.sin(a)*.014,at[2]]});
      polyline(loop,.0028,galvanized);
      round([at[0]+direction*.025,at[1]-.014,at[2]],[at[0]+direction*.055,at[1]-.007,at[2]],.004,galvanized);
      const eye=[at[0]+direction*.081,at[1],at[2]];
      polyline(Array.from({length:17},(_,i)=>{const a=i*2*Math.PI/16;return [eye[0]+Math.cos(a)*.017,eye[1]+Math.sin(a)*.009,eye[2]]}),.003,galvanized);
      for(const distance of [.12,.15,.18])clampCable([at[0]+direction*distance,at[1],at[2]],[direction,0,0]);
      return [at[0]+direction*.07,at[1],at[2]];
    }
    const wStart=link(west,1,'west'),cLeft=link(center,-1,'ridge-west'),cRight=link(center,1,'ridge-east'),eEnd=link(east,-1,'east');
    for(const [a,b,id] of [[wStart,cLeft,'transverse-west'],[cRight,eEnd,'transverse-east']])
      cable(Array.from({length:31},(_,j)=>{const t=j/30;return a.map((v,k)=>v+(b[k]-v)*t-(k===1?.018*4*t*(1-t):0))}),id);
    const details={
      ladder:{label:'Escada amarela',yaw:.32,pitch:.08,bounds:{x:[4.75,5.9],y:[-.08,3.85],z:[-12.5,-11.45]}},
      'ladder-return':{label:'Descida pela platibanda',yaw:2.55,pitch:.53,bounds:{x:[5.36,5.84],y:[2.98,3.74],z:[-12.48,-11.3]}},
      lifeline:{label:'Linhas de vida · cobertura',yaw:.36,pitch:.87,bounds:{x:[-6.2,6.2],y:[2.8,3.7],z:[-12.3,12.3]}},
      'lifeline-detail':{label:'Suporte soldado e cabo',yaw:-1.13,pitch:.62,bounds:{x:[5.43,6.16],y:[3.06,3.44],z:[-10.27,-9.72]}},
      'lifeline-link':{label:'Conexões na cumeeira',yaw:.23,pitch:.88,bounds:{x:[-.5,.5],y:[3.28,3.65],z:[-10.23,-8.76]}}
    };
    return {ladder,anchors,runs,connectionPoints,details};
  };
})();
