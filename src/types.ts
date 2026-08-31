export type Shift = 'morning' | 'afternoon';

export type CollectionEntry = {
  id: number;
  date: string;
  morning_litres: number | null;
  afternoon_litres: number | null;
  rate: number;
};

export type LedgerRow = {
  date: string;
  morning_litres: number | null;
  afternoon_litres: number | null;
  total: number;
  rate: number;
  amount: number;
};

export type DashboardTotals = {
  total_litres: number;
  total_revenue: number;
  days_logged: number;
};

export type RootStackParamList = {
  Home: undefined;
  LogEntry: { shift: Shift };
  Dashboard: undefined;
  Ledger: undefined;
  Settings: undefined;
};
