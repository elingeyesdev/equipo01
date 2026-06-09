// ============================================================
// EstAirbnb — Wizard Garaje (Multi-step Form)
// ============================================================

const WIZARD_TOTAL_STEPS = 6;
let wizardCurrentStep = 1;

// ── DOM refs ────────────────────────────────────────────────
function getWizardEls() {
  return {
    overlay: document.getElementById('wizardOverlay'),
    panels: document.querySelectorAll('.wizard-panel'),
    stepItems: document.querySelectorAll('.wizard-step-item'),
    progressLine: document.getElementById('wizardProgressLine'),
    btnPrev: document.getElementById('btnWizardPrev'),
    btnNext: document.getElementById('btnWizardNext'),
    btnSubmit: document.getElementById('btnWizardSubmit'),
    stepCounter: document.getElementById('wizardStepCounter'),
  };
}

// ── Open / Close ────────────────────────────────────────────
function openWizard() {
  const el = document.getElementById('wizardOverlay');
  if (el) {
    el.classList.add('open');
    document.body.style.overflow = 'hidden';
    document.dispatchEvent(new CustomEvent('estairbnb:wizard-opened'));
  }
  wizardGoTo(1);
}

function closeWizard() {
  const el = document.getElementById('wizardOverlay');
  if (el) {
    el.classList.remove('open');
    document.body.style.overflow = '';
    document.dispatchEvent(new CustomEvent('estairbnb:wizard-closed'));
  }
}

// keep legacy functions working
function openModalFormulario() { openWizard(); }
function closeModalFormulario() { closeWizard(); }

// ── Navigation ──────────────────────────────────────────────
function wizardGoTo(step) {
  const w = getWizardEls();
  wizardCurrentStep = step;

  // Panels
  w.panels.forEach(p => {
    p.classList.toggle('active', parseInt(p.dataset.step) === step);
  });

  // Step indicators
  w.stepItems.forEach(item => {
    const s = parseInt(item.dataset.step);
    item.classList.remove('active', 'completed');
    if (s === step) item.classList.add('active');
    else if (s < step) item.classList.add('completed');
  });

  // Progress line
  const pct = ((step - 1) / (WIZARD_TOTAL_STEPS - 1)) * 100;
  const lineParent = w.progressLine?.parentElement;
  if (w.progressLine && lineParent) {
    const navWidth = lineParent.querySelector('.wizard-steps-nav')?.offsetWidth || 1;
    const inset = 64; // approximate circle inset from edges
    const usable = navWidth - inset;
    w.progressLine.style.width = (pct / 100 * usable) + 'px';
  }

  // Buttons
  if (w.btnPrev) w.btnPrev.style.display = step === 1 ? 'none' : '';
  if (w.btnNext) w.btnNext.style.display = step === WIZARD_TOTAL_STEPS ? 'none' : '';
  if (w.btnSubmit) w.btnSubmit.style.display = step === WIZARD_TOTAL_STEPS ? '' : 'none';
  if (w.stepCounter) w.stepCounter.textContent = `Paso ${step} de ${WIZARD_TOTAL_STEPS}`;

  // Scroll body to top
  const body = document.querySelector('.wizard-body');
  if (body) body.scrollTop = 0;
}

function wizardNext() {
  if (!validateWizardStep(wizardCurrentStep)) return;
  if (wizardCurrentStep < WIZARD_TOTAL_STEPS) {
    // Before going to step 6 (summary), build summary
    if (wizardCurrentStep === 5) buildWizardSummary();
    wizardGoTo(wizardCurrentStep + 1);
  }
}

function wizardPrev() {
  if (wizardCurrentStep > 1) wizardGoTo(wizardCurrentStep - 1);
}

