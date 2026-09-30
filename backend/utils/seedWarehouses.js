import mongoose from 'mongoose';
import { Warehouse } from '../models/Warehouse.js';
import { User } from '../models/User.js';
import { ROLES } from '../config/constants.js';

export const warehousesData = [
  // ==========================================
  // --- ANDHRA PRADESH (All 26 Districts) ---
  // ==========================================
  {
    name: 'Srikakulam District Logistics Hub',
    code: 'WH-AP-SRK01',
    type: 'Regional Sorting Hub',
    state: 'Andhra Pradesh',
    city: 'Srikakulam',
    address: 'GT Road Industrial Area, Srikakulam',
    pincode: '532001',
    location: { lat: 18.2970, lng: 83.8960 },
    manager: { name: 'Prakash Rao', phone: '+91 98480 10001', email: 'prakash.srk@novacart.com', employeeId: 'MGR-AP-01' },
    capacity: 25000, currentLoad: 11000, status: 'active',
    serviceArea: { radiusKm: 100, color: '#3B82F6', markedByAdmin: true }
  },
  {
    name: 'Parvathipuram Manyam District Hub',
    code: 'WH-AP-PVP01',
    type: 'Delivery Branch',
    state: 'Andhra Pradesh',
    city: 'Parvathipuram',
    address: 'Bypass Road Goods Complex, Parvathipuram',
    pincode: '535501',
    location: { lat: 18.7800, lng: 83.4300 },
    manager: { name: 'Ramana Murthy', phone: '+91 98480 10002', email: 'ramana.pvp@novacart.com', employeeId: 'MGR-AP-02' },
    capacity: 20000, currentLoad: 8500, status: 'active',
    serviceArea: { radiusKm: 100, color: '#10B981', markedByAdmin: true }
  },
  {
    name: 'Vizianagaram District Hub',
    code: 'WH-AP-VZM01',
    type: 'Regional Sorting Hub',
    state: 'Andhra Pradesh',
    city: 'Vizianagaram',
    address: 'Contonment Logistics Zone, Vizianagaram',
    pincode: '535001',
    location: { lat: 18.1167, lng: 83.4167 },
    manager: { name: 'Kalyan Varma', phone: '+91 98480 10003', email: 'kalyan.vzm@novacart.com', employeeId: 'MGR-AP-03' },
    capacity: 30000, currentLoad: 14200, status: 'active',
    serviceArea: { radiusKm: 100, color: '#8B5CF6', markedByAdmin: true }
  },
  {
    name: 'Visakhapatnam Port Logistics Hub',
    code: 'WH-AP-VSKP01',
    type: 'Mother Warehouse',
    state: 'Andhra Pradesh',
    city: 'Visakhapatnam',
    address: 'Duvvada VSEZ Logistic Park, Visakhapatnam',
    pincode: '530046',
    location: { lat: 17.6868, lng: 83.2185 },
    manager: { name: 'Rajesh Raju', phone: '+91 98481 22334', email: 'rajesh.raju@novacart.com', employeeId: 'MGR-AP-04' },
    capacity: 75000, currentLoad: 48400, status: 'active',
    serviceArea: { radiusKm: 100, color: '#2563EB', markedByAdmin: true }
  },
  {
    name: 'Alluri Sitharama Raju District Hub',
    code: 'WH-AP-ASR01',
    type: 'Delivery Branch',
    state: 'Andhra Pradesh',
    city: 'Paderu',
    address: 'Ghat Road Cargo Depot, Paderu',
    pincode: '531024',
    location: { lat: 18.0833, lng: 82.6667 },
    manager: { name: 'Srinivasa Rao', phone: '+91 98480 10005', email: 'srinu.asr@novacart.com', employeeId: 'MGR-AP-05' },
    capacity: 18000, currentLoad: 6700, status: 'active',
    serviceArea: { radiusKm: 100, color: '#F59E0B', markedByAdmin: true }
  },
  {
    name: 'Anakapalli District Hub',
    code: 'WH-AP-AKP01',
    type: 'Regional Sorting Hub',
    state: 'Andhra Pradesh',
    city: 'Anakapalli',
    address: 'Jaggayyapet Highway Industrial Area, Anakapalli',
    pincode: '531001',
    location: { lat: 17.6800, lng: 83.0200 },
    manager: { name: 'Bhanu Prasad', phone: '+91 98480 10006', email: 'bhanu.akp@novacart.com', employeeId: 'MGR-AP-06' },
    capacity: 28000, currentLoad: 13500, status: 'active',
    serviceArea: { radiusKm: 100, color: '#EC4899', markedByAdmin: true }
  },
  {
    name: 'Kakinada Smart City Hub',
    code: 'WH-AP-KKD01',
    type: 'Regional Sorting Hub',
    state: 'Andhra Pradesh',
    city: 'Kakinada',
    address: 'Port Road Industrial Corridor, Kakinada',
    pincode: '533001',
    location: { lat: 16.9800, lng: 82.2400 },
    manager: { name: 'Nageswara Rao', phone: '+91 98480 10007', email: 'nagesh.kkd@novacart.com', employeeId: 'MGR-AP-07' },
    capacity: 35000, currentLoad: 18200, status: 'active',
    serviceArea: { radiusKm: 100, color: '#06B6D4', markedByAdmin: true }
  },
  {
    name: 'East Godavari Delta Hub',
    code: 'WH-AP-RJY01',
    type: 'Mother Warehouse',
    state: 'Andhra Pradesh',
    city: 'Rajahmundry',
    address: 'Morampudi Junction, NH16 Corridor, Rajahmundry',
    pincode: '533107',
    location: { lat: 17.0005, lng: 81.8040 },
    manager: { name: 'Satyanarayana Murthy', phone: '+91 98485 66778', email: 'satya.murthy@novacart.com', employeeId: 'MGR-AP-08' },
    capacity: 50000, currentLoad: 29200, status: 'active',
    serviceArea: { radiusKm: 100, color: '#10B981', markedByAdmin: true }
  },
  {
    name: 'Dr. B.R. Ambedkar Konaseema Hub',
    code: 'WH-AP-KNS01',
    type: 'Delivery Branch',
    state: 'Andhra Pradesh',
    city: 'Amalapuram',
    address: 'Clock Tower Center, Amalapuram',
    pincode: '533201',
    location: { lat: 16.5800, lng: 82.0000 },
    manager: { name: 'Venkatesh Varma', phone: '+91 98480 10009', email: 'venky.kns@novacart.com', employeeId: 'MGR-AP-09' },
    capacity: 22000, currentLoad: 9800, status: 'active',
    serviceArea: { radiusKm: 100, color: '#6366F1', markedByAdmin: true }
  },
  {
    name: 'West Godavari District Hub',
    code: 'WH-AP-WGD01',
    type: 'Regional Sorting Hub',
    state: 'Andhra Pradesh',
    city: 'Bhimavaram',
    address: 'J P Road Cargo Zone, Bhimavaram',
    pincode: '534201',
    location: { lat: 16.5400, lng: 81.5200 },
    manager: { name: 'Subba Raju', phone: '+91 98480 10010', email: 'subba.bvm@novacart.com', employeeId: 'MGR-AP-10' },
    capacity: 32000, currentLoad: 16400, status: 'active',
    serviceArea: { radiusKm: 100, color: '#EF4444', markedByAdmin: true }
  },
  {
    name: 'Eluru District Logistics Hub',
    code: 'WH-AP-ELR01',
    type: 'Regional Sorting Hub',
    state: 'Andhra Pradesh',
    city: 'Eluru',
    address: 'Bypass Road Industrial Zone, Eluru',
    pincode: '534001',
    location: { lat: 16.7000, lng: 81.1000 },
    manager: { name: 'Mohan Reddy', phone: '+91 98480 10011', email: 'mohan.elr@novacart.com', employeeId: 'MGR-AP-11' },
    capacity: 30000, currentLoad: 15100, status: 'active',
    serviceArea: { radiusKm: 100, color: '#F59E0B', markedByAdmin: true }
  },
  {
    name: 'NTR Vijayawada Central Mother Hub',
    code: 'WH-AP-VJA01',
    type: 'Mother Warehouse',
    state: 'Andhra Pradesh',
    city: 'Vijayawada',
    address: 'Plot 45, Autonagar Industrial Area, Vijayawada',
    pincode: '520007',
    location: { lat: 16.5062, lng: 80.6480 },
    manager: { name: 'Suresh Varma', phone: '+91 98480 11223', email: 'suresh.varma@novacart.com', employeeId: 'MGR-AP-12' },
    capacity: 85000, currentLoad: 52100, status: 'active',
    serviceArea: { radiusKm: 100, color: '#2563EB', markedByAdmin: true }
  },
  {
    name: 'Krishna District Hub',
    code: 'WH-AP-KRS01',
    type: 'Delivery Branch',
    state: 'Andhra Pradesh',
    city: 'Machilipatnam',
    address: 'Bandar Port Road Logistics Complex, Machilipatnam',
    pincode: '521001',
    location: { lat: 16.1800, lng: 81.1300 },
    manager: { name: 'Ravi Teja', phone: '+91 98480 10013', email: 'ravi.krs@novacart.com', employeeId: 'MGR-AP-13' },
    capacity: 25000, currentLoad: 11200, status: 'active',
    serviceArea: { radiusKm: 100, color: '#10B981', markedByAdmin: true }
  },
  {
    name: 'Palnadu District Hub',
    code: 'WH-AP-PLN01',
    type: 'Regional Sorting Hub',
    state: 'Andhra Pradesh',
    city: 'Narasaraopet',
    address: 'Kotappakonda Road Industrial Zone, Narasaraopet',
    pincode: '522601',
    location: { lat: 16.2300, lng: 80.0500 },
    manager: { name: 'Srinivas Rao', phone: '+91 98480 10014', email: 'srinu.pln@novacart.com', employeeId: 'MGR-AP-14' },
    capacity: 30000, currentLoad: 13900, status: 'active',
    serviceArea: { radiusKm: 100, color: '#EC4899', markedByAdmin: true }
  },
  {
    name: 'Guntur Regional Hub',
    code: 'WH-AP-GNT01',
    type: 'Regional Sorting Hub',
    state: 'Andhra Pradesh',
    city: 'Guntur',
    address: 'Nallapadu Industrial Estate, Guntur',
    pincode: '522005',
    location: { lat: 16.3067, lng: 80.4365 },
    manager: { name: 'Venkat Rao', phone: '+91 98482 33445', email: 'venkat.rao@novacart.com', employeeId: 'MGR-AP-15' },
    capacity: 45000, currentLoad: 24800, status: 'active',
    serviceArea: { radiusKm: 100, color: '#EF4444', markedByAdmin: true }
  },
  {
    name: 'Bapatla District Hub',
    code: 'WH-AP-BPT01',
    type: 'Delivery Branch',
    state: 'Andhra Pradesh',
    city: 'Bapatla',
    address: 'Agricultural College Corridor, Bapatla',
    pincode: '522101',
    location: { lat: 15.9000, lng: 80.4700 },
    manager: { name: 'Kiran Kumar', phone: '+91 98480 10016', email: 'kiran.bpt@novacart.com', employeeId: 'MGR-AP-16' },
    capacity: 20000, currentLoad: 8900, status: 'active',
    serviceArea: { radiusKm: 100, color: '#06B6D4', markedByAdmin: true }
  },
  {
    name: 'Prakasam District Hub',
    code: 'WH-AP-PKS01',
    type: 'Regional Sorting Hub',
    state: 'Andhra Pradesh',
    city: 'Ongole',
    address: 'NH16 Bypass Cargo Zone, Ongole',
    pincode: '523001',
    location: { lat: 15.5000, lng: 80.0500 },
    manager: { name: 'Sudhakar Reddy', phone: '+91 98480 10017', email: 'sudhakar.pks@novacart.com', employeeId: 'MGR-AP-17' },
    capacity: 35000, currentLoad: 17800, status: 'active',
    serviceArea: { radiusKm: 100, color: '#8B5CF6', markedByAdmin: true }
  },
  {
    name: 'Sri Potti Sriramulu Nellore Coast Branch',
    code: 'WH-AP-NLR01',
    type: 'Delivery Branch',
    state: 'Andhra Pradesh',
    city: 'Nellore',
    address: 'Muthukur Road Logistics Zone, Nellore',
    pincode: '524003',
    location: { lat: 14.4426, lng: 79.9865 },
    manager: { name: 'Krishna Chaitanya', phone: '+91 98487 88990', email: 'krishna.ch@novacart.com', employeeId: 'MGR-AP-18' },
    capacity: 25000, currentLoad: 12400, status: 'active',
    serviceArea: { radiusKm: 100, color: '#10B981', markedByAdmin: true }
  },
  {
    name: 'Nandyal District Hub',
    code: 'WH-AP-NDL01',
    type: 'Delivery Branch',
    state: 'Andhra Pradesh',
    city: 'Nandyal',
    address: 'Atmakur Bypass Road, Nandyal',
    pincode: '518501',
    location: { lat: 15.4800, lng: 78.4800 },
    manager: { name: 'Vijay Kumar', phone: '+91 98480 10019', email: 'vijay.ndl@novacart.com', employeeId: 'MGR-AP-19' },
    capacity: 22000, currentLoad: 9400, status: 'active',
    serviceArea: { radiusKm: 100, color: '#F59E0B', markedByAdmin: true }
  },
  {
    name: 'Kurnool Rayalaseema Hub',
    code: 'WH-AP-KNL01',
    type: 'Mother Warehouse',
    state: 'Andhra Pradesh',
    city: 'Kurnool',
    address: 'Bellary Road Industrial Corridor, Kurnool',
    pincode: '518003',
    location: { lat: 15.8281, lng: 78.0373 },
    manager: { name: 'Anil Kumar Naidu', phone: '+91 98486 77889', email: 'anil.naidu@novacart.com', employeeId: 'MGR-AP-20' },
    capacity: 45000, currentLoad: 23100, status: 'active',
    serviceArea: { radiusKm: 100, color: '#6366F1', markedByAdmin: true }
  },
  {
    name: 'Anantapur District Hub',
    code: 'WH-AP-ATP01',
    type: 'Regional Sorting Hub',
    state: 'Andhra Pradesh',
    city: 'Anantapur',
    address: 'NH44 Cargo Terminal, Anantapur',
    pincode: '515001',
    location: { lat: 14.6800, lng: 77.6000 },
    manager: { name: 'Narendra Naidu', phone: '+91 98480 10021', email: 'narendra.atp@novacart.com', employeeId: 'MGR-AP-21' },
    capacity: 35000, currentLoad: 18500, status: 'active',
    serviceArea: { radiusKm: 100, color: '#EF4444', markedByAdmin: true }
  },
  {
    name: 'Sri Sathya Sai District Hub',
    code: 'WH-AP-SSS01',
    type: 'Delivery Branch',
    state: 'Andhra Pradesh',
    city: 'Puttaparthi',
    address: 'Main Ashram Corridor, Puttaparthi',
    pincode: '515134',
    location: { lat: 14.1600, lng: 77.8100 },
    manager: { name: 'Sai Ram', phone: '+91 98480 10022', email: 'sairam.sss@novacart.com', employeeId: 'MGR-AP-22' },
    capacity: 20000, currentLoad: 7800, status: 'active',
    serviceArea: { radiusKm: 100, color: '#10B981', markedByAdmin: true }
  },
  {
    name: 'YSR Kadapa District Hub',
    code: 'WH-AP-KDP01',
    type: 'Regional Sorting Hub',
    state: 'Andhra Pradesh',
    city: 'Kadapa',
    address: 'RIMS Road Industrial Zone, Kadapa',
    pincode: '516001',
    location: { lat: 14.4700, lng: 78.8200 },
    manager: { name: 'Prasad Reddy', phone: '+91 98480 10023', email: 'prasad.kdp@novacart.com', employeeId: 'MGR-AP-23' },
    capacity: 32000, currentLoad: 15600, status: 'active',
    serviceArea: { radiusKm: 100, color: '#8B5CF6', markedByAdmin: true }
  },
  {
    name: 'Annamayya District Hub',
    code: 'WH-AP-ANM01',
    type: 'Delivery Branch',
    state: 'Andhra Pradesh',
    city: 'Madanapalle',
    address: 'Rayachoti Bypass, Madanapalle',
    pincode: '517325',
    location: { lat: 13.5500, lng: 78.5000 },
    manager: { name: 'Chandra Sekhar', phone: '+91 98480 10024', email: 'chandra.anm@novacart.com', employeeId: 'MGR-AP-24' },
    capacity: 22000, currentLoad: 9100, status: 'active',
    serviceArea: { radiusKm: 100, color: '#EC4899', markedByAdmin: true }
  },
  {
    name: 'Tirupati Express Branch',
    code: 'WH-AP-TPT01',
    type: 'Mother Warehouse',
    state: 'Andhra Pradesh',
    city: 'Tirupati',
    address: 'Renigunta Road Cargo Complex, Tirupati',
    pincode: '517501',
    location: { lat: 13.6288, lng: 79.4192 },
    manager: { name: 'Madhusudhan Reddy', phone: '+91 98484 55667', email: 'madhu.reddy@novacart.com', employeeId: 'MGR-AP-25' },
    capacity: 45000, currentLoad: 26800, status: 'active',
    serviceArea: { radiusKm: 100, color: '#06B6D4', markedByAdmin: true }
  },
  {
    name: 'Chittoor District Hub',
    code: 'WH-AP-CTR01',
    type: 'Delivery Branch',
    state: 'Andhra Pradesh',
    city: 'Chittoor',
    address: 'Murukambattu Industrial Area, Chittoor',
    pincode: '517001',
    location: { lat: 13.2100, lng: 79.1000 },
    manager: { name: 'Dinesh Naidu', phone: '+91 98480 10026', email: 'dinesh.ctr@novacart.com', employeeId: 'MGR-AP-26' },
    capacity: 25000, currentLoad: 11400, status: 'active',
    serviceArea: { radiusKm: 100, color: '#F59E0B', markedByAdmin: true }
  },

  // ==========================================
  // --- TELANGANA (All 33 Districts) ---
  // ==========================================
  {
    name: 'Adilabad District Hub',
    code: 'WH-TS-ADB01',
    type: 'Regional Sorting Hub',
    state: 'Telangana',
    city: 'Adilabad',
    address: 'NH-44 Bypass Industrial Zone, Adilabad',
    pincode: '504001',
    location: { lat: 19.6667, lng: 78.5333 },
    manager: { name: 'Mahender Goud', phone: '+91 98490 20001', email: 'mahender.adb@novacart.com', employeeId: 'MGR-TS-01' },
    capacity: 25000, currentLoad: 10500, status: 'active',
    serviceArea: { radiusKm: 100, color: '#EF4444', markedByAdmin: true }
  },
  {
    name: 'Kumuram Bheem Asifabad Hub',
    code: 'WH-TS-KBA01',
    type: 'Delivery Branch',
    state: 'Telangana',
    city: 'Asifabad',
    address: 'Main Road Goods Yard, Asifabad',
    pincode: '504293',
    location: { lat: 19.3600, lng: 79.2800 },
    manager: { name: 'Ramesh Naidu', phone: '+91 98490 20002', email: 'ramesh.kba@novacart.com', employeeId: 'MGR-TS-02' },
    capacity: 18000, currentLoad: 6900, status: 'active',
    serviceArea: { radiusKm: 100, color: '#10B981', markedByAdmin: true }
  },
  {
    name: 'Mancherial District Hub',
    code: 'WH-TS-MCL01',
    type: 'Regional Sorting Hub',
    state: 'Telangana',
    city: 'Mancherial',
    address: 'Bellampally Road, Mancherial',
    pincode: '504208',
    location: { lat: 18.8700, lng: 79.4600 },
    manager: { name: 'Shiva Kumar', phone: '+91 98490 20003', email: 'shiva.mcl@novacart.com', employeeId: 'MGR-TS-03' },
    capacity: 28000, currentLoad: 12800, status: 'active',
    serviceArea: { radiusKm: 100, color: '#3B82F6', markedByAdmin: true }
  },
  {
    name: 'Nirmal District Hub',
    code: 'WH-TS-NRM01',
    type: 'Delivery Branch',
    state: 'Telangana',
    city: 'Nirmal',
    address: 'Mancherial Highway Zone, Nirmal',
    pincode: '504106',
    location: { lat: 19.0900, lng: 78.3400 },
    manager: { name: 'Gautam Reddy', phone: '+91 98490 20004', email: 'gautam.nrm@novacart.com', employeeId: 'MGR-TS-04' },
    capacity: 20000, currentLoad: 8100, status: 'active',
    serviceArea: { radiusKm: 100, color: '#8B5CF6', markedByAdmin: true }
  },
  {
    name: 'Nizamabad Logistics Branch',
    code: 'WH-TS-NZB01',
    type: 'Regional Sorting Hub',
    state: 'Telangana',
    city: 'Nizamabad',
    address: 'Armoor Road Industrial Area, Nizamabad',
    pincode: '503001',
    location: { lat: 18.6725, lng: 78.0941 },
    manager: { name: 'Srinivas Yadav', phone: '+91 98496 78901', email: 'srinivas.yadav@novacart.com', employeeId: 'MGR-TS-05' },
    capacity: 35000, currentLoad: 18200, status: 'active',
    serviceArea: { radiusKm: 100, color: '#F59E0B', markedByAdmin: true }
  },
  {
    name: 'Jagtial District Hub',
    code: 'WH-TS-JGT01',
    type: 'Delivery Branch',
    state: 'Telangana',
    city: 'Jagtial',
    address: 'Karimnagar Bypass, Jagtial',
    pincode: '505327',
    location: { lat: 18.7900, lng: 78.9100 },
    manager: { name: 'Venu Gopal', phone: '+91 98490 20006', email: 'venu.jgt@novacart.com', employeeId: 'MGR-TS-06' },
    capacity: 22000, currentLoad: 9200, status: 'active',
    serviceArea: { radiusKm: 100, color: '#EC4899', markedByAdmin: true }
  },
  {
    name: 'Peddapalli District Hub',
    code: 'WH-TS-PDP01',
    type: 'Delivery Branch',
    state: 'Telangana',
    city: 'Peddapalli',
    address: 'NTPC Cargo Area, Peddapalli',
    pincode: '505172',
    location: { lat: 18.6100, lng: 79.3700 },
    manager: { name: 'Anand Rao', phone: '+91 98490 20007', email: 'anand.pdp@novacart.com', employeeId: 'MGR-TS-07' },
    capacity: 24000, currentLoad: 10800, status: 'active',
    serviceArea: { radiusKm: 100, color: '#06B6D4', markedByAdmin: true }
  },
  {
    name: 'Jayashankar Bhupalpally Hub',
    code: 'WH-TS-JBP01',
    type: 'Delivery Branch',
    state: 'Telangana',
    city: 'Bhupalpally',
    address: 'Singareni Colony Road, Bhupalpally',
    pincode: '506169',
    location: { lat: 18.4300, lng: 79.8600 },
    manager: { name: 'Tirupathi Goud', phone: '+91 98490 20008', email: 'tiru.jbp@novacart.com', employeeId: 'MGR-TS-08' },
    capacity: 18000, currentLoad: 7200, status: 'active',
    serviceArea: { radiusKm: 100, color: '#10B981', markedByAdmin: true }
  },
  {
    name: 'Bhadradri Kothagudem Hub',
    code: 'WH-TS-BDK01',
    type: 'Regional Sorting Hub',
    state: 'Telangana',
    city: 'Kothagudem',
    address: 'Palvancha Road, Kothagudem',
    pincode: '507101',
    location: { lat: 17.5500, lng: 80.6100 },
    manager: { name: 'Rajendra Prasad', phone: '+91 98490 20009', email: 'rajendra.bdk@novacart.com', employeeId: 'MGR-TS-09' },
    capacity: 28000, currentLoad: 13100, status: 'active',
    serviceArea: { radiusKm: 100, color: '#6366F1', markedByAdmin: true }
  },
  {
    name: 'Mahabubabad District Hub',
    code: 'WH-TS-MHD01',
    type: 'Delivery Branch',
    state: 'Telangana',
    city: 'Mahabubabad',
    address: 'Thorrur Road Industrial Center, Mahabubabad',
    pincode: '506101',
    location: { lat: 17.6000, lng: 80.0000 },
    manager: { name: 'Narender Reddy', phone: '+91 98490 20010', email: 'narender.mhd@novacart.com', employeeId: 'MGR-TS-10' },
    capacity: 20000, currentLoad: 8400, status: 'active',
    serviceArea: { radiusKm: 100, color: '#EF4444', markedByAdmin: true }
  },
  {
    name: 'Warangal Tri-City Regional Hub',
    code: 'WH-TS-WGL01',
    type: 'Mother Warehouse',
    state: 'Telangana',
    city: 'Warangal',
    address: 'Enumamula Grain & Goods Market Yard, Warangal',
    pincode: '506002',
    location: { lat: 17.9689, lng: 79.5941 },
    manager: { name: 'Ramesh Rao', phone: '+91 98494 56789', email: 'ramesh.rao@novacart.com', employeeId: 'MGR-TS-11' },
    capacity: 55000, currentLoad: 31200, status: 'active',
    serviceArea: { radiusKm: 100, color: '#3B82F6', markedByAdmin: true }
  },
  {
    name: 'Warangal Rural Hub',
    code: 'WH-TS-WGR01',
    type: 'Delivery Branch',
    state: 'Telangana',
    city: 'Geval',
    address: 'Narsampet Highway, Warangal Rural',
    pincode: '506005',
    location: { lat: 17.9200, lng: 79.6300 },
    manager: { name: 'Upender Reddy', phone: '+91 98490 20012', email: 'upender.wgr@novacart.com', employeeId: 'MGR-TS-12' },
    capacity: 20000, currentLoad: 7900, status: 'active',
    serviceArea: { radiusKm: 100, color: '#F59E0B', markedByAdmin: true }
  },
  {
    name: 'Karimnagar North Delivery Branch',
    code: 'WH-TS-KRN01',
    type: 'Regional Sorting Hub',
    state: 'Telangana',
    city: 'Karimnagar',
    address: 'Collectorate Road, Mukarampura, Karimnagar',
    pincode: '505001',
    location: { lat: 18.4386, lng: 79.1288 },
    manager: { name: 'Santosh Kumar', phone: '+91 98495 67890', email: 'santosh.kumar@novacart.com', employeeId: 'MGR-TS-13' },
    capacity: 35000, currentLoad: 17400, status: 'active',
    serviceArea: { radiusKm: 100, color: '#10B981', markedByAdmin: true }
  },
  {
    name: 'Rajanna Sircilla Hub',
    code: 'WH-TS-RJS01',
    type: 'Delivery Branch',
    state: 'Telangana',
    city: 'Sircilla',
    address: 'Textile Park Zone, Sircilla',
    pincode: '505301',
    location: { lat: 18.3800, lng: 78.8300 },
    manager: { name: 'Laxman Goud', phone: '+91 98490 20014', email: 'laxman.rjs@novacart.com', employeeId: 'MGR-TS-14' },
    capacity: 22000, currentLoad: 9600, status: 'active',
    serviceArea: { radiusKm: 100, color: '#8B5CF6', markedByAdmin: true }
  },
  {
    name: 'Kamareddy District Hub',
    code: 'WH-TS-KMR01',
    type: 'Delivery Branch',
    state: 'Telangana',
    city: 'Kamareddy',
    address: 'NH-44 Bypass Industrial Park, Kamareddy',
    pincode: '503111',
    location: { lat: 18.3200, lng: 78.3400 },
    manager: { name: 'Devender Reddy', phone: '+91 98490 20015', email: 'devender.kmr@novacart.com', employeeId: 'MGR-TS-15' },
    capacity: 24000, currentLoad: 10200, status: 'active',
    serviceArea: { radiusKm: 100, color: '#EC4899', markedByAdmin: true }
  },
  {
    name: 'Medak District Hub',
    code: 'WH-TS-MDK01',
    type: 'Delivery Branch',
    state: 'Telangana',
    city: 'Medak',
    address: 'Church Road Cargo Center, Medak',
    pincode: '502110',
    location: { lat: 18.0400, lng: 78.2600 },
    manager: { name: 'Chandra Mohan', phone: '+91 98490 20016', email: 'chandra.mdk@novacart.com', employeeId: 'MGR-TS-16' },
    capacity: 20000, currentLoad: 8300, status: 'active',
    serviceArea: { radiusKm: 100, color: '#06B6D4', markedByAdmin: true }
  },
  {
    name: 'Siddipet District Hub',
    code: 'WH-TS-SDP01',
    type: 'Regional Sorting Hub',
    state: 'Telangana',
    city: 'Siddipet',
    address: 'Bypass Road Cargo Depot, Siddipet',
    pincode: '502103',
    location: { lat: 18.1000, lng: 78.8500 },
    manager: { name: 'Bhadraiah Goud', phone: '+91 98490 20017', email: 'bhadra.sdp@novacart.com', employeeId: 'MGR-TS-17' },
    capacity: 30000, currentLoad: 14500, status: 'active',
    serviceArea: { radiusKm: 100, color: '#F59E0B', markedByAdmin: true }
  },
  {
    name: 'Jangaon District Hub',
    code: 'WH-TS-JGN01',
    type: 'Delivery Branch',
    state: 'Telangana',
    city: 'Jangaon',
    address: 'Hyderguda Highway, Jangaon',
    pincode: '506167',
    location: { lat: 17.7200, lng: 79.1800 },
    manager: { name: 'Mallesh Yadav', phone: '+91 98490 20018', email: 'mallesh.jgn@novacart.com', employeeId: 'MGR-TS-18' },
    capacity: 20000, currentLoad: 8600, status: 'active',
    serviceArea: { radiusKm: 100, color: '#10B981', markedByAdmin: true }
  },
  {
    name: 'Yadadri Bhuvanagiri Hub',
    code: 'WH-TS-YDB01',
    type: 'Delivery Branch',
    state: 'Telangana',
    city: 'Bhongir',
    address: 'Temple Highway Complex, Bhongir',
    pincode: '508116',
    location: { lat: 17.5100, lng: 78.8900 },
    manager: { name: 'Prabhakar Rao', phone: '+91 98490 20019', email: 'prabhu.ydb@novacart.com', employeeId: 'MGR-TS-19' },
    capacity: 22000, currentLoad: 9400, status: 'active',
    serviceArea: { radiusKm: 100, color: '#6366F1', markedByAdmin: true }
  },
  {
    name: 'Suryapet District Hub',
    code: 'WH-TS-SRP01',
    type: 'Regional Sorting Hub',
    state: 'Telangana',
    city: 'Suryapet',
    address: 'NH65 Highway Corridor, Suryapet',
    pincode: '508213',
    location: { lat: 17.1400, lng: 79.6200 },
    manager: { name: 'Sambaiah Goud', phone: '+91 98490 20020', email: 'samba.srp@novacart.com', employeeId: 'MGR-TS-20' },
    capacity: 32000, currentLoad: 15300, status: 'active',
    serviceArea: { radiusKm: 100, color: '#EF4444', markedByAdmin: true }
  },
  {
    name: 'Nalgonda District Hub',
    code: 'WH-TS-NLG01',
    type: 'Regional Sorting Hub',
    state: 'Telangana',
    city: 'Nalgonda',
    address: 'Miryalaguda Road, Nalgonda',
    pincode: '508001',
    location: { lat: 17.0500, lng: 79.2700 },
    manager: { name: 'Venkat Reddy', phone: '+91 98490 20021', email: 'venkat.nlg@novacart.com', employeeId: 'MGR-TS-21' },
    capacity: 35000, currentLoad: 17100, status: 'active',
    serviceArea: { radiusKm: 100, color: '#3B82F6', markedByAdmin: true }
  },
  {
    name: 'Khammam Logistics Branch',
    code: 'WH-TS-KMM01',
    type: 'Regional Sorting Hub',
    state: 'Telangana',
    city: 'Khammam',
    address: 'Wyra Road Bypass, Khammam',
    pincode: '507001',
    location: { lat: 17.2473, lng: 80.1514 },
    manager: { name: 'Mahesh Babu', phone: '+91 98497 89012', email: 'mahesh.babu@novacart.com', employeeId: 'MGR-TS-22' },
    capacity: 38000, currentLoad: 19400, status: 'active',
    serviceArea: { radiusKm: 100, color: '#8B5CF6', markedByAdmin: true }
  },
  {
    name: 'Sangareddy District Hub',
    code: 'WH-TS-SGR01',
    type: 'Regional Sorting Hub',
    state: 'Telangana',
    city: 'Sangareddy',
    address: 'IIT Hyderabad Corridor, Sangareddy',
    pincode: '502001',
    location: { lat: 17.6200, lng: 78.0800 },
    manager: { name: 'Ashok Varma', phone: '+91 98490 20023', email: 'ashok.sgr@novacart.com', employeeId: 'MGR-TS-23' },
    capacity: 40000, currentLoad: 21500, status: 'active',
    serviceArea: { radiusKm: 100, color: '#F59E0B', markedByAdmin: true }
  },
  {
    name: 'Hyderabad Medchal Mega Hub',
    code: 'WH-TS-HYD02',
    type: 'Mother Warehouse',
    state: 'Telangana',
    city: 'Hyderabad',
    address: 'NH-44 Logistics Corridor, Medchal, Hyderabad',
    pincode: '501401',
    location: { lat: 17.6297, lng: 78.4814 },
    manager: { name: 'Srikanth Goud', phone: '+91 98491 23456', email: 'srikanth.goud@novacart.com', employeeId: 'MGR-TS-24' },
    capacity: 90000, currentLoad: 58200, status: 'active',
    serviceArea: { radiusKm: 100, color: '#10B981', markedByAdmin: true }
  },
  {
    name: 'Hyderabad Shamshabad Super Mother Hub',
    code: 'WH-TS-HYD01',
    type: 'Mother Warehouse',
    state: 'Telangana',
    city: 'Hyderabad',
    address: 'GMR Aerospace & Logistics Park, Shamshabad, Hyderabad',
    pincode: '500409',
    location: { lat: 17.2403, lng: 78.4294 },
    manager: { name: 'Vikramaditya Reddy', phone: '+91 98490 12345', email: 'vikram.reddy@novacart.com', employeeId: 'MGR-TS-25' },
    capacity: 120000, currentLoad: 78400, status: 'active',
    serviceArea: { radiusKm: 100, color: '#2563EB', markedByAdmin: true }
  },
  {
    name: 'Ranga Reddy Gachibowli Tech Branch',
    code: 'WH-TS-HYD03',
    type: 'Delivery Branch',
    state: 'Telangana',
    city: 'Hyderabad',
    address: 'Financial District, Nanakramguda, Gachibowli, Hyderabad',
    pincode: '500032',
    location: { lat: 17.4401, lng: 78.3489 },
    manager: { name: 'Praneeth Varma', phone: '+91 98492 34567', email: 'praneeth.varma@novacart.com', employeeId: 'MGR-TS-26' },
    capacity: 35000, currentLoad: 21900, status: 'active',
    serviceArea: { radiusKm: 100, color: '#EC4899', markedByAdmin: true }
  },
  {
    name: 'Vikarabad District Hub',
    code: 'WH-TS-VKB01',
    type: 'Delivery Branch',
    state: 'Telangana',
    city: 'Vikarabad',
    address: 'Ananthagiri Hills Road, Vikarabad',
    pincode: '501101',
    location: { lat: 17.3300, lng: 77.9000 },
    manager: { name: 'Gopala Krishna', phone: '+91 98490 20027', email: 'gopal.vkb@novacart.com', employeeId: 'MGR-TS-27' },
    capacity: 22000, currentLoad: 9100, status: 'active',
    serviceArea: { radiusKm: 100, color: '#06B6D4', markedByAdmin: true }
  },
  {
    name: 'Mahabubnagar District Hub',
    code: 'WH-TS-MBN01',
    type: 'Regional Sorting Hub',
    state: 'Telangana',
    city: 'Mahabubnagar',
    address: 'Balanagar Highway, Mahabubnagar',
    pincode: '509001',
    location: { lat: 16.7400, lng: 78.0000 },
    manager: { name: 'Sudarshan Reddy', phone: '+91 98490 20028', email: 'sudarshan.mbn@novacart.com', employeeId: 'MGR-TS-28' },
    capacity: 35000, currentLoad: 17300, status: 'active',
    serviceArea: { radiusKm: 100, color: '#6366F1', markedByAdmin: true }
  },
  {
    name: 'Narayanpet District Hub',
    code: 'WH-TS-NRP01',
    type: 'Delivery Branch',
    state: 'Telangana',
    city: 'Narayanpet',
    address: 'Handloom Park Zone, Narayanpet',
    pincode: '509210',
    location: { lat: 16.7300, lng: 77.5000 },
    manager: { name: 'Babu Rao', phone: '+91 98490 20029', email: 'babu.nrp@novacart.com', employeeId: 'MGR-TS-29' },
    capacity: 18000, currentLoad: 7400, status: 'active',
    serviceArea: { radiusKm: 100, color: '#EF4444', markedByAdmin: true }
  },
  {
    name: 'Wanaparthy District Hub',
    code: 'WH-TS-WNP01',
    type: 'Delivery Branch',
    state: 'Telangana',
    city: 'Wanaparthy',
    address: 'Palem Highway, Wanaparthy',
    pincode: '509103',
    location: { lat: 16.3600, lng: 78.0600 },
    manager: { name: 'Raghavender Rao', phone: '+91 98490 20030', email: 'raghu.wnp@novacart.com', employeeId: 'MGR-TS-30' },
    capacity: 20000, currentLoad: 8200, status: 'active',
    serviceArea: { radiusKm: 100, color: '#10B981', markedByAdmin: true }
  },
  {
    name: 'Nagarkurnool District Hub',
    code: 'WH-TS-NGK01',
    type: 'Delivery Branch',
    state: 'Telangana',
    city: 'Nagarkurnool',
    address: 'Srisailam Highway Terminal, Nagarkurnool',
    pincode: '509209',
    location: { lat: 16.4800, lng: 78.3200 },
    manager: { name: 'Shiva Reddy', phone: '+91 98490 20031', email: 'shiva.ngk@novacart.com', employeeId: 'MGR-TS-31' },
    capacity: 22000, currentLoad: 9500, status: 'active',
    serviceArea: { radiusKm: 100, color: '#3B82F6', markedByAdmin: true }
  },
  {
    name: 'Jogulamba Gadwal Hub',
    code: 'WH-TS-JGD01',
    type: 'Delivery Branch',
    state: 'Telangana',
    city: 'Gadwal',
    address: 'Fort Road Goods Yard, Gadwal',
    pincode: '509125',
    location: { lat: 16.2300, lng: 77.8000 },
    manager: { name: 'Satish Kumar', phone: '+91 98490 20032', email: 'satish.jgd@novacart.com', employeeId: 'MGR-TS-32' },
    capacity: 20000, currentLoad: 8100, status: 'active',
    serviceArea: { radiusKm: 100, color: '#8B5CF6', markedByAdmin: true }
  },
  {
    name: 'Mulugu District Hub',
    code: 'WH-TS-MLG01',
    type: 'Delivery Branch',
    state: 'Telangana',
    city: 'Mulugu',
    address: 'Medaram Highway Zone, Mulugu',
    pincode: '506343',
    location: { lat: 18.1900, lng: 79.9400 },
    manager: { name: 'Thirupathi Rao', phone: '+91 98490 20033', email: 'thiru.mlg@novacart.com', employeeId: 'MGR-TS-33' },
    capacity: 18000, currentLoad: 6800, status: 'active',
    serviceArea: { radiusKm: 100, color: '#F59E0B', markedByAdmin: true }
  }
];

export const seedWarehouses = async () => {
  try {
    for (const wh of warehousesData) {
      const email = wh.manager.email.toLowerCase().trim();
      let managerUser = await User.findOne({ email });

      if (!managerUser) {
        managerUser = await User.create({
          name: wh.manager.name,
          email,
          password: 'ManagerSecure123!',
          phone: wh.manager.phone,
          role: ROLES.WAREHOUSE_MANAGER
        });
      } else {
        managerUser.role = ROLES.WAREHOUSE_MANAGER;
        managerUser.name = wh.manager.name;
        managerUser.phone = wh.manager.phone;
        await managerUser.save();
      }

      const whDoc = {
        ...wh,
        manager: {
          ...wh.manager,
          userId: managerUser._id
        }
      };

      const savedWh = await Warehouse.findOneAndUpdate(
        { code: wh.code },
        whDoc,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      managerUser.warehouseId = savedWh._id;
      await managerUser.save();
    }
    console.log(`[SEED] Successfully seeded ${warehousesData.length} Warehouses & Manager User Accounts across all 26 AP & 33 TS Districts!`);
  } catch (err) {
    console.error('[SEED] Error seeding warehouses:', err);
  }
};
