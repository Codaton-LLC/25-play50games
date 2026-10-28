"use client";

// Plate Surf's water shaders (look only: nothing here decides gameplay). The idea follows Flooded
// Ruins Escape's water look (games/flooded-ruins-escape/waterLook.ts: a canvas ripple normal map, a
// fresnel mix from the deep body colour to the sky, a sun glint and foam), rebuilt for a wave:
//
// - waveMaterial: the wave's face as one opaque deformed plane (about 19k triangles). The vertex
//   shader lifts it to the rules' profile (waves.ts faceY: a smoothstep from the trough to the crest,
//   the back sloping down behind it) and drops it to whitewater behind the curl; the fragment shader
//   colours it by height (deep at the trough, bright and glassy near the lip), adds the glowing sweet
//   band (brighter while a pump is armed), the foam line at the lip, the foam in the trough, streaks
//   drawn up the face and the whitewater. A `uRestore` mix brings the colour back from chalk grey.
// - curlMaterial: the pitching lip of the curl, a curved sheet thrown from the crest over the face,
//   growing from the peel point back to the full barrel.
// - seaMaterial: the open sea round the wave (opaque, rippled, fogged).
// - skyMaterial: the sky gradient (a dome that follows the camera).
// Only the spray particles (menu2/juice) are see-through: the water itself is opaque (the card's risk fix).
import { BackSide, CanvasTexture, Color, DoubleSide, RepeatWrapping, ShaderMaterial, UniformsLib, UniformsUtils, Vector3, type Texture } from "three";
import { BAND, FACE_W } from "./waves";
import { GREY, type SurfLook } from "./look";

/** How far behind the crest the back of the wave runs down to the sea (m). */
export const BACK_W = 14;
/** The wave mesh spans x from just in front of the trough to the back's foot. */
export const WAVE_X0 = -2.5;
export const WAVE_X1 = FACE_W + BACK_W;

/** A tileable ripple normal map (sum of whole-period waves), drawn once. */
export function rippleNormalTexture(size = 128): CanvasTexture {
   const c = document.createElement("canvas");
   c.width = c.height = size;
   const g = c.getContext("2d")!;
   const img = g.createImageData(size, size);
   const TAU = Math.PI * 2;
   const waves: Array<[number, number, number, number]> = [
      [1, 2, 1, 0.3],
      [3, -1, 0.7, 1.9],
      [-2, 3, 0.55, 4.1],
      [5, 2, 0.35, 2.4],
      [-4, -5, 0.25, 5.3],
      [7, -3, 0.18, 0.8],
   ];
   for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
         const u = x / size;
         const v = y / size;
         let dx = 0;
         let dy = 0;
         for (const [kx, ky, a, ph] of waves) {
            const t = Math.cos(TAU * (kx * u + ky * v) + ph) * a;
            dx += t * kx;
            dy += t * ky;
         }
         const nx = -dx * 0.09;
         const ny = -dy * 0.09;
         const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
         const i = (y * size + x) * 4;
         img.data[i] = Math.round((nx * inv * 0.5 + 0.5) * 255);
         img.data[i + 1] = Math.round((ny * inv * 0.5 + 0.5) * 255);
         img.data[i + 2] = Math.round((inv * 0.5 + 0.5) * 255);
         img.data[i + 3] = 255;
      }
   }
   g.putImageData(img, 0, 0);
   const t = new CanvasTexture(c);
   t.wrapS = t.wrapT = RepeatWrapping;
   t.needsUpdate = true;
   return t;
}

/** The profile in GLSL: the same smoothstep as waves.ts faceY, plus the back of the wave. */
const PROFILE = /* glsl */ `
   uniform float uH;
   uniform float uW;
   uniform float uBackW;
   float faceY(float x) {
      if (x <= 0.0) return 0.0;
      if (x <= uW) { float t = x / uW; return uH * t * t * (3.0 - 2.0 * t); }
      float b = clamp((x - uW) / uBackW, 0.0, 1.0);
      return uH * (1.0 - b * b * (3.0 - 2.0 * b));
   }
`;

