/* =============================================
   PhotoEdit App v4
   BG Removal: TensorFlow.js BodyPix (no COEP needed)
   BG Gallery: Canvas-generated gradients + patterns
   ============================================= */
'use strict';

const $ = id => document.getElementById(id);
let _toastT = null;

function toast(msg, ms = 2600) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastT);
  _toastT = setTimeout(() => el.classList.remove('show'), ms);
}

function isWebview() {
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|FB_IAB|Zalo|Line|Instagram|Twitter/.test(ua)
    || (ua.includes('Android') && !ua.includes('Chrome/') && ua.includes('Version/'));
}

function dataURLtoBlob(dataURL) {
  const [hdr, b64] = dataURL.split(',');
  const mime = hdr.match(/:(.*?);/)[1];
  const raw  = atob(b64);
  const arr  = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

async function saveFile(blobOrUrl, filename) {
  if (isWebview()) { $('oibOverlay').hidden = false; return; }
  try {
    let blob;
    if (typeof blobOrUrl === 'string') {
      const res = await fetch(blobOrUrl);
      blob = await res.blob();
    } else {
      blob = blobOrUrl;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 6000);
    toast('✅ Đã lưu ảnh!');
  } catch {
    toast('💡 Nhấn giữ ảnh → Lưu ảnh');
  }
}

$('oibCloseBtn').addEventListener('click', () => { $('oibOverlay').hidden = true; });

// ── Stage switching ───────────────────────────────
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function switchStage(name) {
  document.querySelectorAll('.stage-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.stage === name));
  document.querySelectorAll('.stage-panel').forEach(p =>
    p.classList.toggle('active', p.id === `stage${cap(name)}`));
  document.querySelectorAll('.ctrl-panel').forEach(p =>
    p.classList.toggle('active', p.id === `panel${cap(name)}`));
  if (name === 'composite') {
    if (!bgInited) initBgGallery();
    renderComposite();
  }
}
document.querySelectorAll('.stage-tab').forEach(btn =>
  btn.addEventListener('click', () => switchStage(btn.dataset.stage))
);

// ── Upload ────────────────────────────────────────
const fileInput  = $('fileInput');
const uploadDrop = document.querySelector('.upload-drop');

fileInput.addEventListener('change', e => handleFile(e.target.files[0]));
uploadDrop.addEventListener('dragover', e => { e.preventDefault(); uploadDrop.classList.add('drag'); });
uploadDrop.addEventListener('dragleave', () => uploadDrop.classList.remove('drag'));
uploadDrop.addEventListener('drop', e => {
  e.preventDefault(); uploadDrop.classList.remove('drag');
  handleFile(e.dataTransfer.files[0]);
});

$('newBtn').addEventListener('click', () => {
  $('uploadScreen').classList.add('active');
  $('editorScreen').classList.remove('active');
  editOriginal = null; removedBlobUrl = null;
  subjectImg = null; bgImg = null;
  editCanvas.style.filter = '';
  $('removedImg').src = '';
  $('removeResultBtns').style.display = 'none';
  $('removeProgressWrap').style.display = 'none';
  $('scaleRowWrap').style.display = 'none';
  $('compositeDownloadRow').style.display = 'none';
  $('dragHint').classList.remove('show');
  resetEditSliders(); switchStage('edit');
  fileInput.value = '';
});

function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) { toast('⚠️ Chỉ hỗ trợ file ảnh'); return; }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    $('uploadScreen').classList.remove('active');
    $('editorScreen').classList.add('active');
    loadEditImage(img);
    URL.revokeObjectURL(url);
    switchStage('edit');
  };
  img.src = url;
}

// ══════════════════════════════════════════════════
//  EDIT
// ══════════════════════════════════════════════════
let editOriginal = null;
const editCanvas = $('editCanvas');
const editCtx    = editCanvas.getContext('2d', { willReadFrequently: true });

function loadEditImage(img) {
  const MAX = 1200;
  let w = img.naturalWidth, h = img.naturalHeight;
  if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
  if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; }
  editCanvas.width = w; editCanvas.height = h;
  editCtx.drawImage(img, 0, 0, w, h);
  editOriginal = editCtx.getImageData(0, 0, w, h);
  resetEditSliders(); applyFilters();
}

