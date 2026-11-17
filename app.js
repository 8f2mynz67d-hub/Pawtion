// Generate real PNG App Icon & Web Manifest for iOS / Android Home Screen
(function setupAppIconsAndManifest() {
  try {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // 1. Purple Gradient Background (Full square for iOS rounded mask)
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, '#a855f7');
    grad.addColorStop(1, '#7e22ce');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // 2. Yellow Paw Print (#fde047)
    ctx.fillStyle = '#fde047';

    const drawCircle = (x, y, r) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };
    drawCircle(155, 195, 44);
    drawCircle(256, 145, 46);
    drawCircle(357, 195, 44);

    ctx.beginPath();
    ctx.moveTo(256, 245);
    ctx.bezierCurveTo(185, 245, 135, 295, 135, 345);
    ctx.bezierCurveTo(135, 382, 166, 405, 202, 405);
    ctx.bezierCurveTo(224, 405, 242, 394, 256, 394);
    ctx.bezierCurveTo(270, 394, 288, 405, 310, 405);
    ctx.bezierCurveTo(346, 405, 377, 382, 377, 345);
    ctx.bezierCurveTo(377, 295, 327, 245, 256, 245);
    ctx.closePath();
    ctx.fill();

    // Export as real PNG Data URL
    const pngDataUrl = canvas.toDataURL('image/png');

    const favicon = document.getElementById('faviconLink');
    const appleIcon = document.getElementById('appleTouchIconLink');
    if (favicon) favicon.href = pngDataUrl;
    if (appleIcon) appleIcon.href = pngDataUrl;

    // 3. Dynamic Web App Manifest for Android Chrome
    const manifestObj = {
      name: 'Pawtion - คำนวณปริมาณอาหารสัตว์เลี้ยง',
      short_name: 'Pawtion',
      start_url: window.location.href.split('?')[0],
      display: 'standalone',
      background_color: '#faf5ff',
      theme_color: '#9333ea',
      icons: [
        {
          src: pngDataUrl,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ]
    };

    const manifestBlob = new Blob([JSON.stringify(manifestObj)], { type: 'application/manifest+json' });
    const manifestUrl = URL.createObjectURL(manifestBlob);
    const manifestLink = document.getElementById('manifestLink');
    if (manifestLink) manifestLink.href = manifestUrl;
  } catch (e) {
    console.warn('ไม่สามารถสร้างไอคอน PNG อัตโนมัติได้:', e);
  }
})();

// Initialize Lucide Icons
lucide.createIcons();

const STORAGE_KEY_MULTI = 'pawtion_multi_pets_v3';

let petStore = {
  activeId: null,
  pets: []
};

let currentSpecies = 'cat';
let lastAgeMonths = null;

// Life Stage Multipliers
const catStages = [
  { id: 'cat_kitten', label: 'ลูกแมว (อายุต่ำกว่า 1 ปี)', factor: 2.5 },
  { id: 'cat_neutered', label: 'แมวโตทำหมันแล้ว (กิจกรรมปกติ)', factor: 1.2 },
  { id: 'cat_intact', label: 'แมวโตยังไม่ทำหมัน', factor: 1.4 },
  { id: 'cat_weight_loss', label: 'แมวโตลดน้ำหนัก / กิจกรรมน้อย', factor: 1.0 },
  { id: 'cat_senior', label: 'แมวสูงวัย (7 ปีขึ้นไป)', factor: 1.1 },
  { id: 'cat_pregnant', label: 'แมวตั้งท้อง / ให้นมลูก', factor: 2.0 }
];

const dogStages = [
  { id: 'dog_puppy_4m', label: 'ลูกสุนัข (อายุต่ำกว่า 4 เดือน)', factor: 3.0 },
  { id: 'dog_puppy_4m_plus', label: 'ลูกสุนัข (อายุ 4 เดือน - 1 ปี)', factor: 2.0 },
  { id: 'dog_neutered', label: 'สุนัขโตทำหมันแล้ว', factor: 1.6 },
  { id: 'dog_intact', label: 'สุนัขโตยังไม่ทำหมัน', factor: 1.8 },
  { id: 'dog_active', label: 'สุนัขแอคทีฟ / ออกกำลังกายเยอะ', factor: 2.0 },
  { id: 'dog_weight_loss', label: 'สุนัขลดน้ำหนัก', factor: 1.0 },
  { id: 'dog_senior', label: 'สุนัขสูงวัย', factor: 1.2 }
];