const WAVE_VERT = /* glsl */ `
   ${PROFILE}
   uniform float uTime;
   uniform float uCurlZ;
   uniform float uSwell;
   varying vec3 vWorld;
   varying vec3 vNormal2;
   varying float vBroken;
   varying float vRawY;
   #include <fog_pars_vertex>
   float broken(float z) { return smoothstep(uCurlZ - 1.0, uCurlZ + 22.0, z); }
   float heightAt(float x, float z) {
      float y = faceY(x);
      float k = broken(z);
      // behind the curl the face has broken: low churning whitewater
      y = mix(y, y * 0.28 + 0.35 * sin(x * 1.3 + z * 0.4 + uTime * 3.0) * k, k);
      y += uSwell * (sin(z * 0.21 + uTime * 1.1) * 0.12 + sin(x * 0.9 - uTime * 1.7 + z * 0.05) * 0.06);
      return y;
   }
   void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      float x = wp.x;
      float z = wp.z;
      float y = heightAt(x, z);
      float e = 0.25;
      float dx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2.0 * e);
      float dz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2.0 * e);
      vNormal2 = normalize(vec3(-dx, 1.0, -dz));
      vRawY = faceY(x);
      wp.y = y;
      vWorld = wp.xyz;
      vBroken = broken(z);
      vec4 mvPosition = viewMatrix * wp;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
   }
`;

const WAVE_FRAG = /* glsl */ `
   uniform float uH;
   uniform float uW;
   uniform float uTime;
   uniform sampler2D uNormal;
   uniform vec3 uDeep;
   uniform vec3 uFace;
   uniform vec3 uLip;
   uniform vec3 uFoam;
   uniform vec3 uSky;
   uniform vec3 uSun;
   uniform vec3 uBandColor;
   uniform vec3 uGreyDeep;
   uniform vec3 uGreyFace;
   uniform vec3 uGreyLip;
   uniform vec3 uSunDir;
   uniform float uRestore;
   uniform float uBand;
   uniform vec2 uBandX;
   uniform float uHeroZ;
   uniform float uDetail;
   varying vec3 vWorld;
   varying vec3 vNormal2;
   varying float vBroken;
   varying float vRawY;
   #include <fog_pars_fragment>
   void main() {
      vec2 p = vWorld.xz;
      // water is drawn up the face as the wave moves: the ripples scroll towards the lip
      vec3 n1 = texture2D(uNormal, vec2(p.x * 0.11 - uTime * 0.09, p.y * 0.05 + uTime * 0.01)).xyz * 2.0 - 1.0;
      vec3 n2 = uDetail > 0.5 ? texture2D(uNormal, vec2(p.x * 0.27 - uTime * 0.2, p.y * 0.13 - uTime * 0.03)).xyz * 2.0 - 1.0 : vec3(0.0, 0.0, 1.0);
      vec2 tilt = (n1.xy + n2.xy * 0.6) * 0.32;
      vec3 N = normalize(vNormal2 + vec3(tilt.x, 0.0, tilt.y));
      vec3 V = normalize(cameraPosition - vWorld);
      float fres = pow(1.0 - abs(dot(N, V)), 4.0);
      float h = clamp(vRawY / uH, 0.0, 1.0);
      vec3 deep = mix(uGreyDeep, uDeep, uRestore);
      vec3 face = mix(uGreyFace, uFace, uRestore);
      vec3 lip = mix(uGreyLip, uLip, uRestore);
      // deep at the trough, the glassy face, the bright see-through-looking lip
      vec3 col = mix(deep, face, smoothstep(0.0, 0.55, h));
      col = mix(col, lip, smoothstep(0.55, 0.97, h) * (vWorld.x <= uW + 0.5 ? 1.0 : 0.35));
      // light through the face near the top
      col += lip * 0.22 * smoothstep(0.6, 1.0, h) * (0.6 + 0.4 * n1.x);
      // simple diffuse from the sun on the curved face
      float diff = clamp(dot(N, normalize(uSunDir)), 0.0, 1.0);
      col *= 0.72 + 0.38 * diff;
      col = mix(col, uSky, clamp(0.05 + fres * 0.6, 0.0, 0.7));
      vec3 H = normalize(normalize(uSunDir) + V);
      float spec = pow(max(dot(N, H), 0.0), 140.0) * 1.4 + pow(max(dot(N, H), 0.0), 18.0) * 0.08;
      col += uSun * spec;
      // streaks drawn up the face
      float streak = smoothstep(0.55, 0.95, sin(p.y * 1.7 + n1.y * 2.0) * 0.5 + 0.5) * smoothstep(0.12, 0.5, h) * (1.0 - smoothstep(0.85, 1.0, h));
      col = mix(col, uFoam, streak * 0.12);
      // the sweet band: where a down-carve pumps (brighter while a pump is armed); fades away from the hero
      float bx = vWorld.x;
      float inBand = smoothstep(uBandX.x - 0.5, uBandX.x + 0.2, bx) * (1.0 - smoothstep(uBandX.y - 0.2, uBandX.y + 0.5, bx));
      float edge = (1.0 - smoothstep(0.0, 0.35, abs(bx - uBandX.x))) + (1.0 - smoothstep(0.0, 0.35, abs(bx - uBandX.y)));
      float near = 1.0 - smoothstep(18.0, 70.0, abs(vWorld.z - uHeroZ));
      float glow = (inBand * 0.16 + edge * 0.5) * uBand * near * (1.0 - vBroken);
      col = mix(col, uBandColor, clamp(glow, 0.0, 0.8));
      // foam: the lip line, the trough, and the whitewater behind the curl
      float lipFoam = 1.0 - smoothstep(0.0, 0.7, abs(vWorld.x - uW));
      float troughFoam = 1.0 - smoothstep(-0.6, 1.4, vWorld.x);
      float breakup = n1.x * 0.35 + n2.y * 0.25 + 0.15 * sin(uTime * 2.1 + p.x * 3.1 + p.y * 1.7);
      float foam = max(max(lipFoam * 0.85, troughFoam * 0.7), vBroken);
      float f = smoothstep(0.3, 0.75, foam + breakup * foam);
      col = mix(col, uFoam, f * 0.92);
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
      #include <fog_fragment>
   }
`;