function resetEditSliders() {
  [['sBrightness','vBrightness','100'],['sContrast','vContrast','100'],
   ['sSaturate','vSaturate','100'],['sBlur','vBlur','0'],['sWarm','vWarm','0']]
  .forEach(([s,v,d]) => { $(s).value = d; $(v).textContent = d; });
  editCanvas.style.filter = '';
}
['sBrightness','sContrast','sSaturate','sBlur','sWarm'].forEach(id => {
  const vid = 'v' + id.slice(1);
  $(id).addEventListener('input', () => { $(vid).textContent = $(id).value; applyFilters(); });
});
function applyFilters() {
  if (!editOriginal) return;
  const b = $('sBrightness').value, c = $('sContrast').value,
        s = $('sSaturate').value,   bl = $('sBlur').value, w = +$('sWarm').value;
  let f = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
  if (+bl > 0) f += ` blur(${bl}px)`;
  if (w > 0)   f += ` sepia(${Math.round(w*0.5)}%)`;
  if (w < 0)   f += ` hue-rotate(${Math.round(w*0.5)}deg)`;
  editCanvas.style.filter = f;
}
$('resetEditBtn').addEventListener('click', () => { if (editOriginal) resetEditSliders(); });
$('downloadEditBtn').addEventListener('click', () => {
  if (!editOriginal) { toast('⚠️ Chưa có ảnh'); return; }
  const off = document.createElement('canvas');
  off.width = editCanvas.width; off.height = editCanvas.height;
  const ctx = off.getContext('2d');
  ctx.filter = editCanvas.style.filter || 'none';
  ctx.drawImage(editCanvas, 0, 0);
  saveFile(dataURLtoBlob(off.toDataURL('image/jpeg', 0.93)), `edited-${Date.now()}.jpg`);
});

// ══════════════════════════════════════════════════
//  REMOVE BACKGROUND — TensorFlow.js BodyPix
//  Không cần COEP header, hoạt động trên GitHub Pages
//  Chuyên cho ảnh người (portrait, toàn thân)
// ══════════════════════════════════════════════════
let removedBlobUrl = null;
let bpNet = null;
let tfLoaded = false;

function setProgress(pct, label) {
  $('progressBar').style.width = pct + '%';
  $('progressLabel').textContent = label;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function initBodyPix() {
  if (bpNet) return bpNet;

  setProgress(10, 'Đang tải TensorFlow.js...');
  await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js');

  setProgress(25, 'Đang tải BodyPix...');
  await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/body-pix@2.2.0/dist/body-pix.min.js');

  setProgress(40, 'Đang tải model (~13MB lần đầu)...');
  bpNet = await window.bodyPix.load({
    architecture: 'MobileNetV1',
    outputStride: 16,
    multiplier: 0.75,
    quantBytes: 2
  });

  setProgress(60, 'Model sẵn sàng!');
  return bpNet;
}

$('removeBgBtn').addEventListener('click', async () => {
  if (!editOriginal) { toast('⚠️ Hãy upload ảnh trước'); return; }
  const btn = $('removeBgBtn');
  btn.disabled = true;
  $('removeProgressWrap').style.display = '';
  $('removeResultBtns').style.display = 'none';
  setProgress(5, 'Khởi động...');

  try {
    const net = await initBodyPix();

    setProgress(65, 'AI đang phân tích ảnh...');

    // BodyPix cần HTMLImageElement hoặc HTMLCanvasElement
    const segmentation = await net.segmentPerson(editCanvas, {
      flipHorizontal: false,
      internalResolution: 'medium',
      segmentationThreshold: 0.7
    });

    setProgress(85, 'Đang áp dụng mask...');

    const W = editCanvas.width, H = editCanvas.height;
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const outCtx = out.getContext('2d');
    outCtx.drawImage(editCanvas, 0, 0, W, H);
    const px = outCtx.getImageData(0, 0, W, H);

    // segmentation.data: Uint8Array, 1 byte per pixel, 1=person 0=background
    // Scale mask từ segmentation size về canvas size
    const segW = segmentation.width, segH = segmentation.height;
    const data  = segmentation.data;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const sx = Math.round(x * segW / W);
        const sy = Math.round(y * segH / H);
        const si = sy * segW + sx;
        const pi = (y * W + x) * 4;
        px.data[pi + 3] = data[si] === 1 ? 255 : 0;
      }
    }
    outCtx.putImageData(px, 0, 0);

    setProgress(100, '✅ Xóa nền hoàn thành!');
    const blob = await new Promise(r => out.toBlob(r, 'image/png'));
    if (removedBlobUrl) URL.revokeObjectURL(removedBlobUrl);
    removedBlobUrl = URL.createObjectURL(blob);
    $('removedImg').src = removedBlobUrl;
    $('removeResultBtns').style.display = '';
    switchStage('remove');
    setTimeout(() => { $('removeProgressWrap').style.display = 'none'; }, 900);
    toast('✅ Xóa nền thành công!');

  } catch (err) {
    console.error('[BG]', err);
    bpNet = null;
    setProgress(0, '❌ ' + (err.message || err).toString().slice(0, 90));
    toast('❌ ' + (err.message || 'Lỗi không xác định').slice(0, 60), 5000);
  } finally {
    btn.disabled = false;
  }
});