// Shared Proximate Analysis Helper (Modified Atwater Factors)
function calcKcalPerGramFromProximate(protein, fat, fiber, moisture) {
  const hasAnyValue = [protein, fat, fiber, moisture].some(v => v !== '' && v !== null && v !== undefined && !isNaN(parseFloat(v)));
  if (!hasAnyValue) return 0;

  const p = Math.max(0, parseFloat(protein) || 0);
  const f = Math.max(0, parseFloat(fat) || 0);
  const fb = Math.max(0, parseFloat(fiber) || 0);
  const m = Math.max(0, parseFloat(moisture) || 0);

  // Estimate Ash (~6% for dry/semi-moist, ~2% for high-moisture wet food > 60%)
  const ash = m > 60 ? 2 : 6;
  const nfe = Math.max(0, 100 - (p + f + fb + m + ash));

  // Protein 3.5 kcal/g, Fat 8.5 kcal/g, NFE 3.5 kcal/g
  const kcalPer100g = (p * 3.5) + (f * 8.5) + (nfe * 3.5);
  return Math.max(0, kcalPer100g / 100);
}

// Toggle Proximate Analysis helper box for Dry or Wet food
function toggleProximateBox(type) {
  const boxId = type === 'dry' ? 'dryProximateBox' : 'wetProximateBox';
  const box = document.getElementById(boxId);
  if (!box) return;

  const willOpen = box.classList.contains('hidden');
  box.classList.toggle('hidden');

  if (willOpen) {
    updateProximatePreviewOnly(type);
  }
}

// Update preview label inside Dry/Wet Proximate box
function updateProximatePreviewOnly(type) {
  if (type === 'dry') {
    const kcalPerG = calcKcalPerGramFromProximate(
      document.getElementById('dryProtein').value,
      document.getElementById('dryFat').value,
      document.getElementById('dryFiber').value,
      document.getElementById('dryMoisture').value
    );
    document.getElementById('dryCalcPreview').textContent = kcalPerG.toFixed(2);
  } else {
    const kcalPerG = calcKcalPerGramFromProximate(
      document.getElementById('wetProtein').value,
      document.getElementById('wetFat').value,
      document.getElementById('wetFiber').value,
      document.getElementById('wetMoisture').value
    );
    document.getElementById('wetCalcPreview').textContent = kcalPerG.toFixed(2);
  }
}

// Calculate from Proximate inputs and apply directly to dryCal or wetCal
function applyProximateToFood(type) {
  if (type === 'dry') {
    const kcalPerG = calcKcalPerGramFromProximate(
      document.getElementById('dryProtein').value,
      document.getElementById('dryFat').value,
      document.getElementById('dryFiber').value,
      document.getElementById('dryMoisture').value
    );
    document.getElementById('dryCalcPreview').textContent = kcalPerG.toFixed(2);
    if (kcalPerG > 0) {
      document.getElementById('dryCal').value = kcalPerG.toFixed(2);
    }
  } else {
    const kcalPerG = calcKcalPerGramFromProximate(
      document.getElementById('wetProtein').value,
      document.getElementById('wetFat').value,
      document.getElementById('wetFiber').value,
      document.getElementById('wetMoisture').value
    );
    document.getElementById('wetCalcPreview').textContent = kcalPerG.toFixed(2);
    if (kcalPerG > 0) {
      document.getElementById('wetCal').value = kcalPerG.toFixed(2);
    }
  }
  calculatePortion(true);
}

// Create a blank pet profile object
function createDefaultPet() {
  return {
    id: 'pet_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    species: 'cat',
    healthConfirmed: false,
    petName: '',
    petWeight: '',
    petAgeYears: '',
    petAgeMonths: '',
    stageId: 'cat_neutered',
    mainFoodRatio: '70',
    dryCal: '',
    wetCal: '',
    mealsPerDay: '3',
    dryProtein: '',
    dryFat: '',
    dryFiber: '',
    dryMoisture: '',
    wetProtein: '',
    wetFat: '',
    wetFiber: '',
    wetMoisture: '',
    treatProtein: '',
    treatFat: '',
    treatFiber: '',
    treatMoisture: '',
    treatBagWeight: '',
    treatBagPieces: ''
  };
}