export interface WaveUniformLook {
   look: SurfLook;
   H: number;
   lite: boolean;
}

function colorUniforms(look: SurfLook) {
   return {
      uDeep: { value: new Color(look.deep) },
      uFace: { value: new Color(look.face) },
      uLip: { value: new Color(look.lip) },
      uFoam: { value: new Color(look.foam) },
      uSky: { value: new Color(look.skyMid) },
      uSun: { value: new Color(look.sun) },
      uBandColor: { value: new Color(look.band) },
      uGreyDeep: { value: new Color(GREY.deep) },
      uGreyFace: { value: new Color(GREY.face) },
      uGreyLip: { value: new Color(GREY.lip) },
      uSunDir: { value: new Vector3(-0.35, 0.8, 0.3) },
      uRestore: { value: 1 },
   };
}

/** The wave's face. Animate `uTime` (visual s), `uCurlZ`, `uHeroZ`, `uBand` (0..1) and `uRestore` (0..1). */
export function waveMaterial(normal: Texture, o: WaveUniformLook): ShaderMaterial {
   const uniforms = UniformsUtils.merge([
      UniformsLib.fog,
      {
         uH: { value: o.H },
         uW: { value: FACE_W },
         uBackW: { value: BACK_W },
         uTime: { value: 0 },
         uCurlZ: { value: 0 },
         uSwell: { value: o.lite ? 0.4 : 1 },
         uNormal: { value: null },
         uBand: { value: 0.3 },
         uBandX: { value: [BAND.lo, BAND.hi] },
         uHeroZ: { value: 0 },
         uDetail: { value: o.lite ? 0 : 1 },
         ...colorUniforms(o.look),
      },
   ]);
   uniforms.uNormal.value = normal;
   return new ShaderMaterial({ uniforms, vertexShader: WAVE_VERT, fragmentShader: WAVE_FRAG, fog: true });
}

// ---------- the curl ----------

/** The curl's sheet: from the peel point (uCurlZ) back this far it grows to the full barrel (m). */
export const CURL_GROW = 11;
export const CURL_LEN = 26;