$('downloadRemovedBtn').addEventListener('click', () => {
  if (!removedBlobUrl) return;
  saveFile(removedBlobUrl, `no-bg-${Date.now()}.png`);
});

$('useForCompositeBtn').addEventListener('click', () => {
  if (!removedBlobUrl) return;
  loadSubjectFromUrl(removedBlobUrl);
  switchStage('composite');
  toast('✅ Sẵn sàng ghép nền!');
});

// ══════════════════════════════════════════════════
//  COMPOSITE
//  Ảnh nền: tạo bằng Canvas gradient (không cần CORS)
//  + cho phép upload ảnh nền tự chọn
// ══════════════════════════════════════════════════
const CW = 400, CH = 711;
const compCanvas = $('compositeCanvas');
const compCtx    = compCanvas.getContext('2d');
compCanvas.width  = CW;
compCanvas.height = CH;

let subjectImg = null, bgImg = null;
let subX = CW/2, subY = CH/2, subScale = 1.0;
let dragging = false, dOffX = 0, dOffY = 0;
let bgInited = false;

// Định nghĩa 30 gradient backgrounds đẹp theo category
const BG_PRESETS = {
  nature: [
    { type:'grad', stops:['#0f4c2a','#1a7a40','#2ecc71','#a8edaf'] },
    { type:'grad', stops:['#1a3a1a','#2d5a1b','#4a8a2a','#87c77a'] },
    { type:'grad', stops:['#003d2b','#005e3a','#007a48','#00a86b'] },
    { type:'grad', stops:['#0d2818','#1b4d2e','#2e7d4f','#52b788'] },
    { type:'grad', stops:['#1b4332','#2d6a4f','#40916c','#74c69d'] },
    { type:'grad', stops:['#081c15','#1b4332','#2d6a4f','#52b788'] },
  ],
  city: [
    { type:'grad', stops:['#0a0a1a','#1a1a3a','#2a2a6a','#4a4a9a'] },
    { type:'grad', stops:['#0d0d2b','#1a1a4a','#23235e','#3a3a8a'] },
    { type:'grad', stops:['#050510','#0f0f2e','#1a1a50','#2d2d8a'] },
    { type:'grad', stops:['#10002b','#240046','#3c096c','#5a189a'] },
    { type:'grad', stops:['#03045e','#023e8a','#0077b6','#00b4d8'] },
    { type:'grad', stops:['#14213d','#1d3461','#2660a4','#4a93cf'] },
  ],
  abstract: [
    { type:'grad', stops:['#3a0ca3','#4361ee','#4cc9f0','#f72585'] },
    { type:'grad', stops:['#10002b','#3d0066','#7209b7','#b5179e'] },
    { type:'grad', stops:['#f72585','#b5179e','#7209b7','#560bad'] },
    { type:'grad', stops:['#240046','#3a0ca3','#4361ee','#4cc9f0'] },
    { type:'grad', stops:['#6a00f4','#8900f2','#a100f2','#bc00dd'] },
    { type:'grad', stops:['#ff0a54','#ff477e','#ff7096','#ff85a1'] },
  ],
  beach: [
    { type:'grad', stops:['#0077b6','#00b4d8','#90e0ef','#f4d35e'] },
    { type:'grad', stops:['#023e8a','#0096c7','#48cae4','#ade8f4'] },
    { type:'grad', stops:['#0d47a1','#1565c0','#42a5f5','#80d8ff'] },
    { type:'grad', stops:['#1a237e','#0288d1','#4fc3f7','#b3e5fc'] },
    { type:'grad', stops:['#004e92','#000428','#4fc3f7','#ffd166'] },
    { type:'grad', stops:['#2193b0','#6dd5ed','#c8e6c9','#fff9c4'] },
  ],
  mountain: [
    { type:'grad', stops:['#1c1c2e','#2d2d44','#4a4e69','#9a8c98'] },
    { type:'grad', stops:['#0f0f1a','#1a1a2e','#16213e','#0f3460'] },
    { type:'grad', stops:['#2b2d42','#4a4e69','#9a8c98','#c9ada7'] },
    { type:'grad', stops:['#1a1a2e','#2a2a4e','#4a3f6b','#7c5c8a'] },
    { type:'grad', stops:['#0b090a','#161a1d','#212529','#6c757d'] },
    { type:'grad', stops:['#22223b','#4a4e69','#9a8c98','#f2e9e4'] },
  ],
};

