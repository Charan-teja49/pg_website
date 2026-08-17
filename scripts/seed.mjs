// scripts/seed.mjs
//
// Translates supabase/migrations/0004_test_data.sql into a Node script
// that uses @supabase/supabase-js with the service role key.
//
// Usage:
//   $env:SUPABASE_SERVICE_KEY = "<key>"; node scripts/seed.mjs
//   $env:SUPABASE_SERVICE_KEY = "<key>"; node scripts/seed.mjs --force
//
// --force will delete existing operational rows first
// (students/fee_structures/payments/complaints/room_change_requests/
// non-global announcements/maintenance) and clear bed assignments.
// It will NOT touch buildings/units/beds/admins (other than clearing
// is_occupied/student_id on beds), and will NOT delete food_menu rows
// (only update them).
//
// Idempotency: if students already exist and --force is not passed,
// the script bails out with a friendly message.

import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

// supabase-js' realtime client requires a global WebSocket constructor
// on Node < 22. We don't use realtime here, but the SupabaseClient
// constructor still instantiates RealtimeClient eagerly. Polyfill it.
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket;
}

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://nedgpqnytcmfocjwocds.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_KEY env var is required.');
  console.error('  PowerShell: $env:SUPABASE_SERVICE_KEY = "<key>"; node scripts/seed.mjs');
  process.exit(1);
}

const FORCE = process.argv.includes('--force');

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ------------------------------------------------------------------
// Static data (mirrors 0004_test_data.sql)
// ------------------------------------------------------------------

// 20 students. building_id refs buildings table (1..4 from 0002).
const STUDENTS = [
  // Chalapathi Main (building 1) — 6
  { mobile: '9876500001', name: 'Aarav Sharma',      building_id: 1, course: 'B.Tech', college_id: 'CSE2024001', parent_mobile: '9123450001', branch: 'Computer Science Engineering',  aadhaar_number: '234511110001', notes: 'Vegetarian; prefers ground floor', status: 'active' },
  { mobile: '9876500002', name: 'Vivek Reddy',       building_id: 1, course: 'B.Tech', college_id: 'ECE2023012', parent_mobile: '9123450002', branch: 'Electronics & Communication',   aadhaar_number: '234511110002', notes: null,                              status: 'active' },
  { mobile: '9876500003', name: 'Karthik Iyer',      building_id: 1, course: 'B.Tech', college_id: 'MEC2024045', parent_mobile: '9123450003', branch: 'Mechanical Engineering',        aadhaar_number: '234511110003', notes: null,                              status: 'active' },
  { mobile: '9876500004', name: 'Rahul Verma',       building_id: 1, course: 'B.Tech', college_id: 'CSE2023089', parent_mobile: '9123450004', branch: 'Computer Science Engineering',  aadhaar_number: '234511110004', notes: 'Allergic to dairy',               status: 'active' },
  { mobile: '9876500005', name: 'Pradeep Kumar',     building_id: 1, course: 'BBA',    college_id: 'BBA2024021', parent_mobile: '9123450005', branch: 'Business Administration',       aadhaar_number: '234511110005', notes: null,                              status: 'active' },
  { mobile: '9876500006', name: 'Suresh Naidu',      building_id: 1, course: 'B.Tech', college_id: 'CIV2023034', parent_mobile: '9123450006', branch: 'Civil Engineering',             aadhaar_number: '234511110006', notes: null,                              status: 'active' },
  // Stanza (building 2) — 5
  { mobile: '8765400007', name: 'Ananya Reddy',      building_id: 2, course: 'B.Tech', college_id: 'CSE2024112', parent_mobile: '9123450007', branch: 'Computer Science Engineering',  aadhaar_number: '234511110007', notes: null,                              status: 'active' },
  { mobile: '8765400008', name: 'Priya Nair',        building_id: 2, course: 'B.Tech', college_id: 'ECE2024056', parent_mobile: '9123450008', branch: 'Electronics & Communication',   aadhaar_number: '234511110008', notes: 'Late night classes — gate pass',  status: 'active' },
  { mobile: '8765400009', name: 'Sneha Patel',       building_id: 2, course: 'B.Sc',   college_id: 'BSC2023078', parent_mobile: '9123450009', branch: 'Bachelor of Science',           aadhaar_number: '234511110009', notes: null,                              status: 'active' },
  { mobile: '8765400010', name: 'Divya Krishnan',    building_id: 2, course: 'B.Tech', college_id: 'IT-2024023', parent_mobile: '9123450010', branch: 'Information Technology',        aadhaar_number: '234511110010', notes: null,                              status: 'active' },
  { mobile: '8765400011', name: 'Rohan Mehta',       building_id: 2, course: 'MBA',    college_id: 'MBA2024009', parent_mobile: '9123450011', branch: 'Business Administration',       aadhaar_number: '234511110011', notes: null,                              status: 'active' },
  // Villas (building 3) — 5
  { mobile: '7654300012', name: 'Arjun Choudhary',   building_id: 3, course: 'B.Tech', college_id: 'CSE2023145', parent_mobile: '9123450012', branch: 'Computer Science Engineering',  aadhaar_number: '234511110012', notes: 'Early-morning gym — needs key',   status: 'active' },
  { mobile: '7654300013', name: 'Siddharth Joshi',   building_id: 3, course: 'B.Tech', college_id: 'CSE2024198', parent_mobile: '9123450013', branch: 'Computer Science Engineering',  aadhaar_number: '234511110013', notes: null,                              status: 'active' },
  { mobile: '7654300014', name: 'Manish Kulkarni',   building_id: 3, course: 'B.Tech', college_id: 'ECE2023167', parent_mobile: '9123450014', branch: 'Electronics & Communication',   aadhaar_number: '234511110014', notes: null,                              status: 'active' },
  { mobile: '7654300015', name: 'Akhil Subramanian', building_id: 3, course: 'B.Tech', college_id: 'AIE2024003', parent_mobile: '9123450015', branch: 'Artificial Intelligence',       aadhaar_number: '234511110015', notes: null,                              status: 'active' },
  { mobile: '7654300016', name: 'Harish Bhat',       building_id: 3, course: 'B.Tech', college_id: 'MEC2023201', parent_mobile: '9123450016', branch: 'Mechanical Engineering',        aadhaar_number: '234511110016', notes: null,                              status: 'active' },
  // Siddha Middle Block (building 4) — 4
  { mobile: '6543200017', name: 'Lakshmi Devi',      building_id: 4, course: 'B.Tech', college_id: 'CSE2024076', parent_mobile: '9123450017', branch: 'Computer Science Engineering',  aadhaar_number: '234511110017', notes: null,                              status: 'active' },
  { mobile: '6543200018', name: 'Kavya Menon',       building_id: 4, course: 'B.Tech', college_id: 'IT-2023044', parent_mobile: '9123450018', branch: 'Information Technology',        aadhaar_number: '234511110018', notes: null,                              status: 'active' },
  { mobile: '6543200019', name: 'Ramya Sundaram',    building_id: 4, course: 'B.Sc',   college_id: 'BSC2024055', parent_mobile: '9123450019', branch: 'Bachelor of Science',           aadhaar_number: '234511110019', notes: 'Vegetarian Jain food',            status: 'active' },
  { mobile: '6543200020', name: 'Pooja Iyengar',     building_id: 4, course: 'BBA',    college_id: 'BBA2023117', parent_mobile: '9123450020', branch: 'Business Administration',       aadhaar_number: '234511110020', notes: null,                              status: 'active' },
];

