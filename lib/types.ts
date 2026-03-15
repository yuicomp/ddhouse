export type Floor = 'B1F' | '1F' | '2F' | '3F';

export interface Shop {
  store_id: string;
  name: string;
  floor: Floor;
}

export interface Prize {
  prize_id: string;
  name: string;
  order: number;
}

export interface LogEntry {
  log_id: string;
  device_id: string;
  device_label: string;
  timestamp: string; // ISO 8601
  store_id: string;
  store_name: string;
  floor: string;
  receipt_amount: number;
  slot_count: number;
  prizes: Record<string, number>; // { p1: 0, p2: 1 }
  synced: boolean;
  from_remote: boolean;
}