const CURL_VERT = /* glsl */ `
   ${PROFILE}
   uniform float uTime;
   uniform float uCurlZ;
   uniform float uBarrel;
   varying vec3 vWorld;
   varying float vU;
   varying float vW;
   varying vec3 vN;
   #include <fog_pars_vertex>
   void main() {
      // uv.x: along the lip's arc (0 at the crest, 1 at its tip); uv.y: along the ride, behind the peel point
      float u = uv.x;
      float w = uv.y;
      float z = uCurlZ + w * ${CURL_LEN.toFixed(1)};
      float grow = smoothstep(0.0, ${(CURL_GROW / CURL_LEN).toFixed(3)}, w);
      // further back it collapses into whitewater
      float fall = 1.0 - smoothstep(0.62, 1.0, w);
      float reach = grow * fall;
      // the lip's arc round a centre over the upper face; a barrel (level 5) throws it wider
      float R = uH * (0.62 + 0.18 * uBarrel);
      vec2 C = vec2(uW - R * 0.82, uH - R * 0.62);
      float a0 = atan(uH - C.y, uW - C.x);
      float a1 = 3.6 + 0.35 * uBarrel;
      float a = mix(a0, mix(a0, a1, reach), u);
      float r = R * (1.0 - 0.18 * u * u);
      vec3 p = vec3(C.x + cos(a) * r, C.y + sin(a) * r, z);
      // a sheet that thins and wobbles towards its tip
      p.y += sin(z * 0.6 + uTime * 4.0) * 0.08 * u;
      vN = normalize(vec3(cos(a), sin(a), 0.0));
      vU = u;
      vW = w;
      vec4 wp = modelMatrix * vec4(p, 1.0);
      vWorld = wp.xyz;
      vec4 mvPosition = viewMatrix * wp;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
   }
`;

const CURL_FRAG = /* glsl */ `
   uniform float uTime;
   uniform sampler2D uNormal;
   uniform vec3 uDeep;
   uniform vec3 uFace;
   uniform vec3 uLip;
   uniform vec3 uFoam;
   uniform vec3 uGreyDeep;
   uniform vec3 uGreyFace;
   uniform vec3 uGreyLip;
   uniform vec3 uSun;
   uniform vec3 uSunDir;
   uniform float uRestore;
   varying vec3 vWorld;
   varying float vU;
   varying float vW;
   varying vec3 vN;
   #include <fog_pars_fragment>
   void main() {
      vec3 n1 = texture2D(uNormal, vec2(vU * 2.0 + uTime * 0.3, vWorld.z * 0.08)).xyz * 2.0 - 1.0;
      vec3 face = mix(uGreyFace, uFace, uRestore);
      vec3 lip = mix(uGreyLip, uLip, uRestore);
      vec3 deep = mix(uGreyDeep, uDeep, uRestore);
      // the outside of the throw is bright and glassy; the inside of the tube darker
      vec3 col = gl_FrontFacing ? mix(lip, face, vU * 0.6) : mix(deep, face, 0.45);
      col += lip * 0.2 * (0.5 + 0.5 * n1.x);
      float diff = clamp(dot(normalize(vN + n1 * 0.2), normalize(uSunDir)), 0.0, 1.0);
      col *= 0.75 + 0.35 * diff;
      // foam at the tip of the throw and where it collapses
      float foam = smoothstep(0.7, 1.0, vU) + smoothstep(0.55, 0.95, vW);
      foam += (n1.y * 0.3 + 0.15 * sin(uTime * 3.0 + vWorld.z * 1.3)) * foam;
      col = mix(col, uFoam, clamp(smoothstep(0.35, 0.8, foam), 0.0, 1.0) * 0.95);
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
      #include <fog_fragment>
   }
`;

/** The curl's pitching lip. Animate `uTime`, `uCurlZ`, `uRestore`, `uBarrel` (0..1, level 5's tube). */
export function curlMaterial(normal: Texture, o: WaveUniformLook): ShaderMaterial {
   const uniforms = UniformsUtils.merge([
      UniformsLib.fog,
      {
         uH: { value: o.H },
         uW: { value: FACE_W },
         uBackW: { value: BACK_W },
         uTime: { value: 0 },
         uCurlZ: { value: 0 },
         uBarrel: { value: 0 },
         uNormal: { value: null },
         ...colorUniforms(o.look),
      },
   ]);
   uniforms.uNormal.value = normal;
   return new ShaderMaterial({ uniforms, vertexShader: CURL_VERT, fragmentShader: CURL_FRAG, fog: true, side: DoubleSide });
}

