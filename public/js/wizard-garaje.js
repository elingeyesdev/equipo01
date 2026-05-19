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
  if (el) { el.classList.add('open'); document.body.style.overflow = 'hidden'; }
  wizardGoTo(1);
}

function closeWizard() {
  const el = document.getElementById('wizardOverlay');
  if (el) { el.classList.remove('open'); document.body.style.overflow = ''; }
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
    let { espacios } = exportarMapa();
    if (espacios.length === 0) {
      // Auto-generate from the selected capacity before blocking the user
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

// ── Auto-generate tilemap from capacity ─────────────────────
function autoGenerarPlano(numEspacios) {
  if (numEspacios < 1) numEspacios = 1;
  if (numEspacios > 50) numEspacios = 50;

  const spotsPerRow = Math.min(numEspacios <= 4 ? numEspacios : Math.ceil(numEspacios / Math.ceil(numEspacios / 6)), 8);
  const parkingRows = Math.ceil(numEspacios / spotsPerRow);
  const gridCols = spotsPerRow + 2;

  // Calculate rows: top wall + (parking + aisle) pairs + bottom wall
  const innerRows = [];
  for (let pr = 0; pr < parkingRows; pr++) {
    if (pr > 0) innerRows.push('aisle');
    innerRows.push('parking');
  }
  const gridRows = innerRows.length + 2;

  // Init matrix
  const matrix = [];
  for (let r = 0; r < gridRows; r++) {
    matrix[r] = [];
    for (let c = 0; c < gridCols; c++) {
      matrix[r][c] = { tile: 'empty', tipo_vehiculo: 'auto', adir: 'h', num: 0 };
    }
  }

  // Border walls
  for (let c = 0; c < gridCols; c++) {
    matrix[0][c] = { tile: 'wall', tipo_vehiculo: 'auto', adir: 'h', num: 0 };
    matrix[gridRows - 1][c] = { tile: 'wall', tipo_vehiculo: 'auto', adir: 'h', num: 0 };
  }
  for (let r = 0; r < gridRows; r++) {
    matrix[r][0] = { tile: 'wall', tipo_vehiculo: 'auto', adir: 'h', num: 0 };
    matrix[r][gridCols - 1] = { tile: 'wall', tipo_vehiculo: 'auto', adir: 'h', num: 0 };
  }

  // Entrance & Exit
  const midCol = Math.floor(gridCols / 2);
  matrix[0][midCol] = { tile: 'entrance', tipo_vehiculo: 'auto', adir: 'h', num: 0 };
  matrix[gridRows - 1][midCol] = { tile: 'exit', tipo_vehiculo: 'auto', adir: 'h', num: 0 };

  // Fill inner rows
  let placed = 0;
  let rowIdx = 1;
  for (const rowType of innerRows) {
    for (let c = 1; c < gridCols - 1; c++) {
      if (rowType === 'aisle') {
        matrix[rowIdx][c] = { tile: 'aisle', tipo_vehiculo: 'auto', adir: 'h', num: 0 };
      } else if (rowType === 'parking' && placed < numEspacios) {
        placed++;
        matrix[rowIdx][c] = { tile: 'parking', tipo_vehiculo: 'auto', adir: 'h', num: placed };
      }
    }
    rowIdx++;
  }

  // Compute aisle directions
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      if (matrix[r][c].tile === 'aisle') {
        matrix[r][c].adir = computeAisleDirFromNeighborsMatrix(matrix, r, c);
      }
    }
  }

  return { matrix, rows: gridRows, cols: gridCols };
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

function aplicarAutoPlano() {
  const capEl = document.getElementById('wzCapNumber');
  const num = capEl ? parseInt(capEl.textContent) : 4;
  const result = autoGenerarPlano(num);

  // Apply to tilemap engine
  tmFilasVal = result.rows;
  tmColsVal = result.cols;
  tmMatriz = result.matrix;
  if (document.getElementById('tmFilas')) document.getElementById('tmFilas').value = result.rows;
  if (document.getElementById('tmColumnas')) document.getElementById('tmColumnas').value = result.cols;
  tmRenderGrilla();
  tmActualizarStats();

  // Show confirmation card
  const parkingCount = result.matrix.flat().filter(c => c.tile === 'parking').length;
  const resultEl = document.getElementById('wzAutoGenResult');
  const msgEl = document.getElementById('wzAutoGenMsg');
  if (resultEl) {
    if (msgEl) msgEl.textContent = `Plano generado: ${parkingCount} espacio${parkingCount !== 1 ? 's' : ''} de parqueo`;
    resultEl.style.display = 'flex';
  }
}

// ── Capacity +/- buttons ────────────────────────────────────
function wzCapIncrement(delta) {
  const el = document.getElementById('wzCapNumber');
  if (!el) return;
  let val = parseInt(el.textContent) + delta;
  if (val < 1) val = 1;
  if (val > 50) val = 50;
  el.textContent = val;
}

// ── Toggle 2D map customization ─────────────────────────────
function wzToggleMap() {
  const card = document.getElementById('wzToggleMapCard');
  const editor = document.getElementById('wzMapEditorSection');
  if (!card) return;
  card.classList.toggle('selected');
  const isOn = card.classList.contains('selected');
  if (editor) editor.style.display = isOn ? 'block' : 'none';
  if (isOn) aplicarAutoPlano();
}

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

  // Toggle map card
  const toggleCard = document.getElementById('wzToggleMapCard');
  if (toggleCard) toggleCard.addEventListener('click', wzToggleMap);

  // Auto-generate button
  const btnAutoGen = document.getElementById('btnAutoGenPlano');
  if (btnAutoGen) btnAutoGen.addEventListener('click', aplicarAutoPlano);

  // Sync comodidades de seguridad → Nivel de Seguridad
  document.querySelectorAll('input[name="comodidad"][value="cctv"], input[name="comodidad"][value="vigilancia"]')
    .forEach(cb => cb.addEventListener('change', sincronizarNivelSeguridad));

  // Initialize at step 1
  wizardGoTo(1);
}