// ── Validation ──────────────────────────────────────────────
function validateWizardStep(step) {
  clearWizardErrors();
  let valid = true;

  if (step === 1) {
    const dir = document.getElementById('inpDireccion');
    if (!dir || dir.value.trim().length < 5) {
      setWizardError(dir, 'Mínimo 5 caracteres');
      valid = false;
    }
  }

  if (step === 2) {
    const precio = document.getElementById('inpPrecio');
    if (!precio || !precio.value || Number(precio.value) <= 0) {
      setWizardError(precio, 'Ingresa un precio válido');
      valid = false;
    }
    if (horariosConfigurados.length === 0) {
      showToast('Agrega al menos un horario de disponibilidad.', 'error');
      valid = false;
    }
  }

  if (step === 3) {
    // Security step - optional fields, always valid
  }

  if (step === 4) {
    // Auto-select "En línea" if the user skipped template selection
    if (!wizardSelectedTemplate) wizardSelectTemplate('linea');
    let { espacios } = exportarMapa();
    if (espacios.length === 0) {
      aplicarAutoPlano();
      espacios = exportarMapa().espacios;
    }
    if (espacios.length === 0) {
      showToast('Coloca al menos 1 espacio de parqueo en el mapa.', 'error');
      valid = false;
    }
  }

  return valid;
}

function setWizardError(input, msg) {
  if (!input) return;
  const field = input.closest('.wz-field');
  if (field) {
    field.classList.add('wz-field-error');
    const errEl = field.querySelector('.wz-error-msg');
    if (errEl) errEl.textContent = msg;
  }
  input.focus();
}

function clearWizardErrors() {
  document.querySelectorAll('.wz-field-error').forEach(f => f.classList.remove('wz-field-error'));
}

// ── Template selection state ─────────────────────────────────
let wizardSelectedTemplate = null;
let wzAdvancedMode = false;

// ── Shared helper ────────────────────────────────────────────
function mkCell(tile, num) {
  return { tile, tipo_vehiculo: 'auto', adir: 'h', num: num || 0 };
}

function computeAisleDirFromNeighborsMatrix(mat, r, c) {
  const R = mat.length, C = mat[0].length;
  const hasN = r > 0 && mat[r-1][c].tile === 'aisle';
  const hasS = r < R-1 && mat[r+1][c].tile === 'aisle';
  const hasE = c < C-1 && mat[r][c+1].tile === 'aisle';
  const hasW = c > 0 && mat[r][c-1].tile === 'aisle';
  const v = hasN || hasS, h = hasE || hasW;
  if (v && h) return 'cross';
  if (v) return 'v';
  return 'h';
}

function fixAisleDirs(matrix) {
  for (let r = 0; r < matrix.length; r++)
    for (let c = 0; c < matrix[0].length; c++)
      if (matrix[r][c].tile === 'aisle')
        matrix[r][c].adir = computeAisleDirFromNeighborsMatrix(matrix, r, c);
}

function initMatrix(rows, cols) {
  const m = [];
  for (let r = 0; r < rows; r++) {
    m[r] = [];
    for (let c = 0; c < cols; c++) m[r][c] = mkCell('empty');
  }
  return m;
}

// ── Generator: En línea ──────────────────────────────────────
// ENT at top-left, SAL at bottom-right — never same column
function autoGenerarLinea(n) {
  if (n < 1) n = 1;
  const spr = Math.min(n <= 4 ? n : Math.min(Math.ceil(n / Math.ceil(n / 6)), 8), 8);
  const pRows = Math.ceil(n / spr);
  const gridCols = spr + 2;

  // Rows: top_wall + (parking [+ aisle]) × pRows + bottom_wall
  const innerSeq = [];
  for (let pr = 0; pr < pRows; pr++) {
    if (pr > 0) innerSeq.push('aisle');
    innerSeq.push('parking');
  }
  const gridRows = innerSeq.length + 2;

  const m = initMatrix(gridRows, gridCols);

  // Border walls
  for (let c = 0; c < gridCols; c++) { m[0][c] = mkCell('wall'); m[gridRows-1][c] = mkCell('wall'); }
  for (let r = 1; r < gridRows-1; r++) { m[r][0] = mkCell('wall'); m[r][gridCols-1] = mkCell('wall'); }

  // ENT top-left, SAL bottom-right (opposite corners)
  m[0][1] = mkCell('entrance');
  m[gridRows-1][gridCols-2] = mkCell('exit');

  // Fill spots
  let placed = 0;
  let ri = 1;
  for (const type of innerSeq) {
    for (let c = 1; c < gridCols-1; c++) {
      if (type === 'aisle') m[ri][c] = mkCell('aisle');
      else if (type === 'parking' && placed < n) { placed++; m[ri][c] = mkCell('parking', placed); }
    }
    ri++;
  }

  fixAisleDirs(m);
  return { matrix: m, rows: gridRows, cols: gridCols };
}