// Save all pet profiles to LocalStorage
function saveStore() {
  try {
    localStorage.setItem(STORAGE_KEY_MULTI, JSON.stringify(petStore));
  } catch (e) {
    console.warn('ไม่สามารถบันทึกข้อมูลลง LocalStorage ได้:', e);
  }
}

// Load store from LocalStorage or start with a blank profile
function initPetStore() {
  try {
    const rawMulti = localStorage.getItem(STORAGE_KEY_MULTI);
    if (rawMulti) {
      const parsed = JSON.parse(rawMulti);
      if (parsed && Array.isArray(parsed.pets) && parsed.pets.length > 0) {
        petStore = parsed;
        if (!petStore.pets.some(p => p.id === petStore.activeId)) {
          petStore.activeId = petStore.pets[0].id;
        }
        return;
      }
    }
  } catch (e) {
    console.warn('ไม่สามารถโหลดข้อมูลจาก LocalStorage ได้:', e);
  }

  // Start completely blank for new users
  const initialPet = createDefaultPet();
  petStore = {
    activeId: initialPet.id,
    pets: [initialPet]
  };
  saveStore();
}

// Get currently active pet object
function getActivePet() {
  return petStore.pets.find(p => p.id === petStore.activeId) || petStore.pets[0];
}

// Sync current form inputs into the active pet object and save
function syncCurrentFormToActivePet() {
  const activePet = getActivePet();
  if (!activePet) return;

  const stageSelect = document.getElementById('petStage');
  const selectedOption = stageSelect.options[stageSelect.selectedIndex];

  activePet.species = currentSpecies;
  activePet.healthConfirmed = document.getElementById('healthConfirmed').checked;
  activePet.petName = document.getElementById('petName').value;
  activePet.petWeight = document.getElementById('petWeight').value;
  activePet.petAgeYears = document.getElementById('petAgeYears').value;
  activePet.petAgeMonths = document.getElementById('petAgeMonths').value;
  activePet.stageId = selectedOption ? selectedOption.dataset.id : '';
  activePet.mainFoodRatio = document.getElementById('mainFoodRatio').value;
  activePet.dryCal = document.getElementById('dryCal').value;
  activePet.wetCal = document.getElementById('wetCal').value;
  activePet.mealsPerDay = document.getElementById('mealsPerDay').value;

  // Dry & Wet food proximate fields
  activePet.dryProtein = document.getElementById('dryProtein').value;
  activePet.dryFat = document.getElementById('dryFat').value;
  activePet.dryFiber = document.getElementById('dryFiber').value;
  activePet.dryMoisture = document.getElementById('dryMoisture').value;

  activePet.wetProtein = document.getElementById('wetProtein').value;
  activePet.wetFat = document.getElementById('wetFat').value;
  activePet.wetFiber = document.getElementById('wetFiber').value;
  activePet.wetMoisture = document.getElementById('wetMoisture').value;

  // Treat proximate analysis fields
  activePet.treatProtein = document.getElementById('treatProtein').value;
  activePet.treatFat = document.getElementById('treatFat').value;
  activePet.treatFiber = document.getElementById('treatFiber').value;
  activePet.treatMoisture = document.getElementById('treatMoisture').value;
  activePet.treatBagWeight = document.getElementById('treatBagWeight').value;
  activePet.treatBagPieces = document.getElementById('treatBagPieces').value;

  saveStore();
  renderProfileChips();
  updateHouseholdSummary();
}

