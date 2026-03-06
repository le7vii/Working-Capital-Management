export interface BankBalance {
  id?: string;
  bankName: string;
  accountName: string;
  balance: number;
  currency: string;
  date: string;
  userId: string;
}

export interface Receivable {
  id?: string;
  customerName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  invoiceAmount: number;
  amountOutstanding: number;
  paymentTerms: string;
  daysOutstanding: number;
  userId: string;
}

export interface Payable {
  id?: string;
  vendorName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  invoiceAmount: number;
  amountOutstanding: number;
  paymentTerms: string;
  daysOutstanding: number;
  userId: string;
}

export interface UserProfile {
  userId: string;
  email: string;
  companyName?: string;
}