// 14 bed assignments — looked up by (building_id, unit label, bed label)
const BED_ASSIGNMENTS = [
  { mobile: '9876500001', building_id: 1, unit_label: 'F-001',   bed_label: 'Bed 1' },
  { mobile: '9876500002', building_id: 1, unit_label: 'F-001',   bed_label: 'Bed 2' },
  { mobile: '9876500004', building_id: 1, unit_label: 'F-002',   bed_label: 'Bed 1' },
  { mobile: '9876500005', building_id: 1, unit_label: 'F-005',   bed_label: 'Bed 1' },
  { mobile: '8765400007', building_id: 2, unit_label: 'S-1A-R1', bed_label: 'Bed 1' },
  { mobile: '8765400008', building_id: 2, unit_label: 'S-1A-R1', bed_label: 'Bed 2' },
  { mobile: '8765400009', building_id: 2, unit_label: 'S-2A-R1', bed_label: 'Bed 1' },
  { mobile: '8765400010', building_id: 2, unit_label: 'S-3B-R2', bed_label: 'Bed 1' },
  { mobile: '7654300012', building_id: 3, unit_label: 'Villa-1', bed_label: 'Bed 1' },
  { mobile: '7654300013', building_id: 3, unit_label: 'Villa-1', bed_label: 'Bed 2' },
  { mobile: '7654300015', building_id: 3, unit_label: 'Villa-2', bed_label: 'Bed 1' },
  // Note: 0004 SQL only assigns 11 beds in source, despite header saying 14.
  // We mirror the SQL exactly. Karthik (F-002 Bed?), no — re-check:
  // SQL section comments list Aarav, Vivek, Karthik(?), Pradeep for Chalapathi
  // but actual statements assign Aarav, Vivek, Rahul, Pradeep. We follow
  // the statements (4 in Chalapathi, 4 in Stanza, 3 in Villas = 11).
];

const SEMESTER_MOBILES = new Set(['9876500002', '8765400009', '8765400011', '7654300015', '6543200020']);

const FEE_TABLE = {
  1: { yearly: 95000,  electricity: 5000, non_refundable: 2000, total: 102000 },
  2: { yearly: 85000,  electricity:    0, non_refundable: 2000, total:  87000 },
  3: { yearly: 100000, electricity:    0, non_refundable: 2000, total: 102000 },
  4: { yearly: 85000,  electricity: 5000, non_refundable: 2000, total:  92000 },
};

