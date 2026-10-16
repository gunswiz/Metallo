/* Depth-buffered local renderer. Geometry is uploaded once; only camera and time change. */
(() => {
  window.metalloInteriorColor=(part,f)=>{
    const n=f.normal;
    const base=part.kind==='piso'?[125,139,146]:part.kind==='cobertura'?f.color.map(v=>v*.76):f.color;
    const light=f.style==='line'?.86:Math.min(1,.60+.18*Math.abs(n[0])+.10*Math.abs(n[2])+.35*Math.abs(n[1]));
    return base.map(v=>v*light/255);
  };
  window.createMetalloRenderer=(canvas,model)=>{
    const gl=canvas.getContext('webgl',{alpha:true,antialias:true,preserveDrawingBuffer:true,premultipliedAlpha:false});
    if(!gl)return null;
    const vertex=`precision highp float;
      attribute vec3 a_position,a_color,a_insideColor,a_offset; attribute vec2 a_timing;
      uniform vec4 u_rotation,u_view; uniform vec2 u_size; uniform float u_time,u_inside;
      uniform mat4 u_interiorMatrix;
      varying vec3 v_color; varying float v_visible;
      void main(){
        float t=clamp((u_time-a_timing.x)/a_timing.y,0.0,1.0);
        vec3 p=a_position+a_offset*pow(1.0-t,3.0);
        if(u_inside>0.5){
          gl_Position=u_interiorMatrix*vec4(p,1.0);
        }else{
          float x=p.x*u_rotation.x+p.z*u_rotation.y;
          float z=-p.x*u_rotation.y+p.z*u_rotation.x;
          float y=(p.y-1.65)*u_rotation.z+z*u_rotation.w;
          z=-(p.y-1.65)*u_rotation.w+z*u_rotation.z;
          float cw=(60.0+z)/60.0;
          gl_Position=vec4((u_view.x*2.0/u_size.x-1.0)*cw+x*u_view.z*2.0/u_size.x,
            (1.0-u_view.y*2.0/u_size.y)*cw+y*u_view.z*2.0/u_size.y,
            .5+z/30.0,cw);
        }
        v_color=mix(a_color,a_insideColor,u_inside);v_visible=t;
      }`;
    const fragment=`precision mediump float; varying vec3 v_color; varying float v_visible;
      void main(){if(v_visible<=0.0)discard;gl_FragColor=vec4(v_color,1.0);}`;
    const shaders=[];
    function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('Renderização indisponível');shaders.push(s);return s}
    const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))return null;
    gl.useProgram(program);
    const triangles=[],lines=[];
    const push=(target,p,color,insideColor,part)=>target.push(...p,...color,...insideColor,...part.offset,part.delay,part.duration);
    for(const part of model.parts)for(const f of part.faces){
      const n=f.normal,light=f.style==='line'? .9 : Math.min(1,.56+.24*Math.abs(n[0])+.09*Math.abs(n[2])+.44*Math.abs(n[1]));
      const color=f.color.map(v=>v*light/255),insideColor=window.metalloInteriorColor(part,f);
      if(f.pts.length===2){for(const p of f.pts)push(lines,p,color,insideColor,part)}else{
        // Quad surfaces dominate. Small I-profile end caps are closed by this fan.
        for(let i=1;i<f.pts.length-1;i++)for(const p of [f.pts[0],f.pts[i],f.pts[i+1]])push(triangles,p,color,insideColor,part);
      }
    }
    const ground={offset:[0,0,0],delay:-1,duration:1},groundColor=[.057,.12,.16];
    for(let z=-14;z<=14;z+=2)for(const p of [[-9,-.08,z],[9,-.08,z]])push(lines,p,groundColor,groundColor,ground);
    for(let x=-8;x<=8;x+=2)for(const p of [[x,-.08,-14],[x,-.08,14]])push(lines,p,groundColor,groundColor,ground);
    function buffer(data){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);return {buffer:b,count:data.length/14}}
    const triangleBuffer=buffer(triangles),lineBuffer=buffer(lines);
    const attrs=[['a_position',3,0],['a_color',3,3],['a_insideColor',3,6],['a_offset',3,9],['a_timing',2,12]].map(([name,n,o])=>[gl.getAttribLocation(program,name),n,o]);
    const uniforms=Object.fromEntries(['u_rotation','u_view','u_size','u_time','u_inside','u_interiorMatrix'].map(k=>[k,gl.getUniformLocation(program,k)]));
    function bind(b){gl.bindBuffer(gl.ARRAY_BUFFER,b.buffer);for(const [loc,size,offset] of attrs){gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,56,offset*4)}}
    let width=1,height=1;
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.clearColor(0,0,0,0);
    return {
      resize(w,h,dpr){width=w;height=h;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);gl.viewport(0,0,canvas.width,canvas.height)},
      draw(camera,time){
        gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
        gl.uniform4f(uniforms.u_rotation,camera.cy,camera.sy,camera.cp,camera.sp);gl.uniform4f(uniforms.u_view,camera.ox,camera.oy,camera.scale,0);gl.uniform2f(uniforms.u_size,width,height);gl.uniform1f(uniforms.u_time,time);
        gl.uniform1f(uniforms.u_inside,camera.interiorMatrix?1:0);
        if(camera.interiorMatrix)gl.uniformMatrix4fv(uniforms.u_interiorMatrix,false,camera.interiorMatrix);
        gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(0,1);bind(triangleBuffer);gl.drawArrays(gl.TRIANGLES,0,triangleBuffer.count);gl.disable(gl.POLYGON_OFFSET_FILL);
        bind(lineBuffer);gl.drawArrays(gl.LINES,0,lineBuffer.count);
      },
      destroy(){gl.deleteBuffer(triangleBuffer.buffer);gl.deleteBuffer(lineBuffer.buffer);shaders.forEach(s=>gl.deleteShader(s));gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext()}
    };
  };
})();