// Load a specific pet profile into the UI form
function loadPetIntoForm(petId) {
  petStore.activeId = petId;
  saveStore();

  const pet = getActivePet();
  if (!pet) return;

  currentSpecies = pet.species === 'dog' ? 'dog' : 'cat';
  document.getElementById('healthConfirmed').checked = !!pet.healthConfirmed;
  document.getElementById('petName').value = pet.petName ?? '';
  document.getElementById('petWeight').value = pet.petWeight ?? '';
  document.getElementById('petAgeYears').value = pet.petAgeYears ?? '';
  document.getElementById('petAgeMonths').value = pet.petAgeMonths ?? '';
  document.getElementById('mainFoodRatio').value = pet.mainFoodRatio ?? '70';
  document.getElementById('dryCal').value = pet.dryCal ?? '';
  document.getElementById('wetCal').value = pet.wetCal ?? '';
  document.getElementById('mealsPerDay').value = pet.mealsPerDay ?? '3';

  // Load Dry & Wet proximate values
  document.getElementById('dryProtein').value = pet.dryProtein ?? '';
  document.getElementById('dryFat').value = pet.dryFat ?? '';
  document.getElementById('dryFiber').value = pet.dryFiber ?? '';
  document.getElementById('dryMoisture').value = pet.dryMoisture ?? '';

  document.getElementById('wetProtein').value = pet.wetProtein ?? '';
  document.getElementById('wetFat').value = pet.wetFat ?? '';
  document.getElementById('wetFiber').value = pet.wetFiber ?? '';
  document.getElementById('wetMoisture').value = pet.wetMoisture ?? '';

  // Load treat proximate analysis values
  document.getElementById('treatProtein').value = pet.treatProtein ?? '';
  document.getElementById('treatFat').value = pet.treatFat ?? '';
  document.getElementById('treatFiber').value = pet.treatFiber ?? '';
  document.getElementById('treatMoisture').value = pet.treatMoisture ?? '';
  document.getElementById('treatBagWeight').value = pet.treatBagWeight ?? '';
  document.getElementById('treatBagPieces').value = pet.treatBagPieces ?? '';

  updateProximatePreviewOnly('dry');
  updateProximatePreviewOnly('wet');
  updateSpeciesButtonsUI();
  populateStages();

  if (pet.stageId) {
    const stageSelect = document.getElementById('petStage');
    const matched = Array.from(stageSelect.options).find(opt => opt.dataset.id === pet.stageId);
    if (matched) {
      stageSelect.value = matched.value;
    }
  }

  lastAgeMonths = getTotalAgeMonths();
  updateFoodRatioLabel();
  updatePetNameDisplay(false);
  renderProfileChips();
  calculatePortion(false);
  updateHouseholdSummary();
}

// Add a new blank pet profile
function addNewPetProfile() {
  const newPet = createDefaultPet();
  petStore.pets.push(newPet);
  loadPetIntoForm(newPet.id);
}

// Delete the currently selected pet profile
function deleteCurrentPetProfile() {
  if (petStore.pets.length <= 1) return;

  const activePet = getActivePet();
  const displayName = (activePet.petName || '').trim() || 'สัตว์เลี้ยงตัวนี้';
  const confirmed = confirm(`ต้องการลบโปรไฟล์ของ "${displayName}" ใช่หรือไม่?`);
  if (!confirmed) return;

  petStore.pets = petStore.pets.filter(p => p.id !== activePet.id);
  const nextPet = petStore.pets[0];
  loadPetIntoForm(nextPet.id);
}

// Render the horizontal profile switcher chips
function renderProfileChips() {
  const container = document.getElementById('petProfileList');
  const deleteBtn = document.getElementById('btnDeleteProfile');
  if (!container) return;

  if (deleteBtn) {
    if (petStore.pets.length > 1) {
      deleteBtn.classList.remove('hidden');
    } else {
      deleteBtn.classList.add('hidden');
    }
  }

  container.innerHTML = '';

  petStore.pets.forEach((pet, idx) => {
    const isActive = pet.id === petStore.activeId;
    const rawName = (pet.petName || '').trim();
    const name = rawName || `ตัวที่ ${idx + 1}`;
    const weight = parseFloat(pet.petWeight);
    const weightLabel = !isNaN(weight) && weight > 0 ? `${weight} กก.` : '';
    const iconName = pet.species === 'dog' ? 'dog' : 'cat';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.onclick = () => {
      if (pet.id !== petStore.activeId) {
        loadPetIntoForm(pet.id);
      }
    };

    if (isActive) {
      btn.className = 'shrink-0 px-3.5 py-2 rounded-2xl text-xs font-semibold flex items-center gap-2 transition bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-sm shadow-purple-200';
    } else {
      btn.className = 'shrink-0 px-3.5 py-2 rounded-2xl text-xs font-medium flex items-center gap-2 transition bg-purple-50/80 text-purple-800 border border-purple-100 hover:bg-purple-100/70';
    }

    btn.innerHTML = `
      <i data-lucide="${iconName}" class="w-4 h-4 ${isActive ? 'text-yellow-200' : 'text-purple-600'}"></i>
      <span>${escapeHTML(name)}</span>
      ${weightLabel ? `<span class="text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-yellow-100' : 'bg-purple-100 text-purple-600'}">${weightLabel}</span>` : ''}
    `;

    container.appendChild(btn);
  });

  lucide.createIcons();
}