// All payment rows (mobile + offsets in days from today)
const today = new Date();
const dateMinus = (days) => {
  const d = new Date(today);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

const PAYMENTS = [
  // Aarav (102000) — FULLY PAID
  { mobile: '9876500001', amount: 50000, payment_mode: 'Online', payment_method: 'PhonePe',       payment_date: dateMinus(105), received_by: 'Charan',   transaction_notes: 'Initial admission deposit' },
  { mobile: '9876500001', amount: 30000, payment_mode: 'Online', payment_method: 'Google Pay',    payment_date: dateMinus( 60), received_by: 'Charan',   transaction_notes: null },
  { mobile: '9876500001', amount: 22000, payment_mode: 'Cash',   payment_method: null,            payment_date: dateMinus( 20), received_by: 'Ramesh',   transaction_notes: 'Final balance' },
  // Vivek (102000) — PARTIAL
  { mobile: '9876500002', amount: 40000, payment_mode: 'Online', payment_method: 'PhonePe',       payment_date: dateMinus( 90), received_by: 'Charan',   transaction_notes: null },
  { mobile: '9876500002', amount: 25000, payment_mode: 'Cash',   payment_method: null,            payment_date: dateMinus( 30), received_by: 'Ramesh',   transaction_notes: null },
  // Karthik (102000) — FULLY PAID
  { mobile: '9876500003', amount: 102000, payment_mode: 'Online', payment_method: 'Bank Transfer', payment_date: dateMinus(100), received_by: 'Charan',   transaction_notes: 'Lump sum yearly' },
  // Rahul (102000) — PARTIAL
  { mobile: '9876500004', amount: 50000, payment_mode: 'Online', payment_method: 'Paytm',         payment_date: dateMinus( 80), received_by: 'Charan',   transaction_notes: null },
  { mobile: '9876500004', amount: 20000, payment_mode: 'Online', payment_method: 'PhonePe',       payment_date: dateMinus( 15), received_by: 'Charan',   transaction_notes: null },
  // Pradeep (102000) — FULLY PAID
  { mobile: '9876500005', amount: 60000, payment_mode: 'Online', payment_method: 'Google Pay',    payment_date: dateMinus( 95), received_by: 'Charan',   transaction_notes: null },
  { mobile: '9876500005', amount: 42000, payment_mode: 'Cash',   payment_method: null,            payment_date: dateMinus( 40), received_by: 'Ramesh',   transaction_notes: null },
  // Ananya (87000) — FULLY PAID
  { mobile: '8765400007', amount: 87000, payment_mode: 'Online', payment_method: 'Bank Transfer', payment_date: dateMinus( 85), received_by: 'Sita',     transaction_notes: 'Full year via NEFT' },
  // Priya (87000) — PARTIAL
  { mobile: '8765400008', amount: 30000, payment_mode: 'Online', payment_method: 'PhonePe',       payment_date: dateMinus( 75), received_by: 'Sita',     transaction_notes: null },
  { mobile: '8765400008', amount: 20000, payment_mode: 'Online', payment_method: 'Google Pay',    payment_date: dateMinus( 25), received_by: 'Sita',     transaction_notes: null },
  // Sneha (87000) — PARTIAL
  { mobile: '8765400009', amount: 45000, payment_mode: 'Cash',   payment_method: null,            payment_date: dateMinus( 70), received_by: 'Ramesh',   transaction_notes: 'Semester 1' },
  // Arjun (102000) — FULLY PAID
  { mobile: '7654300012', amount: 60000, payment_mode: 'Online', payment_method: 'Bank Transfer', payment_date: dateMinus(110), received_by: 'Charan',   transaction_notes: 'First instalment' },
  { mobile: '7654300012', amount: 42000, payment_mode: 'Online', payment_method: 'PhonePe',       payment_date: dateMinus( 35), received_by: 'Charan',   transaction_notes: null },
  // Siddharth (102000) — PARTIAL
  { mobile: '7654300013', amount: 50000, payment_mode: 'Cash',   payment_method: null,            payment_date: dateMinus( 70), received_by: 'Ramesh',   transaction_notes: null },
  { mobile: '7654300013', amount: 25000, payment_mode: 'Online', payment_method: 'Paytm',         payment_date: dateMinus( 10), received_by: 'Charan',   transaction_notes: null },
  // Akhil (102000) — PARTIAL
  { mobile: '7654300015', amount: 51000, payment_mode: 'Online', payment_method: 'Google Pay',    payment_date: dateMinus( 55), received_by: 'Charan',   transaction_notes: null },
  // Lakshmi (92000) — FULLY PAID
  { mobile: '6543200017', amount: 50000, payment_mode: 'Online', payment_method: 'PhonePe',       payment_date: dateMinus( 90), received_by: 'Lakshman', transaction_notes: null },
  { mobile: '6543200017', amount: 42000, payment_mode: 'Online', payment_method: 'Bank Transfer', payment_date: dateMinus( 20), received_by: 'Lakshman', transaction_notes: 'Final settlement' },
  // Kavya (92000) — PARTIAL
  { mobile: '6543200018', amount: 30000, payment_mode: 'Cash',   payment_method: null,            payment_date: dateMinus( 60), received_by: 'Lakshman', transaction_notes: null },
  { mobile: '6543200018', amount: 15000, payment_mode: 'Online', payment_method: 'PhonePe',       payment_date: dateMinus( 18), received_by: 'Lakshman', transaction_notes: null },
  // Pooja (92000) — PARTIAL
  { mobile: '6543200020', amount: 46000, payment_mode: 'Online', payment_method: 'Other',         payment_date: dateMinus( 45), received_by: 'Lakshman', transaction_notes: 'UPI - SBI Yono' },
];

// Complaints (15) — created_at expressed as days-ago
const COMPLAINTS = [
  { mobile: '9876500001', building_id: 1, category: 'WiFi',        description: 'WiFi disconnects every evening between 8-10 PM',                               status: 'Solved',      created_days: 20, updated_days: 15 },
  { mobile: '9876500002', building_id: 1, category: 'Plumbing',    description: 'Bathroom tap leaking continuously, water wastage',                             status: 'In Progress', created_days:  6, updated_days:  2 },
  { mobile: '9876500004', building_id: 1, category: 'AC',          description: 'AC in flat F-002 not cooling, needs gas refill',                               status: 'Unsolved',    created_days:  2, updated_days:  2 },
  { mobile: '9876500005', building_id: 1, category: 'Electricity', description: 'Power socket near study table not working',                                    status: 'Solved',      created_days: 18, updated_days: 14 },
  { mobile: '9876500003', building_id: 1, category: 'Cleaning',    description: 'Common corridor not cleaned for 3 days',                                       status: 'In Progress', created_days:  4, updated_days:  1 },
  { mobile: '8765400007', building_id: 2, category: 'WiFi',        description: 'WiFi speed very slow on 2nd floor, especially in S-1A-R1',                     status: 'Unsolved',    created_days:  3, updated_days:  3 },
  { mobile: '8765400008', building_id: 2, category: 'Plumbing',    description: 'Hot water not coming in shower from 6 AM-8 AM',                                status: 'Solved',      created_days: 15, updated_days: 10 },
  { mobile: '8765400009', building_id: 2, category: 'Cleaning',    description: 'Cockroach problem in kitchen of S-2A',                                         status: 'In Progress', created_days:  8, updated_days:  5 },
  { mobile: '8765400010', building_id: 2, category: 'Others',      description: 'Door lock of S-3B-R2 stuck, key not turning',                                  status: 'Unsolved',    created_days:  1, updated_days:  1 },
  { mobile: '7654300012', building_id: 3, category: 'Electricity', description: 'Inverter not switching during power cuts in Villa-1',                          status: 'Solved',      created_days: 17, updated_days: 13 },
  { mobile: '7654300013', building_id: 3, category: 'AC',          description: 'Villa-1 hall AC making loud noise',                                            status: 'In Progress', created_days:  9, updated_days:  4 },
  { mobile: '7654300015', building_id: 3, category: 'WiFi',        description: 'Router placement bad — no signal in Villa-2 Bed 1 area',                       status: 'Unsolved',    created_days:  5, updated_days:  5 },
  { mobile: '6543200017', building_id: 4, category: 'Plumbing',    description: 'Drainage block in 1st floor washroom',                                         status: 'Solved',      created_days: 19, updated_days: 12 },
  { mobile: '6543200018', building_id: 4, category: 'Cleaning',    description: 'Garbage not picked up for 2 days',                                             status: 'In Progress', created_days:  7, updated_days:  3 },
  { mobile: '6543200020', building_id: 4, category: 'Others',      description: 'Mess timing inconsistent — dinner served late multiple times',                 status: 'Unsolved',    created_days:  2, updated_days:  2 },
];

// Room change requests (5)
const ROOM_CHANGES = [
  { mobile: '9876500002', requested_unit: { label: 'F-010',   building_id: 1 }, reason: 'Roommate snores heavily, sleep is suffering',                              status: 'Pending',  created_days:  4 },
  { mobile: '9876500004', requested_unit: { label: 'F-003',   building_id: 1 }, reason: 'Want to move closer to friend group in F-003',                             status: 'Approved', created_days: 14 },
  { mobile: '8765400008', requested_unit: { label: 'S-2A-R1', building_id: 2 }, reason: 'Currently sharing with 2 students; requesting different room layout',     status: 'Rejected', created_days: 10 },
  { mobile: '7654300013', requested_unit: { label: 'Villa-3', building_id: 3 }, reason: 'Allergic to ground floor humidity, prefer upper floor villa',             status: 'Pending',  created_days:  6 },
  { mobile: '7654300015', requested_unit: { label: 'Villa-1', building_id: 3 }, reason: 'Wants to be with batchmates from same college',                            status: 'Approved', created_days: 22 },
];

// Announcements (14)
const ANNOUNCEMENTS = [
  { building_id: null, title: 'Diwali Holiday Notice',           message: 'Hostel will operate with skeleton mess service from Nov 1-3 for Diwali. Plan your travel and inform the warden.',                              created_days: 60 },
  { building_id: null, title: 'Hostel Fee Reminder',             message: 'Pending fee payments must be cleared by the 15th of this month. Late payment penalty applies after that.',                                       created_days: 12 },
  { building_id: null, title: 'New WiFi Provider',               message: 'We have switched to ACT Fibernet (200 Mbps unlimited) across all buildings. Please update your devices with the new SSID.',                       created_days: 40 },
  { building_id: null, title: 'Annual Hostel Day Celebration',   message: 'Hostel Day on May 25th — cultural events, dinner, and prize distribution. RSVP at the front desk.',                                              created_days:  5 },
  { building_id: null, title: 'Visitor Policy Update',           message: 'Parents and visitors must register at the gate and leave by 8 PM on weekdays, 9 PM on weekends.',                                                 created_days: 25 },
  { building_id: null, title: 'Mess Vendor Change',              message: 'We are introducing a new mess vendor (Annapurna Caterers) starting next Monday. Feedback welcome.',                                               created_days:  8 },
  { building_id: 1,    title: 'Chalapathi: Water Tank Cleaning', message: 'Water supply will be off on Saturday 9 AM to 2 PM for tank cleaning. Store water in advance.',                                                    created_days:  3 },
  { building_id: 1,    title: 'Chalapathi: Lift Maintenance',    message: 'Lift in Block A under maintenance for 2 days. Use staircase. Sorry for the inconvenience.',                                                       created_days: 17 },
  { building_id: 2,    title: 'Stanza: Pest Control This Sunday',message: 'Pest control on Sunday 10 AM. Please vacate flats from 9:30 AM to 12:30 PM and lock food items.',                                                  created_days:  2 },
  { building_id: 2,    title: 'Stanza: Generator Test',          message: 'Backup generator load test scheduled Wednesday 11 AM. Power may fluctuate for 30 minutes.',                                                       created_days: 20 },
  { building_id: 3,    title: 'Villas: Garden Cleanup Drive',    message: 'Volunteers wanted for villa garden cleanup this Saturday 7 AM. Refreshments provided.',                                                            created_days:  7 },
  { building_id: 3,    title: 'Villas: New Common Room TV',      message: 'A 55-inch smart TV has been installed in Villa-1 common room. Please use it responsibly.',                                                         created_days: 30 },
  { building_id: 4,    title: 'Siddha: Building Hierarchy Setup',message: 'Building layout is being finalised by management. Bed allocation will start once units are added.',                                               created_days: 15 },
  { building_id: 4,    title: 'Siddha: Welcome New Residents',   message: 'A warm welcome to our new Siddha residents. Orientation session on Saturday 5 PM in the lobby.',                                                  created_days: 10 },
];

// Food menu — 21 (day, meal, items) tuples that update across all 4 buildings
const FOOD_MENU = [
  ['Monday',    'Breakfast', 'Idli + Sambar + Coconut Chutney + Tea/Coffee'],
  ['Monday',    'Lunch',     'Rice + Sambar + Aloo Curry + Curd + Pickle + Papad'],
  ['Monday',    'Dinner',    'Chapati + Paneer Butter Masala + Dal Tadka + Rice + Salad'],
  ['Tuesday',   'Breakfast', 'Poha + Boiled Eggs + Banana + Tea/Milk'],
  ['Tuesday',   'Lunch',     'Chapati + Dal Fry + Bhindi Masala + Rice + Curd'],
  ['Tuesday',   'Dinner',    'Veg Pulao + Raita + Mixed Veg Curry + Pickle'],
  ['Wednesday', 'Breakfast', 'Upma + Coconut Chutney + Filter Coffee'],
  ['Wednesday', 'Lunch',     'Rice + Rasam + Cabbage Poriyal + Curd + Mango Pickle'],
  ['Wednesday', 'Dinner',    'Chapati + Chana Masala + Jeera Rice + Boondi Raita'],
  ['Thursday',  'Breakfast', 'Bread + Butter + Jam + Boiled Eggs + Milk'],
  ['Thursday',  'Lunch',     'Rice + Sambar + Beans Curry + Curd + Pickle + Papad'],
  ['Thursday',  'Dinner',    'Chapati + Egg Curry / Soya Chunks Masala + Dal + Rice'],
  ['Friday',    'Breakfast', 'Dosa + Sambar + Tomato Chutney + Tea'],
  ['Friday',    'Lunch',     'Chapati + Dal Makhani + Aloo Gobi + Rice + Curd'],
  ['Friday',    'Dinner',    'Veg Biryani + Mirchi ka Salan + Raita + Boiled Egg'],
  ['Saturday',  'Breakfast', 'Aloo Paratha + Curd + Pickle + Chai'],
  ['Saturday',  'Lunch',     'Chicken Curry / Paneer Curry + Chapati + Rice + Dal + Salad'],
  ['Saturday',  'Dinner',    'Fried Rice + Manchurian + Veg Soup'],
  ['Sunday',    'Breakfast', 'Puri + Aloo Sabzi + Halwa (special) + Tea'],
  ['Sunday',    'Lunch',     'Veg Thali — Rice + Dal + 2 Curries + Roti + Sweet + Curd + Papad'],
  ['Sunday',    'Dinner',    'Chapati + Mixed Veg Korma + Dal + Rice + Ice Cream'],
];

// Maintenance (10)
const MAINTENANCE = [
  { building_id: 1, description: 'Plumbing repair — leakage on 2nd floor (flats F-018 to F-022)', cost:  4500, performed_days_ago:  10, notes: 'Plumber: Ravi Plumbing Services' },
  { building_id: 1, description: 'Common area painting — main entrance and lobby',                cost: 12000, performed_days_ago:  45, notes: 'Paint vendor: Asian Paints contract' },
  { building_id: 1, description: 'Pest control — all 50 flats (quarterly)',                       cost:  7500, performed_days_ago: 100, notes: 'PestX agency, full building' },
  { building_id: 2, description: 'Generator service + diesel top-up',                             cost:  3200, performed_days_ago:  20, notes: 'Power Solutions Pvt Ltd' },
  { building_id: 2, description: 'Lift annual maintenance contract renewal',                      cost:  9000, performed_days_ago:  60, notes: 'Otis service contract' },
  { building_id: 2, description: 'Water tank cleaning — overhead + sump',                         cost:  2800, performed_days_ago: 130, notes: 'Cleaning crew of 3' },
  { building_id: 3, description: 'Garden landscaping + new plants',                               cost:  6500, performed_days_ago:  35, notes: 'Local nursery vendor' },
  { building_id: 3, description: 'Villa-2 roof waterproofing',                                    cost: 14500, performed_days_ago: 150, notes: 'Dr Fixit applicator' },
  { building_id: 4, description: 'Electrical wiring inspection + minor repairs',                  cost:  5200, performed_days_ago:  25, notes: 'Licensed electrician' },
  { building_id: 4, description: 'CCTV camera installation — 4 cameras at gate and corridor',     cost: 11800, performed_days_ago:  75, notes: 'Hikvision installation, 1-year warranty' },
];

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function isoDaysAgo(days) {
  const d = new Date(today);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function die(prefix, error) {
  console.error(`\n[FATAL] ${prefix}:`, error);
  process.exit(1);
}

async function safeSelect(table, query) {
  const { data, error } = await query;
  if (error) die(`select from ${table}`, error);
  return data;
}

// ------------------------------------------------------------------
// Main steps
// ------------------------------------------------------------------

async function checkExisting() {
  const { count, error } = await supabase
    .from('students')
    .select('*', { count: 'exact', head: true });
  if (error) die('count students', error);
  return count ?? 0;
}

async function truncateOperationalTables() {
  console.log('  Clearing bed assignments...');
  let { error } = await supabase
    .from('beds')
    .update({ is_occupied: false, student_id: null })
    .neq('id', 0);
  if (error) die('clear beds', error);

  // Order matters because of FKs (payments/fee_structures/complaints/room_change_requests cascade from students)
  // delete dependent first explicitly to be safe even though ON DELETE CASCADE exists.
  const orderedTables = [
    'maintenance',
    'announcements',  // delete all announcements (incl global)
    'room_change_requests',
    'complaints',
    'payments',
    'fee_structures',
    'students',
  ];

  for (const t of orderedTables) {
    const { error: dErr } = await supabase.from(t).delete().neq('id', 0);
    if (dErr) die(`truncate ${t}`, dErr);
    console.log(`  Truncated ${t}`);
  }
}

async function insertStudents() {
  const { data, error } = await supabase
    .from('students')
    .insert(STUDENTS)
    .select('id, mobile');
  if (error) die('insert students', error);
  const byMobile = new Map(data.map((s) => [s.mobile, s.id]));
  return byMobile;
}

async function assignBeds(studentByMobile) {
  // Look up bed ids by (building_id, unit label, bed label)
  const buildingIds = [...new Set(BED_ASSIGNMENTS.map((a) => a.building_id))];
  const unitLabels  = [...new Set(BED_ASSIGNMENTS.map((a) => a.unit_label))];

  const units = await safeSelect(
    'units',
    supabase.from('units').select('id, label, building_id').in('building_id', buildingIds).in('label', unitLabels),
  );
  const unitKey = (b, label) => `${b}|${label}`;
  const unitMap = new Map(units.map((u) => [unitKey(u.building_id, u.label), u.id]));

  const unitIds = [...new Set(BED_ASSIGNMENTS.map((a) => unitMap.get(unitKey(a.building_id, a.unit_label))).filter(Boolean))];
  const beds = await safeSelect(
    'beds',
    supabase.from('beds').select('id, label, unit_id').in('unit_id', unitIds),
  );
  const bedKey = (unit_id, label) => `${unit_id}|${label}`;
  const bedMap = new Map(beds.map((b) => [bedKey(b.unit_id, b.label), b.id]));

  let assigned = 0;
  for (const a of BED_ASSIGNMENTS) {
    const unitId = unitMap.get(unitKey(a.building_id, a.unit_label));
    if (!unitId) {
      console.warn(`  ! skipping ${a.mobile}: unit ${a.unit_label} (b${a.building_id}) not found`);
      continue;
    }
    const bedId = bedMap.get(bedKey(unitId, a.bed_label));
    if (!bedId) {
      console.warn(`  ! skipping ${a.mobile}: bed ${a.bed_label} in unit ${a.unit_label} not found`);
      continue;
    }
    const studentId = studentByMobile.get(a.mobile);
    if (!studentId) {
      console.warn(`  ! skipping ${a.mobile}: student not found`);
      continue;
    }

    // Mark the bed
    const { error: bedErr } = await supabase
      .from('beds')
      .update({ is_occupied: true, student_id: studentId })
      .eq('id', bedId);
    if (bedErr) die(`update bed ${bedId} for ${a.mobile}`, bedErr);

    // Mirror bed_id on student
    const { error: stErr } = await supabase
      .from('students')
      .update({ bed_id: bedId })
      .eq('id', studentId);
    if (stErr) die(`update student.bed_id for ${a.mobile}`, stErr);

    assigned++;
  }
  return assigned;
}

async function insertFeeStructures(studentByMobile) {
  const rows = STUDENTS.map((s) => {
    const fees = FEE_TABLE[s.building_id];
    return {
      student_id: studentByMobile.get(s.mobile),
      payment_plan: SEMESTER_MOBILES.has(s.mobile) ? 'Semester' : 'Yearly',
      yearly_fee: fees.yearly,
      electricity_fee: fees.electricity,
      non_refundable_fee: fees.non_refundable,
      total_payable: fees.total,
      total_paid: 0,
      balance_amount: fees.total,
      payment_status: 'Pending',
    };
  });
  const { data, error } = await supabase.from('fee_structures').insert(rows).select('id, student_id');
  if (error) die('insert fee_structures', error);
  return data.length;
}

async function insertPayments(studentByMobile) {
  const rows = PAYMENTS.map((p) => ({
    student_id: studentByMobile.get(p.mobile),
    amount: p.amount,
    payment_mode: p.payment_mode,
    payment_method: p.payment_method,
    payment_date: p.payment_date,
    received_by: p.received_by,
    transaction_notes: p.transaction_notes,
  }));
  const { data, error } = await supabase.from('payments').insert(rows).select('id');
  if (error) die('insert payments', error);
  return data.length;
}

async function reconcileFeeStructures(studentByMobile) {
  // Sum payments per student
  const { data: paymentRows, error } = await supabase.from('payments').select('student_id, amount');
  if (error) die('select payments for reconcile', error);

  const totals = new Map();
  for (const p of paymentRows) {
    totals.set(p.student_id, (totals.get(p.student_id) ?? 0) + Number(p.amount));
  }

  // Pull current fee_structures so we know total_payable
  const { data: feeRows, error: feeErr } = await supabase
    .from('fee_structures')
    .select('id, student_id, total_payable');
  if (feeErr) die('select fee_structures for reconcile', feeErr);

  let updated = 0;
  for (const fs of feeRows) {
    const paid = totals.get(fs.student_id) ?? 0;
    const balance = Number(fs.total_payable) - paid;
    let status;
    if (paid === 0) status = 'Pending';
    else if (balance <= 0) status = 'Fully Paid';
    else status = 'Partially Paid';

    const { error: uErr } = await supabase
      .from('fee_structures')
      .update({ total_paid: paid, balance_amount: balance, payment_status: status })
      .eq('id', fs.id);
    if (uErr) die(`reconcile fee_structures id=${fs.id}`, uErr);
    updated++;
  }
  return updated;
}

async function insertComplaints(studentByMobile) {
  const rows = COMPLAINTS.map((c) => ({
    student_id: studentByMobile.get(c.mobile),
    building_id: c.building_id,
    category: c.category,
    description: c.description,
    status: c.status,
    created_at: isoDaysAgo(c.created_days),
    updated_at: isoDaysAgo(c.updated_days),
  }));
  const { data, error } = await supabase.from('complaints').insert(rows).select('id');
  if (error) die('insert complaints', error);
  return data.length;
}

async function insertRoomChangeRequests(studentByMobile) {
  // Resolve unit ids
  const buildingIds = [...new Set(ROOM_CHANGES.map((r) => r.requested_unit.building_id))];
  const unitLabels  = [...new Set(ROOM_CHANGES.map((r) => r.requested_unit.label))];
  const units = await safeSelect(
    'units',
    supabase.from('units').select('id, label, building_id').in('building_id', buildingIds).in('label', unitLabels),
  );
  const unitMap = new Map(units.map((u) => [`${u.building_id}|${u.label}`, u.id]));

  // Get current bed_id for each student that has one
  const mobiles = ROOM_CHANGES.map((r) => r.mobile);
  const studentsWithBed = await safeSelect(
    'students',
    supabase.from('students').select('id, mobile, bed_id').in('mobile', mobiles),
  );
  const bedByMobile = new Map(studentsWithBed.map((s) => [s.mobile, s.bed_id]));

  const rows = ROOM_CHANGES.map((r) => ({
    student_id: studentByMobile.get(r.mobile),
    current_bed_id: bedByMobile.get(r.mobile) ?? null,
    requested_unit_id: unitMap.get(`${r.requested_unit.building_id}|${r.requested_unit.label}`) ?? null,
    reason: r.reason,
    status: r.status,
    created_at: isoDaysAgo(r.created_days),
  }));

  const skipped = rows.filter((r) => r.requested_unit_id == null).length;
  const insertable = rows;  // requested_unit_id can be null per FK on delete set null; keep them all

  const { data, error } = await supabase.from('room_change_requests').insert(insertable).select('id');
  if (error) die('insert room_change_requests', error);
  return { inserted: data.length, missingUnits: skipped };
}

async function insertAnnouncements() {
  const rows = ANNOUNCEMENTS.map((a) => ({
    building_id: a.building_id,
    title: a.title,
    message: a.message,
    created_at: isoDaysAgo(a.created_days),
  }));
  const { data, error } = await supabase.from('announcements').insert(rows).select('id');
  if (error) die('insert announcements', error);
  return data.length;
}

async function updateFoodMenu() {
  let updated = 0;
  for (const [day, meal, items] of FOOD_MENU) {
    const { data, error } = await supabase
      .from('food_menu')
      .update({ items })
      .eq('day_of_week', day)
      .eq('meal_type', meal)
      .select('id');
    if (error) die(`update food_menu ${day}/${meal}`, error);
    updated += data.length;
  }
  return updated;
}

async function insertMaintenance() {
  const rows = MAINTENANCE.map((m) => ({
    building_id: m.building_id,
    description: m.description,
    cost: m.cost,
    performed_on: dateMinus(m.performed_days_ago),
    notes: m.notes,
  }));
  const { data, error } = await supabase.from('maintenance').insert(rows).select('id');
  if (error) die('insert maintenance', error);
  return data.length;
}

// ------------------------------------------------------------------
// Driver
// ------------------------------------------------------------------

async function main() {
  console.log(`Seeding ${SUPABASE_URL}`);
  console.log(`Force mode: ${FORCE ? 'YES' : 'no'}`);

  const existing = await checkExisting();
  console.log(`Existing student count: ${existing}`);

  if (existing > 0 && !FORCE) {
    console.log('Students already exist. Skipping (re-run with --force to wipe and reseed).');
    process.exit(0);
  }

  if (existing > 0 && FORCE) {
    console.log('--force: truncating operational tables...');
    await truncateOperationalTables();
  }

  console.log('1. Inserting students...');
  const studentByMobile = await insertStudents();
  console.log(`   inserted ${studentByMobile.size} students`);

  console.log('2. Assigning beds...');
  const assigned = await assignBeds(studentByMobile);
  console.log(`   ${assigned} bed assignments made`);

  console.log('3. Inserting fee_structures...');
  const fsCount = await insertFeeStructures(studentByMobile);
  console.log(`   inserted ${fsCount} fee_structures`);

  console.log('4. Inserting payments...');
  const payCount = await insertPayments(studentByMobile);
  console.log(`   inserted ${payCount} payments`);

  console.log('5. Reconciling fee_structures from payments...');
  const reconciled = await reconcileFeeStructures(studentByMobile);
  console.log(`   reconciled ${reconciled} fee_structures`);

  console.log('6. Inserting complaints...');
  const cmpCount = await insertComplaints(studentByMobile);
  console.log(`   inserted ${cmpCount} complaints`);

  console.log('7. Inserting room_change_requests...');
  const rcr = await insertRoomChangeRequests(studentByMobile);
  console.log(`   inserted ${rcr.inserted} room_change_requests (missing units: ${rcr.missingUnits})`);

  console.log('8. Inserting announcements...');
  const annCount = await insertAnnouncements();
  console.log(`   inserted ${annCount} announcements`);

  console.log('9. Updating food_menu items...');
  const foodCount = await updateFoodMenu();
  console.log(`   updated ${foodCount} food_menu rows`);

  console.log('10. Inserting maintenance...');
  const maintCount = await insertMaintenance();
  console.log(`    inserted ${maintCount} maintenance rows`);

  // Verify by counting
  console.log('\nVerifying counts via REST:');
  const tables = ['students', 'fee_structures', 'payments', 'complaints', 'room_change_requests', 'announcements', 'maintenance'];
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    if (error) console.log(`   ${t}: ERROR ${error.message}`);
    else console.log(`   ${t}: ${count}`);
  }
  // Beds occupied
  const { count: bedsOccupied } = await supabase
    .from('beds')
    .select('*', { count: 'exact', head: true })
    .eq('is_occupied', true);
  console.log(`   beds(is_occupied=true): ${bedsOccupied}`);

  // payment_status breakdown
  const { data: feeRows, error: feErr } = await supabase
    .from('fee_structures')
    .select('payment_status');
  if (!feErr) {
    const breakdown = feeRows.reduce((acc, r) => {
      acc[r.payment_status] = (acc[r.payment_status] ?? 0) + 1;
      return acc;
    }, {});
    console.log(`   fee_structures payment_status: ${JSON.stringify(breakdown)}`);
  }

  console.log('\nDone.');
}

main().catch((err) => die('unhandled', err));
