export type AppPage = 'dashboard' | 'scanner' | 'review' | 'autofill' | 'summary';

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'missing' | 'manual';

export interface FieldMeta {
  confidence: ConfidenceLevel;
  note?: string;
  source?: 'driving_license' | 'vehicle_rc' | 'manual';
  rawExtractedValue?: string;
}

export interface ScannedDocument {
  id: string;
  slot: 'driving_license' | 'vehicle_rc';
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  originalDataUrl: string;
  uploadedAt: string;
  enhanced: boolean;
  rotation: number;
  scanStatus: 'idle' | 'scanning' | 'scanned' | 'error';
  detectedType?: 'driving_license' | 'vehicle_rc' | 'other';
  detectedTypeReason?: string;
  warnings: string[];
  errorMessage?: string;
}

export interface GeneralInfo {
  entryCustomsOffice: string;
  exitCustomsOffice: string;
  vehicleNo: string;
  entryDate: string; // DD/MM/YYYY
  exitDate: string; // DD/MM/YYYY
  purpose: string;
  daysToStay: string;
  destinationPlace: string;
  hotelLocation: string;
}

export interface DriverInfo {
  nationality: string;
  drivingLicenseNumber: string;
  firstName: string;
  lastName: string;
  identityCardNumber: string;
  birthDate: string; // DD/MM/YYYY
  foreignAddress: string;
  email: string;
  localAddress: string;
  phoneCountryCode: string;
  phoneNumber: string;
  ownerSameAsDriver: boolean;
  ownerName: string;
  ownerAddress: string;
  ownerNationality: string;
  ownerIdentityCard: string;
  ownerPhone: string;
}

export interface VehicleInfo {
  vehicleType: string;
  vehicleBrand: string;
  vehicleCountry: string;
  vehicleNo: string;
  chassisNumber: string;
  engineNumber: string;
  numberOfPassengers: string;
  vehicleColor: string;
  otherDetails: string;
}

export interface VerificationChecklist {
  vehicleNumberMatches: boolean;
  driverDetailsVerified: boolean;
  chassisEngineVerified: boolean;
  documentsLegible: boolean;
  manualTaxAndSubmitUnderstood: boolean;
}

export interface TivApplication {
  id: string;
  createdAt: string;
  updatedAt: string;
  consentGiven: boolean;
  drivingLicenseDoc: ScannedDocument | null;
  vehicleRcDoc: ScannedDocument | null;
  general: GeneralInfo;
  driver: DriverInfo;
  vehicle: VehicleInfo;
  fieldMeta: Record<string, FieldMeta>;
  infoVerified: boolean;
  formFilledInPortal: boolean;
  documentsUploadedInPortal: boolean;
  checklist: VerificationChecklist;
}

export interface SelectOption {
  code: string;
  label: string;
  secondary?: string;
}

export const CUSTOMS_OFFICES: SelectOption[] = [
  { code: 'SIR02', label: 'SIR02', secondary: 'Siraha Customs Office, Gate' },
  { code: 'BIR01', label: 'BIR01', secondary: 'Birgunj Customs Office' },
  { code: 'BHA01', label: 'BHA01', secondary: 'Bhairahawa Customs Office' },
  { code: 'KAK01', label: 'KAK01', secondary: 'Mechi (Kakarvitta) Customs Office' },
  { code: 'BIR02', label: 'BIR02', secondary: 'Biratnagar Customs Office' },
  { code: 'NEP01', label: 'NEP01', secondary: 'Nepalgunj Customs Office' },
  { code: 'KRI01', label: 'KRI01', secondary: 'Krishnanagar Customs Office' },
  { code: 'JAN01', label: 'JAN01', secondary: 'Janakpur (Jatahi) Customs Office' },
  { code: 'KAI01', label: 'KAI01', secondary: 'Kailali (Dhangadhi) Customs Office' },
  { code: 'MAH01', label: 'MAH01', secondary: 'Mahakali (Gaddachauki) Customs Office' },
  { code: 'JAL01', label: 'JAL01', secondary: 'Jaleshwor Customs Office' },
  { code: 'GAU01', label: 'GAU01', secondary: 'Gaur Customs Office' },
  { code: 'SAR01', label: 'SAR01', secondary: 'Sarlahi Customs Office' },
  { code: 'SUT01', label: 'SUT01', secondary: 'Suthawli Customs Office' },
];

export const COUNTRIES: SelectOption[] = [
  { code: 'IN', label: 'IN', secondary: 'India' },
  { code: 'NP', label: 'NP', secondary: 'Nepal' },
  { code: 'BT', label: 'BT', secondary: 'Bhutan' },
  { code: 'BD', label: 'BD', secondary: 'Bangladesh' },
  { code: 'CN', label: 'CN', secondary: 'China' },
  { code: 'US', label: 'US', secondary: 'United States' },
  { code: 'GB', label: 'GB', secondary: 'United Kingdom' },
  { code: 'OTHER', label: 'OTH', secondary: 'Other Country' },
];

export const PHONE_CODES: SelectOption[] = [
  { code: '+91', label: '+91', secondary: 'India' },
  { code: '+977', label: '+977', secondary: 'Nepal' },
  { code: '+975', label: '+975', secondary: 'Bhutan' },
  { code: '+880', label: '+880', secondary: 'Bangladesh' },
  { code: '+86', label: '+86', secondary: 'China' },
  { code: '+1', label: '+1', secondary: 'US / Canada' },
  { code: '+44', label: '+44', secondary: 'United Kingdom' },
];