// ── Generator: En L ─────────────────────────────────────────
// Horizontal arm top, vertical arm right side, ENT top-left, SAL bottom-right
function autoGenerarEle(n) {
  if (n < 4) return autoGenerarLinea(n);

  const hSpots = Math.ceil(n / 2);
  const vSpots = n - hSpots;
  // cols: wall(0) + hSpots + aisleCol + vParkingCol + wall
  const gridCols = hSpots + 4;
  // rows: top_wall + vSpots_rows (row 1 is shared h+v1) + bottom_wall
  const gridRows = vSpots + 2;

  const m = initMatrix(gridRows, gridCols);

  // Full border walls
  for (let c = 0; c < gridCols; c++) { m[0][c] = mkCell('wall'); m[gridRows-1][c] = mkCell('wall'); }
  for (let r = 0; r < gridRows; r++) { m[r][0] = mkCell('wall'); m[r][gridCols-1] = mkCell('wall'); }

  // ENT top-left, SAL bottom-right
  m[0][1] = mkCell('entrance');
  m[gridRows-1][gridCols-2] = mkCell('exit');

  // Horizontal parking row (row 1, cols 1..hSpots)
  let placed = 0;
  for (let c = 1; c <= hSpots; c++) { placed++; m[1][c] = mkCell('parking', placed); }

  // Aisle column (col hSpots+1) connects horizontal to vertical arm
  const aisleCol = hSpots + 1;
  for (let r = 1; r < gridRows-1; r++) m[r][aisleCol] = mkCell('aisle');

  // Vertical parking column (col hSpots+2 = gridCols-2), rows 1..vSpots
  const vCol = gridCols - 2;
  for (let i = 0; i < vSpots; i++) {
    placed++;
    m[1 + i][vCol] = mkCell('parking', placed);
  }

  fixAisleDirs(m);
  return { matrix: m, rows: gridRows, cols: gridCols };
}

// ── Generator: Patio (dos filas enfrentadas) ─────────────────
// ENT top-left, SAL bottom-right
function autoGenerarPatio(n) {
  if (n < 4) return autoGenerarLinea(n);

  const spr = Math.min(Math.ceil(n / 2), 8);
  const numGroups = Math.ceil(n / (spr * 2));
  const gridCols = spr + 2;
  // Each group: top_row + aisle + bottom_row → 3 rows per group, plus top and bottom walls
  const gridRows = 2 + numGroups * 3;

  const m = initMatrix(gridRows, gridCols);

  // Border walls
  for (let c = 0; c < gridCols; c++) { m[0][c] = mkCell('wall'); m[gridRows-1][c] = mkCell('wall'); }
  for (let r = 1; r < gridRows-1; r++) { m[r][0] = mkCell('wall'); m[r][gridCols-1] = mkCell('wall'); }

  // ENT top-left, SAL bottom-right
  m[0][1] = mkCell('entrance');
  m[gridRows-1][gridCols-2] = mkCell('exit');

  let placed = 0;
  for (let g = 0; g < numGroups; g++) {
    const topRow    = 1 + g * 3;
    const aisleRow  = topRow + 1;
    const botRow    = topRow + 2;

    for (let c = 1; c < gridCols-1; c++) m[aisleRow][c] = mkCell('aisle');

    for (let c = 1; c < gridCols-1; c++) {
      if (placed < n) { placed++; m[topRow][c] = mkCell('parking', placed); }
    }
    for (let c = 1; c < gridCols-1; c++) {
      if (placed < n) { placed++; m[botRow][c] = mkCell('parking', placed); }
    }
  }

  fixAisleDirs(m);
  return { matrix: m, rows: gridRows, cols: gridCols };
}