// Simple HTML escaper for safe rendering of pet names
function escapeHTML(str) {
  return str.replace(/[&<>"']/g, match => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[match]));
}

// Calculate Treat Metrics from Proximate Analysis
function calculateTreatMetrics(pet, treatCalQuota) {
  const kcalPerGram = calcKcalPerGramFromProximate(
    pet.treatProtein,
    pet.treatFat,
    pet.treatFiber,
    pet.treatMoisture
  );
  const kcalPer100g = kcalPerGram * 100;
  const maxGrams = kcalPerGram > 0 ? (treatCalQuota / kcalPerGram) : 0;

  const bagWeight = parseFloat(pet.treatBagWeight) || 0;
  const bagPieces = parseFloat(pet.treatBagPieces) || 0;

  let maxPieces = 0;
  if (bagWeight > 0 && bagPieces > 0) {
    const gramsPerPiece = bagWeight / bagPieces;
    maxPieces = gramsPerPiece > 0 ? (maxGrams / gramsPerPiece) : 0;
  }

  return {
    kcalPer100g,
    kcalPerGram,
    maxGrams,
    maxPieces,
    hasPieces: bagWeight > 0 && bagPieces > 0
  };
}

// Calculate daily nutrition metrics for any pet profile object
function calculatePetMetrics(pet) {
  const weight = parseFloat(pet.petWeight) || 0;
  if (weight <= 0) {
    return {
      rer: 0, der: 0, mainFoodCal: 0, treatCal: 0,
      dryCal: 0, wetCal: 0, dryGrams: 0, wetGrams: 0,
      dryPerMeal: 0, wetPerMeal: 0, waterMl: 0,
      treat: { kcalPer100g: 0, kcalPerGram: 0, maxGrams: 0, maxPieces: 0, hasPieces: false }
    };
  }

  const stageList = pet.species === 'dog' ? dogStages : catStages;
  const matchedStage = stageList.find(s => s.id === pet.stageId);
  const factor = matchedStage ? matchedStage.factor : (pet.species === 'dog' ? 1.6 : 1.2);

  const rer = 70 * Math.pow(weight, 0.75);
  const der = rer * factor;

  const mainFoodCal = der * 0.90;
  const treatCal = der * 0.10;

  const dryRatioPct = (parseFloat(pet.mainFoodRatio) ?? 70) / 100;
  const wetRatioPct = 1 - dryRatioPct;

  const dryCal = mainFoodCal * dryRatioPct;
  const wetCal = mainFoodCal * wetRatioPct;

  const dryDensity = parseFloat(pet.dryCal) || 0;
  const wetDensity = parseFloat(pet.wetCal) || 0;

  const dryGrams = dryDensity > 0 ? (dryCal / dryDensity) : 0;
  const wetGrams = wetDensity > 0 ? (wetCal / wetDensity) : 0;

  const meals = parseInt(pet.mealsPerDay) || 3;
  const dryPerMeal = dryGrams / meals;
  const wetPerMeal = wetGrams / meals;

  const waterFactor = pet.species === 'cat' ? 50 : 60;
  const waterMl = weight * waterFactor;

  const treat = calculateTreatMetrics(pet, treatCal);

  return {
    rer,
    der,
    mainFoodCal,
    treatCal,
    dryCal,
    wetCal,
    dryGrams,
    wetGrams,
    dryPerMeal,
    wetPerMeal,
    waterMl,
    treat
  };
}

// Copy text to clipboard with fallback & visual feedback on button
function copyTextWithFeedback(text, btnElement) {
  const showSuccess = () => {
    if (!btnElement) return;
    const originalHTML = btnElement.innerHTML;
    btnElement.classList.remove('bg-emerald-500', 'hover:bg-emerald-600');
    btnElement.classList.add('bg-purple-700');
    btnElement.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5"></i><span>คัดลอกแล้ว!</span>`;
    lucide.createIcons();

    setTimeout(() => {
      btnElement.classList.remove('bg-purple-700');
      btnElement.classList.add('bg-emerald-500', 'hover:bg-emerald-600');
      btnElement.innerHTML = originalHTML;
      lucide.createIcons();
    }, 2000);
  };

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(showSuccess).catch(() => {
      fallbackCopyText(text, showSuccess);
    });
  } else {
    fallbackCopyText(text, showSuccess);
  }
}

function fallbackCopyText(text, onSuccess) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    document.execCommand('copy');
    if (onSuccess) onSuccess();
  } catch (err) {
    alert('ไม่สามารถคัดลอกอัตโนมัติได้ กรุณาลองใหม่อีกครั้ง');
  }
  document.body.removeChild(textarea);
}