export const VISIT_PURPOSES: string[] = [
  'Family Visit',
  'Tourism / Sightseeing',
  'Religious / Pilgrimage',
  'Business',
  'Official',
  'Medical',
  'Transit',
  'Other',
];

export const VEHICLE_TYPES: string[] = [
  'Motorcycle or Scooter',
  'Car / Jeep / Van',
  'Pickup / Utility Vehicle',
  'Bus / Minibus',
  'Truck / Lorry',
  'Tractor / Agricultural',
  'Other',
];

export const VEHICLE_BRANDS: SelectOption[] = [
  { code: 'HON', label: 'HON', secondary: 'Honda' },
  { code: 'HER', label: 'HER', secondary: 'Hero' },
  { code: 'BAJ', label: 'BAJ', secondary: 'Bajaj' },
  { code: 'TVS', label: 'TVS', secondary: 'TVS' },
  { code: 'YAM', label: 'YAM', secondary: 'Yamaha' },
  { code: 'SUZ', label: 'SUZ', secondary: 'Suzuki' },
  { code: 'ROY', label: 'ROY', secondary: 'Royal Enfield' },
  { code: 'MAR', label: 'MAR', secondary: 'Maruti Suzuki' },
  { code: 'HYU', label: 'HYU', secondary: 'Hyundai' },
  { code: 'TAT', label: 'TAT', secondary: 'Tata Motors' },
  { code: 'MAH', label: 'MAH', secondary: 'Mahindra' },
  { code: 'TOY', label: 'TOY', secondary: 'Toyota' },
  { code: 'KIA', label: 'KIA', secondary: 'Kia' },
  { code: 'FOR', label: 'FOR', secondary: 'Ford' },
  { code: 'NIS', label: 'NIS', secondary: 'Nissan' },
  { code: 'OTH', label: 'OTH', secondary: 'Other' },
];

export function matchVehicleType(raw: string): { matched: string; exact: boolean } {
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned) return { matched: '', exact: false };
  if (
    cleaned.includes('motor') &&
    (cleaned.includes('cycle') || cleaned.includes('bike') || cleaned.includes('scooter') || cleaned.includes('2w') || cleaned.includes('m-cycle'))
  ) {
    return { matched: 'Motorcycle or Scooter', exact: true };
  }
  if (cleaned.includes('scooter') || cleaned.includes('two wheeler') || cleaned.includes('2-wheeler') || cleaned.includes('mcwg')) {
    return { matched: 'Motorcycle or Scooter', exact: true };
  }
  if (cleaned.includes('car') || cleaned.includes('jeep') || cleaned.includes('van') || cleaned.includes('lmv') || cleaned.includes('suv') || cleaned.includes('sedan') || cleaned.includes('hatchback')) {
    return { matched: 'Car / Jeep / Van', exact: true };
  }
  if (cleaned.includes('pickup') || cleaned.includes('bolero') || cleaned.includes('utility')) {
    return { matched: 'Pickup / Utility Vehicle', exact: true };
  }
  if (cleaned.includes('bus') || cleaned.includes('minibus') || cleaned.includes('coach')) {
    return { matched: 'Bus / Minibus', exact: true };
  }
  if (cleaned.includes('truck') || cleaned.includes('lorry') || cleaned.includes('hgv')) {
    return { matched: 'Truck / Lorry', exact: true };
  }
  if (cleaned.includes('tractor')) {
    return { matched: 'Tractor / Agricultural', exact: true };
  }
  const direct = VEHICLE_TYPES.find((v) => v.toLowerCase() === cleaned);
  if (direct) return { matched: direct, exact: true };
  return { matched: '', exact: false };
}

export function matchVehicleBrand(raw: string): { matched: string; exact: boolean } {
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned) return { matched: '', exact: false };
  const exactMatch = VEHICLE_BRANDS.find(
    (b) =>
      b.code.toLowerCase() === cleaned ||
      (b.secondary && cleaned.includes(b.secondary.toLowerCase())) ||
      (b.code === 'MAR' && cleaned.includes('maruti')) ||
      (b.code === 'TAT' && cleaned.includes('tata')) ||
      (b.code === 'HER' && cleaned.includes('hero')) ||
      (b.code === 'ROY' && cleaned.includes('enfield'))
  );
  if (exactMatch) return { matched: exactMatch.code, exact: true };
  return { matched: '', exact: false };
}

export function matchCountryCode(raw: string): string {
  const cleaned = raw.trim().toUpperCase();
  if (!cleaned) return '';
  if (cleaned === 'IN' || cleaned.includes('INDIA') || cleaned.includes('BHARAT')) return 'IN';
  if (cleaned === 'NP' || cleaned.includes('NEPAL')) return 'NP';
  if (cleaned === 'BT' || cleaned.includes('BHUTAN')) return 'BT';
  if (cleaned === 'BD' || cleaned.includes('BANGLADESH')) return 'BD';
  if (cleaned === 'CN' || cleaned.includes('CHINA')) return 'CN';
  const found = COUNTRIES.find((c) => c.code === cleaned);
  return found ? found.code : '';
}