// ── Template UI selection ────────────────────────────────────
function wizardSelectTemplate(tpl) {
  wizardSelectedTemplate = tpl;

  // Update card highlights
  ['linea','ele','patio'].forEach(t => {
    const el = document.getElementById('tpl' + t.charAt(0).toUpperCase() + t.slice(1));
    if (el) el.classList.toggle('selected', t === tpl);
  });

  // Regenerate map and show preview
  aplicarAutoPlano();

  const section = document.getElementById('wzMapEditorSection');
  if (section) {
    section.style.display = 'block';
    // Stay in preview mode (not advanced) on new selection
    if (!wzAdvancedMode) {
      section.classList.remove('advanced-mode');
      section.classList.add('preview-mode');
    }
  }
  const errEl = document.getElementById('tilemapError');
  if (errEl) errEl.style.display = 'none';
}

// ── Advanced mode toggle ─────────────────────────────────────
function wzToggleAdvanced() {
  wzAdvancedMode = !wzAdvancedMode;
  const section = document.getElementById('wzMapEditorSection');
  const icon    = document.getElementById('wzAdvIcon');
  const label   = document.getElementById('wzAdvLabel');
  const previewLabel = document.getElementById('wzPreviewLabel');

  if (section) {
    section.classList.toggle('advanced-mode', wzAdvancedMode);
    section.classList.toggle('preview-mode', !wzAdvancedMode);
  }
  if (icon)  icon.textContent  = wzAdvancedMode ? 'visibility'   : 'edit_square';
  if (label) label.textContent = wzAdvancedMode ? 'Volver a vista previa' : 'Editar manualmente';
  if (previewLabel) previewLabel.textContent = wzAdvancedMode ? 'Editor del estacionamiento' : 'Vista del estacionamiento';
}

// ── Dispatch to correct generator ────────────────────────────
// Safer auto-layouts: the entrance/exit are connected by a clear drive aisle,
// and parking spots are only placed beside that aisle.
function autoGenerarLinea(n) {
  if (n < 1) n = 1;
  const spotCols = Math.min(6, Math.max(2, Math.ceil(Math.min(n, 12) / 2)));
  const bandCapacity = spotCols * 2;
  const bands = Math.ceil(n / bandCapacity);
  const gridCols = spotCols + 4;
  const gridRows = 2 + bands * 3;
  const m = initMatrix(gridRows, gridCols);

  for (let c = 0; c < gridCols; c++) {
    m[0][c] = mkCell('wall');
    m[gridRows - 1][c] = mkCell('wall');
  }
  for (let r = 1; r < gridRows - 1; r++) {
    m[r][0] = mkCell('wall');
    m[r][gridCols - 1] = mkCell('wall');
  }

  let placed = 0;
  for (let g = 0; g < bands; g++) {
    const topRow = 1 + g * 3;
    const aisleRow = topRow + 1;
    const bottomRow = topRow + 2;

    for (let r = topRow; r <= bottomRow; r++) m[r][1] = mkCell('aisle');
    for (let c = 1; c < gridCols - 1; c++) m[aisleRow][c] = mkCell('aisle');

    for (let c = 2; c < gridCols - 1 && placed < n; c++) {
      placed++;
      m[topRow][c] = mkCell('parking', placed);
    }
    for (let c = 2; c < gridCols - 1 && placed < n; c++) {
      placed++;
      m[bottomRow][c] = mkCell('parking', placed);
    }
  }

  m[1][0] = mkCell('entrance');
  m[1 + (bands - 1) * 3 + 1][gridCols - 1] = mkCell('exit');
  fixAisleDirs(m);
  return { matrix: m, rows: gridRows, cols: gridCols };
}