// ---------- the open sea ----------

const SEA_VERT = /* glsl */ `
   varying vec3 vWorld;
   #include <fog_pars_vertex>
   void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorld = wp.xyz;
      vec4 mvPosition = viewMatrix * wp;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
   }
`;

const SEA_FRAG = /* glsl */ `
   uniform float uTime;
   uniform sampler2D uNormal;
   uniform vec3 uSea;
   uniform vec3 uGreySea;
   uniform vec3 uSky;
   uniform vec3 uSun;
   uniform vec3 uFoam;
   uniform vec3 uSunDir;
   uniform float uRestore;
   varying vec3 vWorld;
   #include <fog_pars_fragment>
   void main() {
      vec2 p = vWorld.xz;
      vec3 n1 = texture2D(uNormal, p * 0.05 + vec2(uTime * 0.015, uTime * 0.01)).xyz * 2.0 - 1.0;
      vec3 n2 = texture2D(uNormal, p * 0.13 + vec2(-uTime * 0.02, uTime * 0.025)).xyz * 2.0 - 1.0;
      vec3 N = normalize(vec3((n1.x + n2.x * 0.6) * 0.4, 1.0, (n1.y + n2.y * 0.6) * 0.4));
      vec3 V = normalize(cameraPosition - vWorld);
      float fres = pow(1.0 - abs(dot(N, V)), 4.0);
      vec3 base = mix(uGreySea, uSea, uRestore);
      vec3 col = mix(base, uSky, clamp(0.08 + fres * 0.75, 0.0, 0.85));
      vec3 H = normalize(normalize(uSunDir) + V);
      col += uSun * pow(max(dot(N, H), 0.0), 120.0) * 1.2;
      // a little foam along the wave's foot
      col = mix(col, uFoam, (1.0 - smoothstep(0.0, 3.0, abs(vWorld.x + 1.5))) * 0.25 * (0.6 + 0.4 * n1.x));
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
      #include <fog_fragment>
   }
`;

/** The open sea: animate `uTime` and `uRestore`. */
export function seaMaterial(normal: Texture, look: SurfLook): ShaderMaterial {
   const uniforms = UniformsUtils.merge([
      UniformsLib.fog,
      {
         uTime: { value: 0 },
         uNormal: { value: null },
         uSea: { value: new Color(look.sea) },
         uGreySea: { value: new Color(GREY.sea) },
         uSky: { value: new Color(look.skyMid) },
         uSun: { value: new Color(look.sun) },
         uFoam: { value: new Color(look.foam) },
         uSunDir: { value: new Vector3(-0.35, 0.8, 0.3) },
         uRestore: { value: 1 },
      },
   ]);
   uniforms.uNormal.value = normal;
   return new ShaderMaterial({ uniforms, vertexShader: SEA_VERT, fragmentShader: SEA_FRAG, fog: true });
}

// ---------- the sky ----------

const SKY_VERT = /* glsl */ `
   varying vec3 vPos;
   void main() {
      vPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
   }
`;
const SKY_FRAG = /* glsl */ `
   varying vec3 vPos;
   uniform vec3 uTop;
   uniform vec3 uMid;
   uniform vec3 uBottom;
   uniform vec3 uSun;
   uniform vec3 uSunDir;
   void main() {
      vec3 d = normalize(vPos);
      float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
      vec3 c = mix(uBottom, uMid, smoothstep(0.48, 0.62, h));
      c = mix(c, uTop, smoothstep(0.6, 1.0, h));
      float s = max(dot(d, normalize(uSunDir)), 0.0);
      c += uSun * (pow(s, 600.0) * 1.2 + pow(s, 12.0) * 0.18);
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
   }
`;

export function skyMaterial(look: SurfLook): ShaderMaterial {
   return new ShaderMaterial({
      uniforms: {
         uTop: { value: new Color(look.skyTop) },
         uMid: { value: new Color(look.skyMid) },
         uBottom: { value: new Color(look.skyBottom) },
         uSun: { value: new Color(look.sun) },
         uSunDir: { value: new Vector3(-0.35, 0.35, -0.85) },
      },
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: BackSide,
      depthWrite: false,
      fog: false,
   });
}
