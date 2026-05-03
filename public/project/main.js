const express = require("express");
const path = require("path");
const crypto = require("crypto");
const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// API KEYS — Replace these with your actual keys
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ============================================================
// ENVIRONMENT VARIABLES
// ============================================================

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const AI_ENABLED = Boolean(ANTHROPIC_API_KEY);

const CALL_ALERT_MODE = process.env.CALL_ALERT_MODE || "dashboard";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const ALERT_PHONE_NUMBER = process.env.ALERT_PHONE_NUMBER;

if (CALL_ALERT_MODE === "twilio") {
  const missingTwilioVars = [];

  if (!TWILIO_ACCOUNT_SID) missingTwilioVars.push("TWILIO_ACCOUNT_SID");
  if (!TWILIO_AUTH_TOKEN) missingTwilioVars.push("TWILIO_AUTH_TOKEN");
  if (!TWILIO_PHONE_NUMBER) missingTwilioVars.push("TWILIO_PHONE_NUMBER");
  if (!ALERT_PHONE_NUMBER) missingTwilioVars.push("ALERT_PHONE_NUMBER");

  if (missingTwilioVars.length > 0) {
    console.error("Missing Twilio environment variables:", missingTwilioVars.join(", "));
    process.exit(1);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EMBEDDED MAPPING DATA — mirrors your Bronze-layer mapping files
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const WARDS = [
  { ward_id: 1, ward_name: "Cardiology", floor: 3, capacity: 32, speciality: "Heart & Cardiovascular" },
  { ward_id: 2, ward_name: "Respiratory", floor: 2, capacity: 28, speciality: "Pulmonary Medicine" },
  { ward_id: 3, ward_name: "General Medicine", floor: 1, capacity: 40, speciality: "General" },
  { ward_id: 4, ward_name: "Neurology", floor: 4, capacity: 24, speciality: "Brain & Nervous System" },
  { ward_id: 5, ward_name: "Oncology", floor: 3, capacity: 20, speciality: "Cancer Treatment" },
  { ward_id: 6, ward_name: "Geriatrics", floor: 2, capacity: 36, speciality: "Elderly Care" },
  { ward_id: 7, ward_name: "ICU", floor: 1, capacity: 16, speciality: "Critical Care" },
  { ward_id: 8, ward_name: "Surgical", floor: 2, capacity: 30, speciality: "General Surgery" },
  { ward_id: 9, ward_name: "Paediatrics", floor: 3, capacity: 24, speciality: "Child Health" },
  { ward_id: 10, ward_name: "Emergency", floor: 0, capacity: 50, speciality: "Accident & Emergency" },
  { ward_id: 11, ward_name: "Orthopaedics", floor: 4, capacity: 28, speciality: "Bone & Joint" },
  { ward_id: 12, ward_name: "Maternity", floor: 1, capacity: 22, speciality: "Obstetrics" },
];

const DEVICE_MANUFACTURERS = [
  { id: 1, name: "Philips", country: "Netherlands" },
  { id: 2, name: "Medtronic", country: "Ireland" },
  { id: 3, name: "GE Healthcare", country: "United States" },
  { id: 4, name: "Masimo", country: "United States" },
  { id: 5, name: "Nihon Kohden", country: "Japan" },
  { id: 6, name: "Mindray", country: "China" },
  { id: 7, name: "Draeger", country: "Germany" },
  { id: 8, name: "Welch Allyn", country: "United States" },
];

const DEVICE_MODELS = {
  Philips: ["IntelliVue MX800", "IntelliVue X3", "SureSigns VS4"],
  Medtronic: ["Nellcor PM1000N", "BIS Vista", "Capnostream 35"],
  "GE Healthcare": ["Carescape B650", "Dash 5000", "DINAMAP ProCare"],
  Masimo: ["Radical-7", "Root", "Rad-97"],
  "Nihon Kohden": ["BSM-6000", "Life Scope G9", "PVM-2700"],
  Mindray: ["ePM 12M", "BeneVision N22", "iMEC 12"],
  Draeger: ["Infinity M540", "Vista 120", "Delta XL"],
  "Welch Allyn": ["Connex VSM 6000", "Spot Vital Signs", "ProBP 3400"],
};

const SENSOR_TYPES = [
  { id: 1, type: "Temperature", unit: "°C" },
  { id: 2, type: "Blood Pressure", unit: "mmHg" },
  { id: 3, type: "Heart Rate", unit: "bpm" },
  { id: 4, type: "SpO2", unit: "%" },
];

const DIAGNOSIS_CODES = [
  { id: 1, code: "I10", desc: "Essential hypertension", category: "Cardiovascular" },
  { id: 2, code: "I25.1", desc: "Atherosclerotic heart disease", category: "Cardiovascular" },
  { id: 3, code: "I48", desc: "Atrial fibrillation", category: "Cardiovascular" },
  { id: 4, code: "I50.9", desc: "Heart failure, unspecified", category: "Cardiovascular" },
  { id: 5, code: "J44.1", desc: "COPD with acute exacerbation", category: "Respiratory" },
  { id: 6, code: "J18.9", desc: "Pneumonia, unspecified", category: "Respiratory" },
  { id: 7, code: "J96.0", desc: "Acute respiratory failure", category: "Respiratory" },
  { id: 8, code: "E11.9", desc: "Type 2 diabetes mellitus", category: "Endocrine" },
  { id: 9, code: "E78.5", desc: "Dyslipidaemia, unspecified", category: "Endocrine" },
  { id: 10, code: "G40.9", desc: "Epilepsy, unspecified", category: "Neurological" },
  { id: 11, code: "N18.3", desc: "Chronic kidney disease, stage 3", category: "Renal" },
  { id: 12, code: "K70.3", desc: "Alcoholic liver cirrhosis", category: "Hepatic" },
  { id: 13, code: "D64.9", desc: "Anaemia, unspecified", category: "Haematological" },
  { id: 14, code: "A41.9", desc: "Sepsis, unspecified", category: "Infectious" },
  { id: 15, code: "R06.0", desc: "Dyspnoea", category: "Respiratory" },
  { id: 16, code: "R00.0", desc: "Tachycardia, unspecified", category: "Cardiovascular" },
];

const ALERT_LEVELS = [
  { id: 1, level: "Normal", colour: "#059669", bg: "#d1fae5", border: "#6ee7b7", response: null },
  { id: 2, level: "Low", colour: "#ca8a04", bg: "#fef9c3", border: "#fde047", response: 60 },
  { id: 3, level: "Elevated", colour: "#ea580c", bg: "#fff7ed", border: "#fdba74", response: 30 },
  { id: 4, level: "High", colour: "#dc2626", bg: "#fef2f2", border: "#fca5a5", response: 15 },
  { id: 5, level: "Critical", colour: "#7c3aed", bg: "#f5f3ff", border: "#c4b5fd", response: 5 },
];

const INSURANCE_PROVIDERS = [
  "NHS Trust", "Bupa", "AXA Health", "Vitality", "Aviva",
  "Cigna", "Allianz", "WPA", "Freedom Health", "Benenden",
];

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const BLOOD_WEIGHTS = [34, 6, 9, 2, 3, 1, 38, 7];

const FIRST_NAMES_M = ["James","Robert","John","Michael","David","William","Richard","Joseph","Thomas","Christopher","Daniel","Matthew","Anthony","Mark","Andrew","Joshua","Steven","Paul","Kevin","Brian"];
const FIRST_NAMES_F = ["Mary","Patricia","Jennifer","Linda","Elizabeth","Barbara","Susan","Jessica","Sarah","Karen","Lisa","Nancy","Betty","Margaret","Sandra","Ashley","Dorothy","Kimberly","Emily","Donna"];
const LAST_NAMES = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez","Hernandez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin","Lee","Thompson"];
const DOCTOR_TITLES = ["Dr","Prof","Mr","Ms"];

const FIRMWARE = ["v2.1.0","v2.3.1","v3.0.0","v3.1.2","v3.2.0","v4.0.1","v4.1.0","v4.2.3"];
const ADMISSION_TYPES = ["Emergency","Elective","Transfer","Observation"];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UTILITY FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function uuid() { return crypto.randomUUID(); }

function weightedPick(arr, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < arr.length; i++) {
    r -= weights[i];
    if (r <= 0) return arr[i];
  }
  return arr[arr.length - 1];
}

function gaussRandom(mean, stddev) {
  const u = 1 - Math.random();
  const v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * stddev;
}

function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PATIENT & DEVICE POOLS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildPatientPool(n = 80) {
  const patients = [];
  for (let i = 0; i < n; i++) {
    const gender = Math.random() > 0.5 ? "Male" : "Female";
    const first = pick(gender === "Male" ? FIRST_NAMES_M : FIRST_NAMES_F);
    const last = pick(LAST_NAMES);
    const year = randInt(1935, 1997);
    const month = String(randInt(1, 12)).padStart(2, "0");
    const day = String(randInt(1, 28)).padStart(2, "0");
    patients.push({
      patient_id: uuid(),
      patient_name: `${first} ${last}`,
      patient_dob: `${year}-${month}-${day}`,
      patient_gender: gender,
      patient_blood_type: weightedPick(BLOOD_TYPES, BLOOD_WEIGHTS),
      patient_insurance: pick(INSURANCE_PROVIDERS),
      patient_nhs: `${randInt(100,999)} ${randInt(100,999)} ${randInt(1000,9999)}`,
    });
  }
  return patients;
}

function buildDevicePool(n = 40) {
  const devices = [];
  for (let i = 0; i < n; i++) {
    const mfr = pick(DEVICE_MANUFACTURERS);
    const model = pick(DEVICE_MODELS[mfr.name]);
    devices.push({
      device_id: uuid(),
      device_serial: `${mfr.name.substring(0, 3).toUpperCase()}-${randInt(10000,99999)}-${String.fromCharCode(65 + randInt(0,9))}${randInt(1,9)}`,
      device_manufacturer: mfr.name,
      device_manufacturer_id: mfr.id,
      device_model: model,
      device_firmware: pick(FIRMWARE),
    });
  }
  return devices;
}

function buildDoctorPool(n = 20) {
  return Array.from({ length: n }, () => ({
    name: `${pick(DOCTOR_TITLES)} ${pick([...FIRST_NAMES_M, ...FIRST_NAMES_F])} ${pick(LAST_NAMES)}`,
    gmc: `GMC-${randInt(1000000, 9999999)}`,
  }));
}

const PATIENT_POOL = buildPatientPool(80);
const DEVICE_POOL = buildDevicePool(40);
const DOCTOR_POOL = buildDoctorPool(20);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ALERT CLASSIFICATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function classifyAlert(hr, sysBP, diaBP, temp, spo2) {
  let score = 0;
  if (hr < 50 || hr > 130) score += 3; else if (hr < 60 || hr > 100) score += 1;
  if (sysBP < 80 || sysBP > 180) score += 3; else if (sysBP < 90 || sysBP > 140) score += 1;
  if (diaBP < 50 || diaBP > 120) score += 3; else if (diaBP < 60 || diaBP > 90) score += 1;
  if (temp < 35.0 || temp > 39.5) score += 3; else if (temp < 36.0 || temp > 38.0) score += 1;
  if (spo2 < 90) score += 3; else if (spo2 < 95) score += 1;
  if (score === 0) return 1;
  if (score <= 2) return 2;
  if (score <= 4) return 3;
  if (score <= 7) return 4;
  return 5;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EVENT GENERATOR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function generateVitalReading() {
  const patient = pick(PATIENT_POOL);
  const device = pick(DEVICE_POOL);
  const ward = pick(WARDS);
  const sensor = pick(SENSOR_TYPES);
  const diagnosis = pick(DIAGNOSIS_CODES);
  const doctor = pick(DOCTOR_POOL);
  const admission = pick(ADMISSION_TYPES);

  const bedNum = `${ward.ward_name.substring(0, 3).toUpperCase()}-${ward.floor}${String(randInt(1, 30)).padStart(2, "0")}`;

  const hr = Math.round(clamp(gaussRandom(78, 12), 40, 150) * 10) / 10;
  const sysBP = Math.round(clamp(gaussRandom(125, 18), 70, 200) * 10) / 10;
  const diaBP = Math.round(clamp(gaussRandom(80, 10), 40, 130) * 10) / 10;
  const temp = Math.round(clamp(gaussRandom(37.0, 0.4), 34.5, 40.5) * 10) / 10;
  const spo2 = weightedPick([randInt(96, 100), randInt(92, 96), randInt(85, 91)], [75, 20, 5]);
  const respRate = weightedPick([randInt(12, 20), randInt(20, 28), randInt(28, 35)], [70, 25, 5]);
  const battery = randInt(20, 100);

  const targetSysBP = pick([120, 130, 140, 150]);
  const targetHR = pick([70, 80, 90]);
  const healthStatus = (sysBP <= targetSysBP && hr <= targetHR) ? "Healthy" : "Unhealthy";
  const alertId = classifyAlert(hr, sysBP, diaBP, temp, spo2);
  const alert = ALERT_LEVELS.find(a => a.id === alertId);

  const now = new Date();

  return {
    reading_id: uuid(),
    reading_reference: `VR-${randInt(1000, 9999)}-${String.fromCharCode(65 + randInt(0, 25))}${String.fromCharCode(65 + randInt(0, 25))}${randInt(10, 99)}`,
    patient_id: patient.patient_id,
    patient_name: patient.patient_name,
    patient_dob: patient.patient_dob,
    patient_gender: patient.patient_gender,
    patient_blood_type: patient.patient_blood_type,
    patient_insurance: patient.patient_insurance,
    patient_nhs: patient.patient_nhs,
    device_id: device.device_id,
    device_serial: device.device_serial,
    device_manufacturer: device.device_manufacturer,
    device_model: device.device_model,
    device_firmware: device.device_firmware,
    sensor_type: sensor.type,
    sensor_unit: sensor.unit,
    ward_id: ward.ward_id,
    ward_name: ward.ward_name,
    ward_floor: ward.floor,
    bed_number: bedNum,
    diagnosis_code: diagnosis.code,
    diagnosis_desc: diagnosis.desc,
    diagnosis_category: diagnosis.category,
    attending_doctor: doctor.name,
    attending_doctor_gmc: doctor.gmc,
    admission_type: admission,
    heart_rate_bpm: hr,
    systolic_bp: sysBP,
    diastolic_bp: diaBP,
    temperature_c: temp,
    spo2_pct: spo2,
    respiratory_rate: respRate,
    device_battery_pct: battery,
    target_systolic_bp: targetSysBP,
    target_heart_rate: targetHR,
    health_status: healthStatus,
    alert_level_id: alertId,
    alert_level: alert.level,
    alert_colour: alert.colour,
    alert_bg: alert.bg,
    alert_border: alert.border,
    alert_response_min: alert.response,
    reading_timestamp: now.toISOString(),
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TWILIO VOICE ALERTS — calls your phone when patient hits Elevated or above
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const callLog = [];  // Track sent alerts to avoid spamming

async function sendCallAlert(reading) {
  // Only call for Elevated (3), High (4) or Critical (5) alerts
  if (reading.alert_level_id < 3) return null;

  // Rate limit: don't call more than once per patient per 5 minutes
  const recentCall = callLog.find(
    c => c.patient_id === reading.patient_id && (Date.now() - c.sent_at) < 300000
  );
  if (recentCall) return null;

  if (CALL_ALERT_MODE !== "twilio") {
    console.log(
      `Clinical alert for ${reading.patient_name} (${reading.alert_level}); dashboard alert only — Twilio is off (set CALL_ALERT_MODE=twilio when running Node outside BrowserPod).`
    );
    return makeDashboardAlert(reading, "Twilio disabled — dashboard alert only");
  }

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER || !ALERT_PHONE_NUMBER) {
    console.log(`Clinical alert logged for ${reading.patient_name}; Twilio credentials not configured.`);
    return makeDashboardAlert(reading, "Twilio credentials not configured");
  }

  // Build TwiML
  const severity = reading.alert_level.toUpperCase();
  const twiml = `<Response>
    <Pause length="1"/>
    <Say voice="alice" language="en-GB">Please pay attention.</Say>
    <Pause length="1"/>
    <Say voice="alice" language="en-GB">${severity} alert from VitalStream.</Say>
    <Pause length="1"/>
    <Say voice="alice" language="en-GB">Patient ${reading.patient_name}. ${reading.ward_name} ward, bed ${reading.bed_number}.</Say>
    <Pause length="1"/>
    <Say voice="alice" language="en-GB">Heart rate: ${reading.heart_rate_bpm} beats per minute.</Say>
    <Say voice="alice" language="en-GB">Blood pressure: ${reading.systolic_bp} over ${reading.diastolic_bp} millimetres of mercury.</Say>
    <Say voice="alice" language="en-GB">Oxygen saturation: ${reading.spo2_pct} percent.</Say>
    <Say voice="alice" language="en-GB">Temperature: ${reading.temperature_c} degrees celsius.</Say>
    <Say voice="alice" language="en-GB">Respiratory rate: ${reading.respiratory_rate} breaths per minute.</Say>
    <Pause length="1"/>
    <Say voice="alice" language="en-GB">Diagnosis: ${reading.diagnosis_desc}.</Say>
    <Say voice="alice" language="en-GB">Attending doctor: ${reading.attending_doctor}.</Say>
    <Pause length="1"/>
    <Say voice="alice" language="en-GB">Immediate clinical response required within ${reading.alert_response_min} minutes. Please check the VitalStream dashboard now.</Say>
    <Pause length="2"/>
    <Say voice="alice" language="en-GB">Repeating.</Say>
    <Pause length="1"/>
    <Say voice="alice" language="en-GB">${severity} alert from VitalStream. Patient ${reading.patient_name}. ${reading.ward_name} ward, bed ${reading.bed_number}. Heart rate ${reading.heart_rate_bpm}. Oxygen saturation ${reading.spo2_pct} percent. Immediate response required.</Say>
  </Response>`;

  // Auth — works in both Node.js and BrowserPod Wasm
  let auth;
  try { auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64"); }
  catch (e) { auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`); }

  const body = new URLSearchParams({
    To: ALERT_PHONE_NUMBER,
    From: TWILIO_PHONE_NUMBER,
    Twiml: twiml,
  });

  const headers = {
    "Authorization": `Basic ${auth}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };

  const directUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`;
  const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(directUrl)}`;

  // Attempt 1: Direct Twilio API call (works on normal Node; often fails inside BrowserPod Wasm)
  console.log(`📞 Attempting call for ${reading.patient_name} (${reading.alert_level})...`);
  try {
    const response = await fetch(directUrl, { method: "POST", headers, body: body.toString() });
    const result = await response.json();
    if (result.sid) {
      console.log(`✅ CALL sent (direct) for ${reading.patient_name} — SID: ${result.sid}`);
      return makeCallLog(reading, result.sid, "call_sent");
    }
    console.log(`❌ Direct call rejected: ${result.message || JSON.stringify(result)}`);
  } catch (e) {
    console.log(`❌ Direct call failed: ${e.message} — trying CORS proxy...`);
  }

  // Attempt 2: Via CORS proxy (works in BrowserPod)
  try {
    const response = await fetch(proxyUrl, { method: "POST", headers, body: body.toString() });
    const result = await response.json();
    if (result.sid) {
      console.log(`✅ CALL sent (via proxy) for ${reading.patient_name} — SID: ${result.sid}`);
      return makeCallLog(reading, result.sid, "call_sent");
    }
    console.log(`❌ Proxy call rejected: ${result.message || JSON.stringify(result)}`);
    return makeDashboardAlert(reading, result.message || "Call rejected by Twilio");
  } catch (e) {
    console.log(`❌ Proxy call failed: ${e.message} — falling back to dashboard alert`);
    return makeDashboardAlert(reading, e.message);
  }
}

function makeCallLog(reading, sid, type) {
  const entry = { patient_id: reading.patient_id, sent_at: Date.now(), sid, patient_name: reading.patient_name, alert_level: reading.alert_level, ward: reading.ward_name, bed: reading.bed_number, type };
  callLog.push(entry);
  if (callLog.length > 100) callLog.shift();
  return { success: true, sid, type };
}

function makeDashboardAlert(reading, error) {
  const entry = { patient_id: reading.patient_id, sent_at: Date.now(), sid: null, patient_name: reading.patient_name, alert_level: reading.alert_level, ward: reading.ward_name, bed: reading.bed_number, type: "dashboard_alert", error };
  callLog.push(entry);
  if (callLog.length > 100) callLog.shift();
  return { success: false, error, type: "dashboard_alert", patient_name: reading.patient_name, alert_level: reading.alert_level, ward: reading.ward_name, bed: reading.bed_number };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CLAUDE AI CLINICAL ASSESSMENT — analyses patient vitals in real time
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function getAiAssessment(reading) {
  if (!AI_ENABLED) {
    return { success: false, error: "Anthropic API key not configured" };
  }

  const prompt = `You are a clinical decision support AI integrated into a hospital patient monitoring system called VitalStream. A nurse has requested an AI assessment for the following patient. Provide a concise clinical summary.

PATIENT DATA:
- Name: ${reading.patient_name}
- DOB: ${reading.patient_dob} | Gender: ${reading.patient_gender} | Blood Type: ${reading.patient_blood_type}
- Diagnosis: ${reading.diagnosis_code} — ${reading.diagnosis_desc} (${reading.diagnosis_category})
- Ward: ${reading.ward_name} (Floor ${reading.ward_floor}) | Bed: ${reading.bed_number}
- Admission Type: ${reading.admission_type}
- Attending Doctor: ${reading.attending_doctor}
- Insurance: ${reading.patient_insurance}

CURRENT VITAL SIGNS:
- Heart Rate: ${reading.heart_rate_bpm} bpm (target: ${reading.target_heart_rate} bpm)
- Blood Pressure: ${reading.systolic_bp}/${reading.diastolic_bp} mmHg (target systolic: ${reading.target_systolic_bp} mmHg)
- Temperature: ${reading.temperature_c}°C
- SpO₂: ${reading.spo2_pct}%
- Respiratory Rate: ${reading.respiratory_rate} bpm
- Health Status: ${reading.health_status}
- Alert Level: ${reading.alert_level} (Level ${reading.alert_level_id}/5)
${reading.alert_response_min ? `- Response Required Within: ${reading.alert_response_min} minutes` : ""}

DEVICE:
- ${reading.device_manufacturer} ${reading.device_model} (Serial: ${reading.device_serial})
- Battery: ${reading.device_battery_pct}%

Provide your assessment in this exact format:
1. **Clinical Summary** (2-3 sentences: what is happening with this patient right now)
2. **Key Concerns** (bullet list of specific vital signs that are abnormal and why they matter given the diagnosis)
3. **Recommended Actions** (2-4 specific, actionable steps the clinical team should take)
4. **Risk Level** (one sentence: your assessment of immediate risk)

Keep the total response under 200 words. Be specific and clinical, not generic. Reference the patient's actual diagnosis when assessing their vitals.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();

    if (data.content && data.content[0]) {
      return { success: true, assessment: data.content[0].text };
    } else {
      console.log("Claude API response:", JSON.stringify(data));
      return { success: false, error: data.error?.message || "Unknown API error" };
    }
  } catch (err) {
    console.log(`Claude API error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// IN-MEMORY EVENT STORE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const readings = [];
const MAX_READINGS = 500;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// API ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Generate and store a new vital reading + trigger call if needed
app.post("/api/reading", async (req, res) => {
  const reading = generateVitalReading();
  readings.unshift(reading);
  if (readings.length > MAX_READINGS) readings.pop();

  // Trigger call alert for High/Critical readings
  let callResult = null;
  if (reading.alert_level_id >= 3) {
    callResult = await sendCallAlert(reading);
  }

  res.json({ success: true, reading, call: callResult });
});

// AI Clinical Assessment for a specific patient
app.post("/api/ai/assess", async (req, res) => {
  const { patient_id } = req.body;

  // Find the latest reading for this patient
  const reading = readings.find(r => r.patient_id === patient_id);
  if (!reading) {
    return res.json({ success: false, error: "Patient not found" });
  }

  const result = await getAiAssessment(reading);
  res.json(result);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AI TRIAGE AGENT — "Who should I see first?"
// Analyses ALL flagged patients simultaneously and ranks by clinical urgency
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

app.post("/api/ai/triage", async (req, res) => {
  if (!AI_ENABLED) {
    return res.json({ success: false, error: "Anthropic API key not configured" });
  }

  // Collect latest reading per patient, only flagged ones (alert >= 2 = Low or above)
  const latest = {};
  for (const r of readings) {
    if (!latest[r.patient_id] && r.alert_level_id >= 3) latest[r.patient_id] = r;
  }
  const flagged = Object.values(latest).sort((a, b) => b.alert_level_id - a.alert_level_id);
  flagged.splice(10);

  if (flagged.length === 0) {
    return res.json({ success: false, error: "No flagged patients to triage. All patients are currently in Normal status." });
  }

  const patientList = flagged.map((r, i) => {
    const age = new Date().getFullYear() - parseInt(r.patient_dob.split("-")[0]);
    return `PATIENT ${i + 1}: ${r.patient_name}
  Age: ${age} | Gender: ${r.patient_gender} | Blood Type: ${r.patient_blood_type}
  Ward: ${r.ward_name} | Bed: ${r.bed_number}
  Diagnosis: ${r.diagnosis_code} — ${r.diagnosis_desc} (${r.diagnosis_category})
  Admission: ${r.admission_type} | Doctor: ${r.attending_doctor}
  Current Alert: ${r.alert_level} (Level ${r.alert_level_id}/5)
  Vitals:
    Heart Rate: ${r.heart_rate_bpm} bpm (target: ${r.target_heart_rate})
    Blood Pressure: ${r.systolic_bp}/${r.diastolic_bp} mmHg (target systolic: ${r.target_systolic_bp})
    Temperature: ${r.temperature_c}°C | SpO2: ${r.spo2_pct}%
    Respiratory Rate: ${r.respiratory_rate} bpm
    Health Status: ${r.health_status}`;
  }).join("\n\n");

  const prompt = `You are a senior clinical triage AI agent in a UK hospital, integrated into the VitalStream patient monitoring system. A nurse is starting their shift and needs to know which patients to attend to first.

There are currently ${flagged.length} patients with flagged vital signs. Analyse ALL of them simultaneously and provide a prioritised triage order.

${patientList}

Provide your triage assessment in this exact format:

**TRIAGE PRIORITY ORDER**

For each patient, ranked from most urgent to least urgent:

[RANK]. [PATIENT NAME] — [PRIORITY: IMMEDIATE / URGENT / SOON / MONITOR]
   Ward: [ward] · Bed: [bed]
   Key concern: [1-2 sentences explaining WHY this patient ranks here — reference their specific vitals + diagnosis combination]
   Action: [specific clinical action to take right now]

After ranking all patients, provide:

**SHIFT SUMMARY**
A 2-3 sentence overview for the nurse: how many patients need immediate attention, any concerning patterns across the ward, and an estimated time to complete the initial round.

Be specific. Reference actual vital values. Consider how each patient's diagnosis interacts with their current vitals — e.g., a heart rate of 95 is more concerning for a patient with atrial fibrillation than for a healthy patient. Do not give generic advice.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();

    if (data.content && data.content[0]) {
      console.log(`🧠 TRIAGE completed for ${flagged.length} patients`);
      res.json({
        success: true,
        triage: data.content[0].text,
        patient_count: flagged.length,
        patients_triaged: flagged.map(r => ({ name: r.patient_name, alert: r.alert_level, ward: r.ward_name, bed: r.bed_number })),
      });
    } else {
      console.log("Triage API response:", JSON.stringify(data));
      res.json({ success: false, error: data.error?.message || "Unknown API error" });
    }
  } catch (err) {
    console.log(`Triage API error: ${err.message}`);
    res.json({ success: false, error: err.message });
  }
});

// Get all readings (latest first)
app.get("/api/readings", (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(readings.slice(0, limit));
});

// Get latest reading per patient (current ward view)
app.get("/api/patients/current", (req, res) => {
  const latest = {};
  for (const r of readings) {
    if (!latest[r.patient_id]) latest[r.patient_id] = r;
  }

  // For each patient, compute trends from their last 8 readings
  const patientsWithTrends = Object.values(latest).map(patient => {
    const history = readings.filter(r => r.patient_id === patient.patient_id).slice(0, 8);

    function computeTrend(values) {
      if (values.length < 3) return { arrow: "→", direction: "stable", delta: 0 };
      const recent = values.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
      const older = values.slice(-3).reduce((a, b) => a + b, 0) / 3;
      const delta = recent - older;
      const pctChange = Math.abs(delta / (older || 1)) * 100;
      if (pctChange < 3) return { arrow: "→", direction: "stable", delta: Math.round(delta * 10) / 10 };
      if (delta > 0) return { arrow: "↑", direction: "rising", delta: Math.round(delta * 10) / 10 };
      return { arrow: "↓", direction: "falling", delta: Math.round(delta * 10) / 10 };
    }

    const trends = {
      heart_rate: computeTrend(history.map(r => r.heart_rate_bpm)),
      systolic_bp: computeTrend(history.map(r => r.systolic_bp)),
      diastolic_bp: computeTrend(history.map(r => r.diastolic_bp)),
      temperature: computeTrend(history.map(r => r.temperature_c)),
      spo2: computeTrend(history.map(r => r.spo2_pct)),
      respiratory_rate: computeTrend(history.map(r => r.respiratory_rate)),
    };

    // Detect "trending toward danger" — vitals moving toward thresholds
    let danger_signals = [];
    if (trends.heart_rate.direction === "rising" && patient.heart_rate_bpm > 90)
      danger_signals.push("HR rising toward tachycardia");
    if (trends.heart_rate.direction === "falling" && patient.heart_rate_bpm < 65)
      danger_signals.push("HR dropping toward bradycardia");
    if (trends.systolic_bp.direction === "rising" && patient.systolic_bp > 130)
      danger_signals.push("BP rising toward hypertensive range");
    if (trends.systolic_bp.direction === "falling" && patient.systolic_bp < 95)
      danger_signals.push("BP dropping toward hypotensive range");
    if (trends.temperature.direction === "rising" && patient.temperature_c > 37.5)
      danger_signals.push("Temperature trending toward fever");
    if (trends.spo2.direction === "falling" && patient.spo2_pct < 96)
      danger_signals.push("SpO₂ declining — risk of desaturation");
    if (trends.respiratory_rate.direction === "rising" && patient.respiratory_rate > 18)
      danger_signals.push("Respiratory rate escalating");

    return {
      ...patient,
      trends,
      danger_signals,
      trending_toward_danger: danger_signals.length > 0,
      readings_in_history: history.length,
    };
  });

  patientsWithTrends.sort((a, b) => {
    // Danger-trending patients first, then by alert level
    if (a.trending_toward_danger && !b.trending_toward_danger) return -1;
    if (!a.trending_toward_danger && b.trending_toward_danger) return 1;
    return b.alert_level_id - a.alert_level_id;
  });

  res.json(patientsWithTrends);
});

// Get ward summary
app.get("/api/wards", (req, res) => {
  const wardStats = {};
  const latest = {};
  for (const r of readings) {
    if (!latest[r.patient_id]) latest[r.patient_id] = r;
  }
  for (const r of Object.values(latest)) {
    if (!wardStats[r.ward_id]) {
      const w = WARDS.find(w => w.ward_id === r.ward_id);
      wardStats[r.ward_id] = { ...w, patients: 0, critical: 0, high: 0, elevated: 0, normal: 0 };
    }
    wardStats[r.ward_id].patients++;
    if (r.alert_level_id >= 4) wardStats[r.ward_id].critical++;
    else if (r.alert_level_id === 3) wardStats[r.ward_id].elevated++;
    else wardStats[r.ward_id].normal++;
  }
  res.json(Object.values(wardStats).sort((a, b) => b.critical - a.critical));
});

// Get alert summary counts
app.get("/api/alerts/summary", (req, res) => {
  const latest = {};
  for (const r of readings) {
    if (!latest[r.patient_id]) latest[r.patient_id] = r;
  }
  const counts = { total: 0, normal: 0, low: 0, elevated: 0, high: 0, critical: 0 };
  for (const r of Object.values(latest)) {
    counts.total++;
    if (r.alert_level_id === 1) counts.normal++;
    else if (r.alert_level_id === 2) counts.low++;
    else if (r.alert_level_id === 3) counts.elevated++;
    else if (r.alert_level_id === 4) counts.high++;
    else if (r.alert_level_id === 5) counts.critical++;
  }
  res.json(counts);
});

// Get call alert log
app.get("/api/call/log", (req, res) => {
  res.json(callLog.slice(-20).reverse());
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AI CHAT — nurse asks natural language questions about patients
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

app.post("/api/ai/chat", async (req, res) => {
  const { question } = req.body;
  if (!question) return res.json({ success: false, error: "No question provided" });
  if (!AI_ENABLED) return res.json({ success: false, error: "Anthropic API key not configured" });

  // Build current patient context
  const latest = {};
  for (const r of readings) {
    if (!latest[r.patient_id]) latest[r.patient_id] = r;
  }
  const allPatients = Object.values(latest);

  const patientSummary = allPatients.map(r => {
    const age = new Date().getFullYear() - parseInt(r.patient_dob.split("-")[0]);
    return `${r.patient_name} | Age ${age} | ${r.patient_gender} | ${r.ward_name} Bed ${r.bed_number} | ${r.diagnosis_code} ${r.diagnosis_desc} (${r.diagnosis_category}) | Alert: ${r.alert_level} | HR ${r.heart_rate_bpm} | BP ${r.systolic_bp}/${r.diastolic_bp} | Temp ${r.temperature_c}°C | SpO₂ ${r.spo2_pct}% | Resp ${r.respiratory_rate} | Status: ${r.health_status} | Doctor: ${r.attending_doctor}`;
  }).join("\n");

  const wardSummary = {};
  allPatients.forEach(r => {
    if (!wardSummary[r.ward_name]) wardSummary[r.ward_name] = { total: 0, elevated: 0, high: 0, critical: 0 };
    wardSummary[r.ward_name].total++;
    if (r.alert_level_id === 3) wardSummary[r.ward_name].elevated++;
    if (r.alert_level_id === 4) wardSummary[r.ward_name].high++;
    if (r.alert_level_id === 5) wardSummary[r.ward_name].critical++;
  });

  const prompt = `You are VitalStream AI, a clinical assistant integrated into a hospital patient monitoring dashboard. A nurse is asking you a question about the current patients. Answer concisely and specifically using the live patient data below.

CURRENT WARD STATUS (${allPatients.length} patients monitored):
${Object.entries(wardSummary).map(([w, s]) => `${w}: ${s.total} patients (${s.elevated} elevated, ${s.high} high, ${s.critical} critical)`).join("\n")}

ALL CURRENT PATIENTS:
${patientSummary}

NURSE'S QUESTION: "${question}"

Rules:
- Be concise — max 150 words
- Reference specific patient names, bed numbers, and vital values
- If asked about a ward, filter to that ward's patients only
- If asked to compare or rank, use the actual numbers
- If the question is unclear, ask for clarification
- Use clinical language but keep it accessible`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await response.json();
    if (data.content && data.content[0]) {
      res.json({ success: true, answer: data.content[0].text });
    } else {
      res.json({ success: false, error: data.error?.message || "Unknown error" });
    }
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AI SHIFT HANDOVER REPORT — generates a complete handover for incoming nurse
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

app.post("/api/ai/handover", async (req, res) => {
  if (!AI_ENABLED) return res.json({ success: false, error: "Anthropic API key not configured" });

  const latest = {};
  for (const r of readings) {
    if (!latest[r.patient_id]) latest[r.patient_id] = r;
  }
  const allPatients = Object.values(latest);
  const flagged = allPatients.filter(r => r.alert_level_id >= 3);
  const callCount = callLog.length;

  const patientDetails = allPatients.map(r => {
    const age = new Date().getFullYear() - parseInt(r.patient_dob.split("-")[0]);
    return `${r.patient_name} (Age ${age}, ${r.patient_gender}) | ${r.ward_name} Bed ${r.bed_number} | ${r.diagnosis_code} ${r.diagnosis_desc} | Alert: ${r.alert_level} | HR ${r.heart_rate_bpm} BP ${r.systolic_bp}/${r.diastolic_bp} Temp ${r.temperature_c} SpO₂ ${r.spo2_pct}% Resp ${r.respiratory_rate} | Doctor: ${r.attending_doctor} | Status: ${r.health_status}`;
  }).join("\n");

  const callDetails = callLog.length > 0
    ? callLog.map(c => `${new Date(c.sent_at).toLocaleTimeString("en-GB")} — ${c.alert_level} alert for ${c.patient_name} (${c.ward} Bed ${c.bed})`).join("\n")
    : "No call alerts were triggered during this shift.";

  const now = new Date();
  const shiftStart = new Date(now.getTime() - 8 * 60 * 60 * 1000);

  const prompt = `You are VitalStream AI generating a clinical shift handover report for an NHS hospital. The outgoing nurse is handing over to the incoming nurse. Generate a professional, structured handover document.

SHIFT DETAILS:
- Date: ${now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
- Shift: ${shiftStart.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} — ${now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
- Total patients monitored: ${allPatients.length}
- Patients currently flagged (Elevated or above): ${flagged.length}
- Phone call alerts triggered: ${callCount}

CALL ALERT LOG:
${callDetails}

ALL CURRENT PATIENTS:
${patientDetails}

Generate the handover report in this exact format:

**SHIFT HANDOVER REPORT**
**VitalStream Patient Monitoring System**
**${now.toLocaleDateString("en-GB")} — ${shiftStart.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} to ${now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}**

**1. SHIFT OVERVIEW**
(2-3 sentences: total patients, overall ward status, any notable events)

**2. PATIENTS REQUIRING ATTENTION**
(For each flagged patient: name, ward, bed, diagnosis, current vitals, what to watch for. If no flagged patients, state "All patients currently stable.")

**3. ALERTS TRIGGERED**
(Summary of phone call alerts sent during this shift, or "No alerts triggered")

**4. WARD-BY-WARD SUMMARY**
(1 sentence per ward that has patients: patient count and any concerns)

**5. RECOMMENDATIONS FOR INCOMING NURSE**
(3-4 specific, actionable priorities for the next shift)

**Handover prepared by:** VitalStream AI Clinical Assistant
**Report generated:** ${now.toLocaleTimeString("en-GB")}

Be specific. Use actual patient names, vital values, and ward locations. This is a clinical document — be precise and professional.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await response.json();
    if (data.content && data.content[0]) {
      console.log("📋 Shift handover report generated");
      res.json({ success: true, report: data.content[0].text, patient_count: allPatients.length, flagged_count: flagged.length, call_count: callCount });
    } else {
      res.json({ success: false, error: data.error?.message || "Unknown error" });
    }
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Reference data endpoints
app.get("/api/ref/wards", (req, res) => res.json(WARDS));
app.get("/api/ref/alerts", (req, res) => res.json(ALERT_LEVELS));
app.get("/api/ref/diagnoses", (req, res) => res.json(DIAGNOSIS_CODES));

// Serve dashboard
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// START SERVER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

app.listen(PORT, () => {
  console.log(`VitalStream server running on port ${PORT}`);
  console.log(`BrowserPod mode: phone calls use dashboard alerts unless CALL_ALERT_MODE=twilio is set.`);
  console.log(`AI Assessment: ${AI_ENABLED ? "ENABLED" : "DISABLED - set ANTHROPIC_API_KEY"}`);
  console.log(`Call Alerts: ${CALL_ALERT_MODE === "twilio" ? "TWILIO" : "DASHBOARD ONLY"}`);
  for (let i = 0; i < 15; i++) {
    readings.push(generateVitalReading());
  }
  console.log(`Seeded ${readings.length} initial readings`);
});