// Format treat quota string for LINE messages
function formatTreatAllowanceForLine(metrics) {
  const t = metrics.treat;
  const calText = `ไม่เกิน ${Math.round(metrics.treatCal)} kcal/วัน`;
  if (t.kcalPerGram <= 0) return calText;

  if (t.hasPieces) {
    return `${calText} (ประมาณ ${t.maxPieces.toFixed(1)} ชิ้น หรือ ${t.maxGrams.toFixed(1)} g)`;
  }
  return `${calText} (ประมาณ ${t.maxGrams.toFixed(1)} g)`;
}

// Copy Single Active Pet Summary formatted for LINE
function copySinglePetSummary(btnElement) {
  const pet = getActivePet();
  if (!pet) return;

  const metrics = calculatePetMetrics(pet);
  const name = (pet.petName || '').trim() || 'น้อง';
  const emoji = pet.species === 'dog' ? '🐶' : '🐱';
  const meals = parseInt(pet.mealsPerDay) || 3;

  const lines = [
    `${emoji} ตารางอาหารของ "${name}" (${pet.petWeight || 0} กก.)`,
    `• พลังงานรวม: ${Math.round(metrics.der)} kcal/วัน`,
    `• แบ่ง ${meals} มื้อ/วัน (ตวงต่อมื้อ):`,
    `  - อาหารเม็ด: ${metrics.dryPerMeal.toFixed(1)} g (รวม ${metrics.dryGrams.toFixed(1)} g/วัน)`,
    `  - อาหารเปียก: ${metrics.wetPerMeal.toFixed(1)} g (รวม ${metrics.wetGrams.toFixed(1)} g/วัน)`,
    `• โควต้าขนม: ${formatTreatAllowanceForLine(metrics)}`,
    `• น้ำดื่มแนะนำ: ~${Math.round(metrics.waterMl)} ml/วัน`
  ];

  copyTextWithFeedback(lines.join('\n'), btnElement);
}

// Copy All Confirmed Pets Summary formatted for LINE
function copyHouseholdSummary(btnElement) {
  const confirmedPets = petStore.pets.filter(p => p.healthConfirmed && (parseFloat(p.petWeight) || 0) > 0);
  if (confirmedPets.length === 0) return;

  let sumDry = 0;
  let sumWet = 0;

  const lines = [`🐾 สรุปปริมาณอาหารเด็กๆ ในบ้าน (${confirmedPets.length} ตัว)`];

  confirmedPets.forEach((pet, idx) => {
    const m = calculatePetMetrics(pet);
    const name = (pet.petName || '').trim() || `ตัวที่ ${idx + 1}`;
    const emoji = pet.species === 'dog' ? '🐶' : '🐱';
    const meals = parseInt(pet.mealsPerDay) || 3;

    sumDry += m.dryGrams;
    sumWet += m.wetGrams;

    lines.push(
      `\n${emoji} ${name} (${meals} มื้อ/วัน)`,
      `  - ต่อมื้อ: เม็ด ${m.dryPerMeal.toFixed(1)} g | เปียก ${m.wetPerMeal.toFixed(1)} g`,
      `  - ทั้งวัน: เม็ด ${m.dryGrams.toFixed(1)} g | เปียก ${m.wetGrams.toFixed(1)} g`,
      `  - ขนม: ${formatTreatAllowanceForLine(m)}`
    );
  });

  lines.push(
    `\n📦 ยอดรวมทั้งบ้านต่อวัน:`,
    `• อาหารเม็ดรวม: ${sumDry.toFixed(1)} g/วัน`,
    `• อาหารเปียกรวม: ${sumWet.toFixed(1)} g/วัน`
  );

  copyTextWithFeedback(lines.join('\n'), btnElement);
}