function renderGradientBg(preset, canvas) {
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, canvas.width * 0.3, canvas.height);
  const stops = preset.stops;
  stops.forEach((c, i) => grad.addColorStop(i / (stops.length - 1), c));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Thêm texture nhẹ
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 8; i++) {
    const rg = ctx.createRadialGradient(
      Math.random() * canvas.width, Math.random() * canvas.height, 0,
      Math.random() * canvas.width, Math.random() * canvas.height,
      canvas.width * 0.6
    );
    rg.addColorStop(0, 'rgba(255,255,255,0.8)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.globalAlpha = 1;
}

function makeThumbnailDataURL(preset) {
  const c = document.createElement('canvas');
  c.width = 80; c.height = 142;
  renderGradientBg(preset, c);
  return c.toDataURL('image/jpeg', 0.8);
}

function makeBgImage(preset) {
  const c = document.createElement('canvas');
  c.width = CW; c.height = CH;
  renderGradientBg(preset, c);
  const img = new Image();
  img.src = c.toDataURL('image/jpeg', 0.95);
  return img;
}

let bgCat = 'nature';

function initBgGallery() {
  bgInited = true;
  renderBgCategory(bgCat);
}

function renderBgCategory(cat) {
  const grid = $('bgGrid');
  grid.innerHTML = '';
  const presets = BG_PRESETS[cat] || BG_PRESETS.nature;
  presets.forEach((preset, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'bg-thumb';
    const img = document.createElement('img');
    img.src = makeThumbnailDataURL(preset);
    wrap.appendChild(img);
    wrap.addEventListener('click', () => {
      document.querySelectorAll('.bg-thumb').forEach(t => t.classList.remove('selected'));
      wrap.classList.add('selected');
      bgImg = makeBgImage(preset);
      bgImg.onload = () => {
        renderComposite();
        if (subjectImg) $('compositeDownloadRow').style.display = '';
      };
    });
    grid.appendChild(wrap);
  });

  // Thêm ô "Upload ảnh nền"
  const uploadWrap = document.createElement('div');
  uploadWrap.className = 'bg-thumb bg-upload-btn';
  uploadWrap.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:11px;gap:6px"><span style="font-size:24px">📁</span>Tải ảnh nền</div>`;
  uploadWrap.addEventListener('click', () => bgFileInput.click());
  grid.appendChild(uploadWrap);
}

// Hidden input for custom bg upload
const bgFileInput = document.createElement('input');
bgFileInput.type = 'file'; bgFileInput.accept = 'image/*'; bgFileInput.style.display = 'none';
document.body.appendChild(bgFileInput);
bgFileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    bgImg = img;
    renderComposite();
    if (subjectImg) $('compositeDownloadRow').style.display = '';
    toast('✅ Đã chọn ảnh nền!');
    URL.revokeObjectURL(url);
  };
  img.src = url;
  bgFileInput.value = '';
});

