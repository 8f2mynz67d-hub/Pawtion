// Initialize Lucide Icons
lucide.createIcons();

const STORAGE_KEY = 'pawtion_pet_profile_v1';
let currentSpecies = 'cat';
let lastAgeMonths = null;

// Life Stage Multipliers (DER Factors)
const catStages = [
  { id: 'cat_kitten', label: 'ลูกแมว (อายุต่ำกว่า 1 ปี) [DER = 2.5 x RER]', factor: 2.5 },
  { id: 'cat_neutered', label: 'แมวโตทำหมันแล้ว (กิจกรรมปกติ) [DER = 1.2 x RER]', factor: 1.2 },
  { id: 'cat_intact', label: 'แมวโตยังไม่ทำหมัน [DER = 1.4 x RER]', factor: 1.4 },
  { id: 'cat_weight_loss', label: 'แมวโตลดน้ำหนัก / กิจกรรมน้อย [DER = 1.0 x RER]', factor: 1.0 },
  { id: 'cat_senior', label: 'แมวสูงวัย (7 ปีขึ้นไป) [DER = 1.1 x RER]', factor: 1.1 },
  { id: 'cat_pregnant', label: 'แมวตั้งท้อง / ให้นมลูก [DER = 2.0 x RER]', factor: 2.0 }
];

const dogStages = [
  { id: 'dog_puppy_4m', label: 'ลูกสุนัข (อายุต่ำกว่า 4 เดือน) [DER = 3.0 x RER]', factor: 3.0 },
  { id: 'dog_puppy_4m_plus', label: 'ลูกสุนัข (อายุ 4 เดือน - 1 ปี) [DER = 2.0 x RER]', factor: 2.0 },
  { id: 'dog_neutered', label: 'สุนัขโตทำหมันแล้ว [DER = 1.6 x RER]', factor: 1.6 },
  { id: 'dog_intact', label: 'สุนัขโตยังไม่ทำหมัน [DER = 1.8 x RER]', factor: 1.8 },
  { id: 'dog_active', label: 'สุนัขแอคทีฟ / ออกกำลังกายเยอะ [DER = 2.0 x RER]', factor: 2.0 },
  { id: 'dog_weight_loss', label: 'สุนัขลดน้ำหนัก [DER = 1.0 x RER]', factor: 1.0 },
  { id: 'dog_senior', label: 'สุนัขสูงวัย [DER = 1.2 x RER]', factor: 1.2 }
];

// Save current form state to LocalStorage
function saveToLocalStorage() {
  try {
    const stageSelect = document.getElementById('petStage');
    const selectedOption = stageSelect.options[stageSelect.selectedIndex];

    const data = {
      species: currentSpecies,
      healthConfirmed: document.getElementById('healthConfirmed').checked,
      petName: document.getElementById('petName').value,
      petWeight: document.getElementById('petWeight').value,
      petAgeYears: document.getElementById('petAgeYears').value,
      petAgeMonths: document.getElementById('petAgeMonths').value,
      stageId: selectedOption ? selectedOption.dataset.id : '',
      mainFoodRatio: document.getElementById('mainFoodRatio').value,
      dryCal: document.getElementById('dryCal').value,
      wetCal: document.getElementById('wetCal').value,
      mealsPerDay: document.getElementById('mealsPerDay').value
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('ไม่สามารถบันทึกข้อมูลลง LocalStorage ได้:', e);
  }
}

// Load saved form state from LocalStorage
function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;

    const data = JSON.parse(raw);

    if (data.species === 'dog' || data.species === 'cat') {
      currentSpecies = data.species;
    }

    if (typeof data.healthConfirmed === 'boolean') {
      document.getElementById('healthConfirmed').checked = data.healthConfirmed;
    }
    if (data.petName !== undefined) document.getElementById('petName').value = data.petName;
    if (data.petWeight !== undefined) document.getElementById('petWeight').value = data.petWeight;
    if (data.petAgeYears !== undefined) document.getElementById('petAgeYears').value = data.petAgeYears;
    if (data.petAgeMonths !== undefined) document.getElementById('petAgeMonths').value = data.petAgeMonths;
    if (data.mainFoodRatio !== undefined) document.getElementById('mainFoodRatio').value = data.mainFoodRatio;
    if (data.dryCal !== undefined) document.getElementById('dryCal').value = data.dryCal;
    if (data.wetCal !== undefined) document.getElementById('wetCal').value = data.wetCal;
    if (data.mealsPerDay !== undefined) document.getElementById('mealsPerDay').value = data.mealsPerDay;

    // อัปเดต UI ปุ่มชนิดสัตว์และ Dropdown ช่วงวัย
    updateSpeciesButtonsUI();
    populateStages();

    // ตั้งค่าช่วงวัยที่เคยบันทึกไว้ (ถ้ามี)
    if (data.stageId) {
      const stageSelect = document.getElementById('petStage');
      const matched = Array.from(stageSelect.options).find(opt => opt.dataset.id === data.stageId);
      if (matched) {
        stageSelect.value = matched.value;
      }
    }

    // บันทึกอายุปัจจุบันไว้ เพื่อไม่ให้ autoSelectStageByAge เขียนทับค่าที่โหลดมา
    lastAgeMonths = getTotalAgeMonths();
    updateFoodRatioLabel();
    return true;
  } catch (e) {
    console.warn('ไม่สามารถโหลดข้อมูลจาก LocalStorage ได้:', e);
    return false;
  }
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

