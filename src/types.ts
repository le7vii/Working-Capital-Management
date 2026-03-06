export type TransactionType = 'payable' | 'receivable';
export type TransactionStatus = 'pending' | 'paid' | 'overdue';

export interface Transaction {
  id?: string;
  type: TransactionType;
  amount: number;
  dueDate: string; // ISO string
  status: TransactionStatus;
  description: string;
  counterparty: string;
  category: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  userId: string;
  email: string;
  companyName?: string;
  currency?: string;
}