$('bgChips').addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  document.querySelectorAll('#bgChips .chip').forEach(c => c.classList.toggle('active', c === chip));
  bgCat = chip.dataset.cat;
  renderBgCategory(bgCat);
});

function loadSubjectFromUrl(url) {
  const img = new Image();
  img.onload = () => {
    subjectImg = img;
    const s = Math.min((CW * 0.65) / img.naturalWidth, (CH * 0.65) / img.naturalHeight, 1);
    subScale = s;
    $('sScale').value = Math.round(s * 100);
    $('vScale').textContent = Math.round(s * 100) + '%';
    subX = CW / 2; subY = CH * 0.58;
    $('scaleRowWrap').style.display   = '';
    $('dragHint').classList.add('show');
    if (bgImg) $('compositeDownloadRow').style.display = '';
    renderComposite();
  };
  img.src = url;
}

$('sScale').addEventListener('input', () => {
  subScale = +$('sScale').value / 100;
  $('vScale').textContent = $('sScale').value + '%';
  renderComposite();
});

function renderComposite() {
  compCtx.clearRect(0, 0, CW, CH);
  if (bgImg) {
    try { compCtx.drawImage(bgImg, 0, 0, CW, CH); }
    catch { compCtx.fillStyle='#1c1c2e'; compCtx.fillRect(0,0,CW,CH); }
  } else {
    compCtx.fillStyle = '#1c1c2e'; compCtx.fillRect(0, 0, CW, CH);
  }
  if (subjectImg) {
    const dw = subjectImg.naturalWidth  * subScale;
    const dh = subjectImg.naturalHeight * subScale;
    compCtx.drawImage(subjectImg, subX - dw/2, subY - dh/2, dw, dh);
  }
}

function ptOnCanvas(e) {
  const r = compCanvas.getBoundingClientRect();
  const sx = CW / r.width, sy = CH / r.height;
  const src = e.touches ? e.touches[0] : e;
  return { x: (src.clientX - r.left)*sx, y: (src.clientY - r.top)*sy };
}

compCanvas.addEventListener('mousedown', e => {
  if (!subjectImg) return;
  const p = ptOnCanvas(e); dOffX = p.x - subX; dOffY = p.y - subY; dragging = true;
});
window.addEventListener('mousemove', e => {
  if (!dragging) return;
  const p = ptOnCanvas(e); subX = p.x - dOffX; subY = p.y - dOffY; renderComposite();
});
window.addEventListener('mouseup', () => { dragging = false; });
compCanvas.addEventListener('touchstart', e => {
  if (!subjectImg) return; e.preventDefault();
  const p = ptOnCanvas(e); dOffX = p.x - subX; dOffY = p.y - subY; dragging = true;
}, { passive: false });
window.addEventListener('touchmove', e => {
  if (!dragging) return; e.preventDefault();
  const p = ptOnCanvas(e); subX = p.x - dOffX; subY = p.y - dOffY; renderComposite();
}, { passive: false });
window.addEventListener('touchend', () => { dragging = false; });

$('downloadCompositeBtn').addEventListener('click', () => {
  if (!bgImg && !subjectImg) { toast('⚠️ Chưa đủ ảnh'); return; }
  const S = 2, off = document.createElement('canvas');
  off.width = CW*S; off.height = CH*S;
  const ctx = off.getContext('2d'); ctx.scale(S, S);
  if (bgImg) ctx.drawImage(bgImg, 0, 0, CW, CH);
  else { ctx.fillStyle='#1c1c2e'; ctx.fillRect(0,0,CW,CH); }
  if (subjectImg) {
    const dw = subjectImg.naturalWidth*subScale, dh = subjectImg.naturalHeight*subScale;
    ctx.drawImage(subjectImg, subX-dw/2, subY-dh/2, dw, dh);
  }
  saveFile(dataURLtoBlob(off.toDataURL('image/jpeg', 0.93)), `composite-${Date.now()}.jpg`);
});
