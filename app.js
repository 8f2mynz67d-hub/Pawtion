// Initialize Lucide Icons
lucide.createIcons();

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

// Calculate total age in months
function getTotalAgeMonths() {
  const years = parseInt(document.getElementById('petAgeYears').value) || 0;
  const months = parseInt(document.getElementById('petAgeMonths').value) || 0;
  return (years * 12) + months;
}

// Auto-select stage based on species and age
function autoSelectStageByAge(force = false) {
  const totalMonths = getTotalAgeMonths();

  // อัปเดตเฉพาะตอนเปิดหน้าเว็บ, เปลี่ยนชนิดสัตว์ หรือมีการแก้ไขอายุเท่านั้น
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
}

// Switch between Cat & Dog
function selectSpecies(species) {
  currentSpecies = species;
  const btnCat = document.getElementById('btnCat');
  const btnDog = document.getElementById('btnDog');

  if (species === 'cat') {
    btnCat.className = 'py-2.5 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition tab-active';
    btnDog.className = 'py-2.5 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition text-purple-700 hover:bg-purple-100/60';
  } else {
    btnDog.className = 'py-2.5 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition tab-active';
    btnCat.className = 'py-2.5 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition text-purple-700 hover:bg-purple-100/60';
  }

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
  // ตรวจสอบและเลือกช่วงวัยอัตโนมัติหากมีการเปลี่ยนอายุ
  autoSelectStageByAge(false);

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
populateStages();
autoSelectStageByAge(true);
updatePetNameDisplay();
calculatePortion();