// Update Household Daily Total Summary Card
function updateHouseholdSummary() {
  const card = document.getElementById('householdSummaryCard');
  if (!card) return;

  const totalPets = petStore.pets.length;
  const confirmedPets = petStore.pets.filter(p => p.healthConfirmed && (parseFloat(p.petWeight) || 0) > 0);

  if (totalPets <= 1 || confirmedPets.length === 0) {
    card.classList.add('hidden');
    return;
  }

  let sumDryGrams = 0;
  let sumWetGrams = 0;

  confirmedPets.forEach(pet => {
    const metrics = calculatePetMetrics(pet);
    sumDryGrams += metrics.dryGrams;
    sumWetGrams += metrics.wetGrams;
  });

  card.classList.remove('hidden');

  document.getElementById('hhConfirmedCount').textContent = confirmedPets.length;
  document.getElementById('hhTotalCount').textContent = totalPets;

  document.getElementById('hhTotalDryGram').textContent = sumDryGrams.toFixed(1);
  document.getElementById('hhTotalWetGram').textContent = sumWetGrams.toFixed(1);

  document.getElementById('hhWeekDry').textContent = Math.round(sumDryGrams * 7).toLocaleString();
  document.getElementById('hhWeekWet').textContent = Math.round(sumWetGrams * 7).toLocaleString();

  document.getElementById('hhMonthDry').textContent = ((sumDryGrams * 30) / 1000).toFixed(2);
  document.getElementById('hhMonthWet').textContent = ((sumWetGrams * 30) / 1000).toFixed(2);
}

// Update Species Tab Button Styles
function updateSpeciesButtonsUI() {
  const btnCat = document.getElementById('btnCat');
  const btnDog = document.getElementById('btnDog');

  if (currentSpecies === 'cat') {
    btnCat.className = 'py-2.5 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition tab-active';
    btnDog.className = 'py-2.5 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition text-purple-700 hover:bg-purple-100/60';
  } else {
    btnDog.className = 'py-2.5 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition tab-active';
    btnCat.className = 'py-2.5 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition text-purple-700 hover:bg-purple-100/60';
  }
}

// Calculate total age in months (returns null if both fields are blank)
function getTotalAgeMonths() {
  const yRaw = document.getElementById('petAgeYears').value;
  const mRaw = document.getElementById('petAgeMonths').value;
  if (yRaw === '' && mRaw === '') return null;

  const years = parseInt(yRaw) || 0;
  const months = parseInt(mRaw) || 0;
  return (years * 12) + months;
}

// Auto-select stage based on species and age
function autoSelectStageByAge(force = false) {
  const totalMonths = getTotalAgeMonths();

  if (totalMonths === null) {
    if (force) {
      const defaultId = currentSpecies === 'cat' ? 'cat_neutered' : 'dog_neutered';
      const stageSelect = document.getElementById('petStage');
      const matched = Array.from(stageSelect.options).find(opt => opt.dataset.id === defaultId);
      if (matched) stageSelect.value = matched.value;
    }
    return;
  }

  if (!force && totalMonths === lastAgeMonths) return;
  lastAgeMonths = totalMonths;

  let targetStageId = '';

  if (currentSpecies === 'cat') {
    if (totalMonths < 12) {
      targetStageId = 'cat_kitten';
    } else if (totalMonths >= 84) {
      targetStageId = 'cat_senior';
    } else {
      targetStageId = 'cat_neutered';
    }
  } else {
    if (totalMonths < 4) {
      targetStageId = 'dog_puppy_4m';
    } else if (totalMonths < 12) {
      targetStageId = 'dog_puppy_4m_plus';
    } else if (totalMonths >= 84) {
      targetStageId = 'dog_senior';
    } else {
      targetStageId = 'dog_neutered';
    }
  }

  const stageSelect = document.getElementById('petStage');
  const options = Array.from(stageSelect.options);
  const matchedOption = options.find(opt => opt.dataset.id === targetStageId);

  if (matchedOption) {
    stageSelect.value = matchedOption.value;
  }
}