function autoGenerarEle(n) {
  if (n < 4) return autoGenerarLinea(n);

  const hSpots = Math.min(Math.ceil(n / 2), 7);
  const vRows = Math.max(2, Math.ceil((n - hSpots) / 2));
  const gridCols = hSpots + 4;
  const gridRows = Math.max(5, vRows + 4);
  const aisleRow = 1;
  const aisleCol = gridCols - 2;
  const m = initMatrix(gridRows, gridCols);

  for (let c = 0; c < gridCols; c++) {
    m[0][c] = mkCell('wall');
    m[gridRows - 1][c] = mkCell('wall');
  }
  for (let r = 0; r < gridRows; r++) {
    m[r][0] = mkCell('wall');
    m[r][gridCols - 1] = mkCell('wall');
  }

  let placed = 0;
  m[aisleRow][0] = mkCell('entrance');
  for (let c = 1; c <= aisleCol; c++) m[aisleRow][c] = mkCell('aisle');
  for (let r = aisleRow; r < gridRows - 1; r++) m[r][aisleCol] = mkCell('aisle');
  m[gridRows - 1][aisleCol] = mkCell('exit');

  for (let c = 1; c < aisleCol && placed < n; c++) {
    placed++;
    m[2][c] = mkCell('parking', placed);
  }
  for (let r = 3; r < gridRows - 1 && placed < n; r++) {
    placed++;
    m[r][aisleCol - 1] = mkCell('parking', placed);
  }
  for (let r = 3; r < gridRows - 1 && placed < n; r++) {
    placed++;
    m[r][aisleCol - 2] = mkCell('parking', placed);
  }

  fixAisleDirs(m);
  return { matrix: m, rows: gridRows, cols: gridCols };
}

function autoGenerarPatio(n) {
  if (n < 4) return autoGenerarLinea(n);

  const perSide = Math.min(6, Math.max(2, Math.ceil(Math.min(n, 12) / 2)));
  const groups = Math.ceil(n / (perSide * 2));
  const gridCols = perSide + 4;
  const gridRows = 2 + groups * 4;
  const m = initMatrix(gridRows, gridCols);

  for (let c = 0; c < gridCols; c++) {
    m[0][c] = mkCell('wall');
    m[gridRows - 1][c] = mkCell('wall');
  }
  for (let r = 1; r < gridRows - 1; r++) {
    m[r][0] = mkCell('wall');
    m[r][gridCols - 1] = mkCell('wall');
  }

  let placed = 0;
  for (let g = 0; g < groups; g++) {
    const base = 1 + g * 4;
    const topRow = base;
    const aisleRow = base + 1;
    const bottomRow = base + 2;
    const bufferRow = base + 3;

    for (let r = topRow; r <= bufferRow; r++) m[r][1] = mkCell('aisle');
    for (let c = 1; c < gridCols - 1; c++) m[aisleRow][c] = mkCell('aisle');

    for (let c = 2; c < gridCols - 1 && placed < n; c++) {
      placed++;
      m[topRow][c] = mkCell('parking', placed);
    }
    for (let c = 2; c < gridCols - 1 && placed < n; c++) {
      placed++;
      m[bottomRow][c] = mkCell('parking', placed);
    }
  }

  m[1][0] = mkCell('entrance');
  m[1 + (groups - 1) * 4 + 1][gridCols - 1] = mkCell('exit');
  fixAisleDirs(m);
  return { matrix: m, rows: gridRows, cols: gridCols };
}

function autoGenerarPlano(numEspacios) {
  if (numEspacios < 1) numEspacios = 1;
  if (numEspacios > 50) numEspacios = 50;
  const tpl = wizardSelectedTemplate || 'linea';
  if (tpl === 'ele')   return autoGenerarEle(numEspacios);
  if (tpl === 'patio') return autoGenerarPatio(numEspacios);
  return autoGenerarLinea(numEspacios);
}

function aplicarAutoPlano() {
  const capEl = document.getElementById('wzCapNumber');
  const num = capEl ? parseInt(capEl.textContent) : 4;
  const result = autoGenerarPlano(num);

  tmFilasVal = result.rows;
  tmColsVal  = result.cols;
  tmMatriz   = result.matrix;
  if (document.getElementById('tmFilas'))   document.getElementById('tmFilas').value   = result.rows;
  if (document.getElementById('tmColumnas')) document.getElementById('tmColumnas').value = result.cols;
  tmRenderGrilla();
  tmActualizarStats();
}

// ── Capacity +/- buttons ────────────────────────────────────
function wzCapIncrement(delta) {
  const el = document.getElementById('wzCapNumber');
  if (!el) return;
  let val = parseInt(el.textContent) + delta;
  if (val < 1) val = 1;
  if (val > 50) val = 50;
  el.textContent = val;
  // Regenerate live if a template is already selected
  if (wizardSelectedTemplate) aplicarAutoPlano();
}