// Calculate total age in months
function getTotalAgeMonths() {
  const years = parseInt(document.getElementById('petAgeYears').value) || 0;
  const months = parseInt(document.getElementById('petAgeMonths').value) || 0;
  return (years * 12) + months;
}

// Auto-select stage based on species and age
function autoSelectStageByAge(force = false) {
  const totalMonths = getTotalAgeMonths();

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
function updatePetNameDisplay() {
  const name = document.getElementById('petName').value.trim() || 'สัตว์เลี้ยงของคุณ';
  document.getElementById('lockPetName').textContent = name;
  document.getElementById('resPetName').textContent = name;
  saveToLocalStorage();
}

// Switch between Cat & Dog
function selectSpecies(species) {
  currentSpecies = species;
  updateSpeciesButtonsUI();
  populateStages();
  autoSelectStageByAge(true);
  calculatePortion();
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

// Main Calorie & Portion Calculation
function calculatePortion() {
  autoSelectStageByAge(false);
  saveToLocalStorage();

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

  const weight = parseFloat(document.getElementById('petWeight').value) || 0;
  if (weight <= 0) return;

  const factor = parseFloat(document.getElementById('petStage').value) || 1.2;
  
  // RER = 70 * (weight ^ 0.75)
  const rer = 70 * Math.pow(weight, 0.75);
  const der = rer * factor;

  // 90% Main Food, 10% Treats
  const mainFoodCal = der * 0.90;
  const treatCal = der * 0.10;

  // Main Food Ratio Split (Dry vs Wet)
  const dryRatioPct = parseFloat(document.getElementById('mainFoodRatio').value) / 100;
  const wetRatioPct = 1 - dryRatioPct;

  const dryCalTarget = mainFoodCal * dryRatioPct;
  const wetCalTarget = mainFoodCal * wetRatioPct;

  // Densities
  const dryDensity = parseFloat(document.getElementById('dryCal').value) || 3.8;
  const wetDensity = parseFloat(document.getElementById('wetCal').value) || 0.85;

  const dryGrams = dryCalTarget / dryDensity;
  const wetGrams = wetCalTarget / wetDensity;

  // Meals
  const meals = parseInt(document.getElementById('mealsPerDay').value) || 3;
  const dryPerMeal = dryGrams / meals;
  const wetPerMeal = wetGrams / meals;

  // Water intake estimation
  const waterFactor = currentSpecies === 'cat' ? 50 : 60;
  const waterMl = weight * waterFactor;

  // Render UI
  document.getElementById('resRER').textContent = Math.round(rer);
  document.getElementById('resDER').textContent = Math.round(der);
  document.getElementById('resMainCal').textContent = Math.round(mainFoodCal);
  document.getElementById('resTreatCal').textContent = Math.round(treatCal);

  document.getElementById('resDryCal').textContent = Math.round(dryCalTarget);
  document.getElementById('resDryGram').textContent = dryGrams.toFixed(1);

  document.getElementById('resWetCal').textContent = Math.round(wetCalTarget);
  document.getElementById('resWetGram').textContent = wetGrams.toFixed(1);

  document.getElementById('resTreatMaxCal').textContent = Math.round(treatCal);

  document.getElementById('resMealCount').textContent = meals;
  document.getElementById('resDryPerMeal').textContent = dryPerMeal.toFixed(1);
  document.getElementById('resWetPerMeal').textContent = wetPerMeal.toFixed(1);

  document.getElementById('resWater').textContent = Math.round(waterMl);
}

// Initial setup on page load
const hasSavedData = loadFromLocalStorage();
if (!hasSavedData) {
  populateStages();
  autoSelectStageByAge(true);
}
updatePetNameDisplay();
calculatePortion();