// Update Pet Name across UI
function updatePetNameDisplay(shouldSave = true) {
  const name = document.getElementById('petName').value.trim() || 'สัตว์เลี้ยงของคุณ';
  document.getElementById('lockPetName').textContent = name;
  document.getElementById('resPetName').textContent = name;
  if (shouldSave) {
    syncCurrentFormToActivePet();
  }
}

// Switch between Cat & Dog
function selectSpecies(species) {
  currentSpecies = species;
  updateSpeciesButtonsUI();
  populateStages();
  autoSelectStageByAge(true);
  calculatePortion(true);
}

// Populate Dropdown Options
function populateStages() {
  const stageSelect = document.getElementById('petStage');
  stageSelect.innerHTML = '';
  const list = currentSpecies === 'cat' ? catStages : dogStages;

  list.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.factor;
    opt.dataset.id = item.id;
    opt.textContent = item.label;
    stageSelect.appendChild(opt);
  });
}

// Update Dry/Wet Percentage Label
function updateFoodRatioLabel() {
  const dryVal = document.getElementById('mainFoodRatio').value;
  const wetVal = 100 - dryVal;
  document.getElementById('dryRatioVal').textContent = dryVal + '%';
  document.getElementById('wetRatioVal').textContent = wetVal + '%';
}

// Main Calorie & Portion Calculation for Active Pet
function calculatePortion(shouldSave = true) {
  autoSelectStageByAge(false);

  if (shouldSave) {
    syncCurrentFormToActivePet();
  }

  const isConfirmed = document.getElementById('healthConfirmed').checked;
  const notice = document.getElementById('unconfirmedNotice');
  const resultCard = document.getElementById('resultCard');

  if (!isConfirmed) {
    notice.classList.remove('hidden');
    resultCard.classList.add('hidden');
    return;
  } else {
    notice.classList.add('hidden');
    resultCard.classList.remove('hidden');
  }

  const activePet = getActivePet();
  const metrics = calculatePetMetrics(activePet);
  const meals = parseInt(document.getElementById('mealsPerDay').value) || 3;

  // Render UI (shows 0 safely if weight or calorie density is still blank)
  document.getElementById('resDER').textContent = Math.round(metrics.der);
  document.getElementById('resMainCal').textContent = Math.round(metrics.mainFoodCal);
  document.getElementById('resTreatCal').textContent = Math.round(metrics.treatCal);

  document.getElementById('resDryCal').textContent = Math.round(metrics.dryCal);
  document.getElementById('resDryGram').textContent = metrics.dryGrams.toFixed(1);

  document.getElementById('resWetCal').textContent = Math.round(metrics.wetCal);
  document.getElementById('resWetGram').textContent = metrics.wetGrams.toFixed(1);

  document.getElementById('resTreatMaxCal').textContent = Math.round(metrics.treatCal);

  // Render Treat Proximate Calculation
  const t = metrics.treat;
  document.getElementById('treatCalPer100g').textContent = Math.round(t.kcalPer100g);

  const allowanceEl = document.getElementById('treatMaxAllowanceText');
  if (t.kcalPerGram <= 0) {
    allowanceEl.textContent = 'กรอกฉลากขนมด้านบน';
  } else if (t.hasPieces) {
    allowanceEl.textContent = `${t.maxPieces.toFixed(1)} ชิ้น (${t.maxGrams.toFixed(1)} g) / วัน`;
  } else {
    allowanceEl.textContent = `${t.maxGrams.toFixed(1)} g / วัน`;
  }

  document.getElementById('resMealCount').textContent = meals;
  document.getElementById('resDryPerMeal').textContent = metrics.dryPerMeal.toFixed(1);
  document.getElementById('resWetPerMeal').textContent = metrics.wetPerMeal.toFixed(1);

  document.getElementById('resWater').textContent = Math.round(metrics.waterMl);
}

// Initial setup on page load
initPetStore();
loadPetIntoForm(petStore.activeId);