// ── Legacy stubs (kept so old event listeners don't crash) ───
function wzToggleMap() {}
function autoGenerarPlanoLegacy(n) { return autoGenerarLinea(n); }

// ── Build summary for step 5 ───────────────────────────────
function buildWizardSummary() {
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };

  setVal('sumDireccion', document.getElementById('inpDireccion')?.value);
  setVal('sumDescripcion', document.getElementById('inpDescripcion')?.value || 'Sin descripción');
  setVal('sumPrecio', 'Bs. ' + (Number(document.getElementById('inpPrecio')?.value) || 0).toFixed(2) + ' /hora');
  setVal('sumSeguridad', document.getElementById('inpNivelSeguridad')?.value);
  setVal('sumAcceso', document.getElementById('inpMetodoAcceso')?.value);

  // Horarios
  const hText = horariosConfigurados.map(h => {
    const mapD = {1:'Lun',2:'Mar',3:'Mié',4:'Jue',5:'Vie',6:'Sáb',0:'Dom'};
    return h.dias.map(d => mapD[d]).join(', ') + ' ' + h.inicio + '–' + h.fin;
  }).join(' | ');
  setVal('sumHorarios', hText || 'No configurados');

  // Parking count
  const { espacios } = exportarMapa();
  setVal('sumEspacios', espacios.length + ' espacio(s)');

  // Comodidades
  const coms = Array.from(document.querySelectorAll('#wizardForm input[name="comodidad"]:checked')).map(c => c.parentElement.textContent.trim());
  setVal('sumComodidades', coms.join(', ') || 'Ninguna');

  // Photos
  setVal('sumFotos', selectedFiles.length + ' foto(s)');
}

// ── Sync comodidades de seguridad → Nivel de Seguridad (paso 3) ─
function sincronizarNivelSeguridad() {
  const hasCCTV      = !!document.querySelector('input[name="comodidad"][value="cctv"]')?.checked;
  const hasVigilancia = !!document.querySelector('input[name="comodidad"][value="vigilancia"]')?.checked;
  const nivelEl      = document.getElementById('inpNivelSeguridad');
  const nivelHint    = document.getElementById('nivelSeguridadHint');
  if (!nivelEl) return;

  let nuevoNivel;
  if (hasCCTV && hasVigilancia)       nuevoNivel = 'Premium';
  else if (hasCCTV || hasVigilancia)  nuevoNivel = 'Estándar';
  else                                nuevoNivel = 'Básico';

  nivelEl.value = nuevoNivel;

  if (nivelHint) {
    const autoSet = hasCCTV || hasVigilancia;
    nivelHint.style.display = autoSet ? 'block' : 'none';
    if (autoSet) {
      const motivo = hasCCTV && hasVigilancia
        ? 'CCTV + Vigilancia 24/7'
        : hasCCTV ? 'CCTV seleccionado' : 'Vigilancia 24/7 seleccionada';
      nivelHint.textContent = `ℹ️ Ajustado a ${nuevoNivel} por: ${motivo}`;
    }
  }
}

// ── Init wizard events ──────────────────────────────────────
function initWizard() {
  const btnNext = document.getElementById('btnWizardNext');
  const btnPrev = document.getElementById('btnWizardPrev');
  if (btnNext) btnNext.addEventListener('click', wizardNext);
  if (btnPrev) btnPrev.addEventListener('click', wizardPrev);

  // Close on overlay click
  const overlay = document.getElementById('wizardOverlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeWizard();
    });
  }

  // Capacity buttons
  const capMinus = document.getElementById('wzCapMinus');
  const capPlus = document.getElementById('wzCapPlus');
  if (capMinus) capMinus.addEventListener('click', () => wzCapIncrement(-1));
  if (capPlus) capPlus.addEventListener('click', () => wzCapIncrement(1));

  // (legacy toggle/auto-gen buttons removed in favour of template cards)

  // Sync comodidades de seguridad → Nivel de Seguridad
  document.querySelectorAll('input[name="comodidad"][value="cctv"], input[name="comodidad"][value="vigilancia"]')
    .forEach(cb => cb.addEventListener('change', sincronizarNivelSeguridad));

  // Initialize at step 1
  wizardGoTo(1);
}
