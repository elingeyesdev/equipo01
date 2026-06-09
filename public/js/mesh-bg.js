// Animated WebGL mesh gradient background — reacts to mouse/touch
(function () {
  'use strict';

  const canvas = document.getElementById('bgCanvas');
  if (!canvas) return;

  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) { canvas.style.display = 'none'; return; }

  const VS = `
    attribute vec2 a_pos;
    void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
  `;

  const FS = `
    precision mediump float;
    uniform vec2  u_res;
    uniform vec2  u_mouse;
    uniform float u_time;

    float wt(vec2 a, vec2 b) {
      float d = distance(a, b);
      return 1.0 / (d * d + 0.032);
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_res;
      uv.y = 1.0 - uv.y;
      vec2 mo = vec2(u_mouse.x / u_res.x, 1.0 - u_mouse.y / u_res.y);
      float t = u_time * 0.00030;

      // Animated blob centers
      vec2 p1 = vec2(0.14 + 0.10*sin(t*1.00), 0.20 + 0.08*cos(t*1.30));
      vec2 p2 = vec2(0.82 - 0.08*cos(t*0.80), 0.18 + 0.10*sin(t*1.10));
      vec2 p3 = vec2(0.50 + 0.12*sin(t*0.65), 0.84 - 0.09*cos(t*0.90));
      vec2 p4 = vec2(0.24 + 0.06*cos(t*1.40), 0.64);
      vec2 p5 = vec2(0.78,                     0.50 + 0.10*cos(t*0.75));

      // Color palette — deep navy / teal spectrum
      vec3 c1 = vec3(0.000, 0.090, 0.175); // deep navy
      vec3 c2 = vec3(0.000, 0.360, 0.330); // teal
      vec3 c3 = vec3(0.055, 0.195, 0.305); // steel blue
      vec3 c4 = vec3(0.020, 0.440, 0.405); // aqua
      vec3 c5 = vec3(0.000, 0.155, 0.255); // slate
      vec3 cm = vec3(0.085, 0.560, 0.520); // mouse glow

      float w1 = wt(uv,p1), w2 = wt(uv,p2), w3 = wt(uv,p3);
      float w4 = wt(uv,p4), w5 = wt(uv,p5), wm = wt(uv,mo) * 0.22;
      float total = w1+w2+w3+w4+w5+wm;

      vec3 col = (c1*w1 + c2*w2 + c3*w3 + c4*w4 + c5*w5 + cm*wm) / total;

      // Edge vignette
      col *= 1.0 - 0.42 * pow(length(uv - 0.5) * 1.5, 2.0);

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function mkShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, mkShader(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, mkShader(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

  const aPos   = gl.getAttribLocation(prog,  'a_pos');
  const uRes   = gl.getUniformLocation(prog, 'u_res');
  const uMouse = gl.getUniformLocation(prog, 'u_mouse');
  const uTime  = gl.getUniformLocation(prog, 'u_time');

  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  let mx = window.innerWidth * 0.5, my = window.innerHeight * 0.5;
  const t0 = performance.now();

  window.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
  window.addEventListener('touchmove', e => {
    mx = e.touches[0].clientX; my = e.touches[0].clientY;
  }, { passive: true });

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  window.addEventListener('resize', resize);

  (function render() {
    gl.uniform2f(uRes,   canvas.width, canvas.height);
    gl.uniform2f(uMouse, mx, my);
    gl.uniform1f(uTime,  performance.now() - t0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  })();
})();
