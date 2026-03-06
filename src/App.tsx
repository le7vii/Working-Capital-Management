import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  User, 
  signOut 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  orderBy,
  writeBatch,
  setDoc,
  getDocs
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { 
  format, 
  parseISO,
  differenceInDays,
  addDays,
  isAfter,
  isBefore,
  startOfDay
} from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { 
  LayoutDashboard, 
  Users, 
  Truck, 
  BarChart3, 
  ShieldAlert, 
  Zap, 
  MessageSquare, 
  Upload, 
  LogOut, 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Search,
  Plus,
  ArrowRight,
  Info,
  Send,
  Loader2,
  FileText,
  Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Markdown from 'react-markdown';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { BankBalance, Receivable, Payable, UserProfile } from './types';
import { ErrorBoundary } from './components/ErrorBoundary';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GoogleGenAI } from "@google/genai";

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
type ActiveModule = 'command-center' | 'ar-intelligence' | 'ap-optimization' | 'kpi-dashboard' | 'leak-detection' | 'simulation' | 'ai-assistant' | 'data-management';

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
      active 
        ? "bg-zinc-900 text-white shadow-lg shadow-zinc-900/20" 
        : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
    )}
  >
    <Icon size={20} className={cn("transition-colors", active ? "text-white" : "text-zinc-400 group-hover:text-zinc-900")} />
    <span className="font-semibold text-sm">{label}</span>
  </button>
);

const ModuleCard = ({ title, description, children, className }: { title: string, description?: string, children: React.ReactNode, className?: string }) => (
  <div className={cn("bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden", className)}>
    <div className="px-6 py-5 border-b border-zinc-100">
      <h3 className="text-lg font-bold text-zinc-900">{title}</h3>
      {description && <p className="text-sm text-zinc-500 mt-0.5">{description}</p>}
    </div>
    <div className="p-6">
      {children}
    </div>
  </div>
);

const StatBox = ({ label, value, subValue, type = 'neutral' }: { label: string, value: string, subValue?: string, type?: 'positive' | 'negative' | 'neutral' }) => (
  <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-100">
    <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">{label}</p>
    <p className={cn(
      "text-xl font-bold",
      type === 'positive' ? "text-emerald-600" : type === 'negative' ? "text-rose-600" : "text-zinc-900"
    )}>{value}</p>
    {subValue && <p className="text-xs text-zinc-500 mt-1">{subValue}</p>}
  </div>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeModule, setActiveModule] = useState<ActiveModule>('command-center');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  
  // Data States
  const [bankBalances, setBankBalances] = useState<BankBalance[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [payables, setPayables] = useState<Payable[]>([]);
  
  // AI Assistant States
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error' | 'loading', message: string } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Simulation States
  const [simScenario, setSimScenario] = useState<{
    delayedReceivables: number; // percentage
    acceleratedPayables: number; // percentage
    revenueDecline: number; // percentage
    unexpectedExpense: number; // amount
  }>({
    delayedReceivables: 0,
    acceleratedPayables: 0,
    revenueDecline: 0,
    unexpectedExpense: 0
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubProfile = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) setProfile(snap.data() as UserProfile);
      else {
        const newProfile = { userId: user.uid, email: user.email || '' };
        setDoc(doc(db, 'users', user.uid), newProfile).catch(e => handleFirestoreError(e, OperationType.CREATE, `users/${user.uid}`));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    });

    const unsubBalances = onSnapshot(query(collection(db, 'bankBalances'), where('userId', '==', user.uid)), (snap) => {
      setBankBalances(snap.docs.map(d => ({ id: d.id, ...d.data() } as BankBalance)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bankBalances');
    });

    const unsubReceivables = onSnapshot(query(collection(db, 'receivables'), where('userId', '==', user.uid)), (snap) => {
      setReceivables(snap.docs.map(d => ({ id: d.id, ...d.data() } as Receivable)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'receivables');
    });

    const unsubPayables = onSnapshot(query(collection(db, 'payables'), where('userId', '==', user.uid)), (snap) => {
      setPayables(snap.docs.map(d => ({ id: d.id, ...d.data() } as Payable)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'payables');
    });

    return () => {
      unsubProfile();
      unsubBalances();
      unsubReceivables();
      unsubPayables();
    };
  }, [user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  const handleLogout = () => signOut(auth);

  // --- Calculations ---

  const totals = useMemo(() => {
    const bankTotal = bankBalances.reduce((acc, b) => acc + b.balance, 0);
    const arTotal = receivables.reduce((acc, r) => acc + r.amountOutstanding, 0);
    const apTotal = payables.reduce((acc, p) => acc + p.amountOutstanding, 0);
    return { bankTotal, arTotal, apTotal, net: bankTotal + arTotal - apTotal };
  }, [bankBalances, receivables, payables]);

  const arAging = useMemo(() => {
    const aging = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    receivables.forEach(r => {
      const days = r.daysOutstanding;
      if (days <= 0) aging.current += r.amountOutstanding;
      else if (days <= 30) aging['1-30'] += r.amountOutstanding;
      else if (days <= 60) aging['31-60'] += r.amountOutstanding;
      else if (days <= 90) aging['61-90'] += r.amountOutstanding;
      else aging['90+'] += r.amountOutstanding;
    });
    return aging;
  }, [receivables]);

  const kpis = useMemo(() => {
    // Simplified DSO/DPO for demo purposes
    // In a real app, these would use revenue/COGS over a period
    const dso = receivables.length > 0 ? Math.round(receivables.reduce((acc, r) => acc + r.daysOutstanding, 0) / receivables.length) : 0;
    const dpo = payables.length > 0 ? Math.round(payables.reduce((acc, p) => acc + p.daysOutstanding, 0) / payables.length) : 0;
    
    // Concentration risk (percentage of top 3 customers)
    const sortedAR = [...receivables].sort((a, b) => b.amountOutstanding - a.amountOutstanding);
    const top3AR = sortedAR.slice(0, 3).reduce((acc, r) => acc + r.amountOutstanding, 0);
    const concentration = totals.arTotal > 0 ? (top3AR / totals.arTotal) * 100 : 0;

    return { dso, dpo, concentration };
  }, [receivables, payables, totals]);

  const cashLeaks = useMemo(() => {
    const leaks: { type: string, entity: string, amount: number, risk: 'Low' | 'Moderate' | 'High', recommendation: string }[] = [];
    
    // Duplicate Invoices
    const arInvoices = new Set();
    receivables.forEach(r => {
      if (arInvoices.has(r.invoiceNumber)) {
        leaks.push({ type: 'Duplicate AR Invoice', entity: r.customerName, amount: r.invoiceAmount, risk: 'High', recommendation: 'Verify invoice validity and potential double billing.' });
      }
      arInvoices.add(r.invoiceNumber);
    });

    const apInvoices = new Set();
    payables.forEach(p => {
      if (apInvoices.has(p.invoiceNumber)) {
        leaks.push({ type: 'Duplicate AP Invoice', entity: p.vendorName, amount: p.invoiceAmount, risk: 'High', recommendation: 'Check for potential double payment to vendor.' });
      }
      apInvoices.add(p.invoiceNumber);
    });

    // Large Payments
    const avgAP = payables.length > 0 ? totals.apTotal / payables.length : 0;
    payables.forEach(p => {
      if (p.amountOutstanding > avgAP * 5) {
        leaks.push({ type: 'Unusually Large Payable', entity: p.vendorName, amount: p.amountOutstanding, risk: 'Moderate', recommendation: 'Review payment terms and verify invoice accuracy.' });
      }
    });

    return leaks;
  }, [receivables, payables, totals]);

  const simulationResults = useMemo(() => {
    const baseNet = totals.net;
    const arImpact = totals.arTotal * (simScenario.delayedReceivables / 100);
    const apImpact = totals.apTotal * (simScenario.acceleratedPayables / 100);
    const revenueImpact = totals.arTotal * (simScenario.revenueDecline / 100);
    
    const totalImpact = arImpact + apImpact + revenueImpact + simScenario.unexpectedExpense;
    const revisedNet = baseNet - totalImpact;

    return { totalImpact, revisedNet, risk: revisedNet < 0 ? 'High' : revisedNet < totals.bankTotal ? 'Moderate' : 'Low' };
  }, [totals, simScenario]);

  // --- AI Assistant ---

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isTyping) return;

    const userMsg = inputMessage.trim();
    setInputMessage('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const context = `
        Current Financial Data:
        - Total Bank Balance: NPR ${totals.bankTotal.toLocaleString()}
        - Total Receivables: NPR ${totals.arTotal.toLocaleString()}
        - Total Payables: NPR ${totals.apTotal.toLocaleString()}
        - DSO: ${kpis.dso} days
        - DPO: ${kpis.dpo} days
        - AR Aging: Current: ${arAging.current}, 1-30: ${arAging['1-30']}, 31-60: ${arAging['31-60']}, 61-90: ${arAging['61-90']}, 90+: ${arAging['90+']}
        - Top 3 AR Concentration: ${kpis.concentration.toFixed(1)}%
        - Cash Leaks Detected: ${cashLeaks.length}
      `;

      const prompt = `
        You are an AI Corporate Treasury and Working Capital Analyst. 
        Act as a CFO advisor. Use the provided financial data to answer the user's question.
        Provide analytical reasoning and practical financial recommendations. 
        Avoid generic textbook explanations.
        
        Format your response exactly as follows:
        ### Answer
        [Your direct answer here]
        
        ### Supporting Financial Insight
        [Data-driven insight based on the provided context]
        
        ### Recommended Action
        [Specific, actionable step for the user]

        Context: ${context}
        User Question: ${userMsg}
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });

      setChatMessages(prev => [...prev, { role: 'assistant', content: response.text || "I'm sorry, I couldn't process that request." }]);
    } catch (error) {
      console.error('AI Error:', error);
      setChatMessages(prev => [...prev, { role: 'assistant', content: "Error connecting to AI Assistant. Please check your configuration." }]);
    } finally {
      setIsTyping(false);
    }
  };

  // --- Excel Import ---

  const getCellValue = (row: any, keys: string[]) => {
    const rowKeys = Object.keys(row);
    for (const key of keys) {
      // Direct match
      if (row[key] !== undefined) return row[key];
      // Case-insensitive match
      const foundKey = rowKeys.find(rk => rk.toLowerCase().trim() === key.toLowerCase().trim());
      if (foundKey) return row[foundKey];
    }
    return undefined;
  };

  const parseExcelDate = (val: any) => {
    if (!val) return new Date().toISOString();
    
    // If it's already a Date object
    if (val instanceof Date) return val.toISOString();
    
    // If it's an Excel serial number (number)
    if (typeof val === 'number') {
      // Excel dates are days since 1900-01-01
      const date = new Date((val - 25569) * 86400 * 1000);
      return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
    }
    
    // If it's a string, try parsing it
    const date = new Date(val);
    return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  };

  const safeFormatDate = (dateStr: string, formatStr: string = 'MMM dd, yyyy') => {
    try {
      const date = parseISO(dateStr);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return format(date, formatStr);
    } catch (e) {
      return 'Invalid Date';
    }
  };

  const safeAddDays = (dateStr: string, days: number) => {
    try {
      const date = parseISO(dateStr);
      if (isNaN(date.getTime())) return new Date();
      return addDays(date, days);
    } catch (e) {
      return new Date();
    }
  };

  const safeDifferenceInDays = (dateStr: string, otherDate: Date) => {
    try {
      const date = parseISO(dateStr);
      if (isNaN(date.getTime())) return 999; // Default to far future
      return differenceInDays(date, otherDate);
    } catch (e) {
      return 999;
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'bank' | 'ar' | 'ap') => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setImportStatus({ type: 'loading', message: 'Processing file...' });

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const dataBuffer = evt.target?.result;
        if (!dataBuffer) throw new Error("Failed to read file");
        
        const wb = XLSX.read(dataBuffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (data.length === 0) {
          setImportStatus({ type: 'error', message: 'The file appears to be empty.' });
          return;
        }

        // Process in chunks of 500 (Firestore batch limit)
        const chunks = [];
        for (let i = 0; i < data.length; i += 500) {
          chunks.push(data.slice(i, i + 500));
        }

        let totalImported = 0;

        for (const chunk of chunks) {
          const batch = writeBatch(db);
          let chunkCount = 0;

          chunk.forEach((row) => {
            if (type === 'bank') {
              const bankName = String(getCellValue(row, ['Bank Name', 'Bank', 'bankName']) || '');
              const balance = Number(getCellValue(row, ['Balance', 'Amount', 'balance']) || 0);
              
              if (bankName) {
                const docRef = doc(collection(db, 'bankBalances'));
                batch.set(docRef, {
                  bankName: bankName,
                  accountName: String(getCellValue(row, ['Account Name', 'Account', 'accountName']) || 'Primary'),
                  balance: isNaN(balance) ? 0 : balance,
                  currency: String(getCellValue(row, ['Currency', 'currency']) || 'NPR'),
                  date: parseExcelDate(getCellValue(row, ['Date', 'date'])),
                  userId: user.uid
                });
                chunkCount++;
              }
            } else if (type === 'ar') {
              const customerName = String(getCellValue(row, ['Customer Name', 'Customer', 'customerName', 'Client', 'CustomerName']) || '');
              const amount = Number(getCellValue(row, ['Invoice Amount', 'Amount', 'invoiceAmount', 'Total']) || 0);
              const outstanding = Number(getCellValue(row, ['Amount Outstanding', 'Outstanding', 'amountOutstanding', 'Balance']) || 0);
              
              if (customerName) {
                const docRef = doc(collection(db, 'receivables'));
                batch.set(docRef, {
                  customerName: customerName,
                  invoiceNumber: String(getCellValue(row, ['Invoice Number', 'Invoice #', 'invoiceNumber', 'Invoice No', 'Inv #']) || ''),
                  invoiceDate: parseExcelDate(getCellValue(row, ['Invoice Date', 'Date', 'invoiceDate', 'Inv Date'])),
                  dueDate: parseExcelDate(getCellValue(row, ['Due Date', 'dueDate', 'Due'])),
                  invoiceAmount: isNaN(amount) ? 0 : amount,
                  amountOutstanding: isNaN(outstanding) ? 0 : outstanding,
                  paymentTerms: String(getCellValue(row, ['Payment Terms', 'Terms', 'paymentTerms']) || 'Net 30'),
                  daysOutstanding: Number(getCellValue(row, ['Days Outstanding', 'Days', 'daysOutstanding', 'Overdue']) || 0),
                  userId: user.uid
                });
                chunkCount++;
              }
            } else if (type === 'ap') {
              const vendorName = String(getCellValue(row, ['Vendor Name', 'Vendor', 'vendorName', 'Supplier', 'Supplier Name', 'supplierName']) || '');
              const amount = Number(getCellValue(row, ['Invoice Amount', 'Amount', 'invoiceAmount', 'Total', 'Bill Amount']) || 0);
              const outstanding = Number(getCellValue(row, ['Amount Outstanding', 'Outstanding', 'amountOutstanding', 'Balance', 'Bill Outstanding']) || 0);
              
              if (vendorName) {
                const docRef = doc(collection(db, 'payables'));
                batch.set(docRef, {
                  vendorName: vendorName,
                  invoiceNumber: String(getCellValue(row, ['Invoice Number', 'Invoice #', 'invoiceNumber', 'Invoice No', 'Inv #', 'Bill Number', 'Bill #']) || ''),
                  invoiceDate: parseExcelDate(getCellValue(row, ['Invoice Date', 'Date', 'invoiceDate', 'Inv Date', 'Bill Date'])),
                  dueDate: parseExcelDate(getCellValue(row, ['Due Date', 'dueDate', 'Due'])),
                  invoiceAmount: isNaN(amount) ? 0 : amount,
                  amountOutstanding: isNaN(outstanding) ? 0 : outstanding,
                  paymentTerms: String(getCellValue(row, ['Payment Terms', 'Terms', 'paymentTerms']) || 'Net 30'),
                  daysOutstanding: Number(getCellValue(row, ['Days Outstanding', 'Days', 'daysOutstanding', 'Overdue']) || 0),
                  userId: user.uid
                });
                chunkCount++;
              }
            }
          });

          if (chunkCount > 0) {
            await batch.commit();
            totalImported += chunkCount;
          }
        }

        setImportStatus({ type: 'success', message: `Successfully imported ${totalImported} records.` });
        setTimeout(() => setImportStatus(null), 5000);
      } catch (error) {
        console.error('Import Error:', error);
        setImportStatus({ type: 'error', message: 'Failed to import data. Please check file format and permissions.' });
        handleFirestoreError(error, OperationType.WRITE, type);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-zinc-50"><Loader2 className="animate-spin text-zinc-400" size={40} /></div>;

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center"
        >
          <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl rotate-3">
            <Zap className="text-white" size={40} />
          </div>
          <h1 className="text-4xl font-bold text-zinc-900 mb-4 tracking-tight">CapFlow AI</h1>
          <p className="text-zinc-500 mb-10 text-lg leading-relaxed">
            AI-Powered Corporate Treasury & Working Capital Analyst.
          </p>
          <button 
            onClick={handleLogin}
            className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-semibold text-lg hover:bg-zinc-800 transition-all shadow-lg hover:shadow-zinc-900/20 active:scale-[0.98] flex items-center justify-center gap-3"
          >
            <LayoutDashboard size={20} />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans flex">
        {/* Sidebar */}
        <aside className="w-72 bg-white border-r border-zinc-200 flex flex-col sticky top-0 h-screen">
          <div className="p-6 flex items-center gap-3 border-b border-zinc-100">
            <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center shadow-lg">
              <Zap className="text-white" size={20} />
            </div>
            <span className="text-xl font-bold tracking-tight">CapFlow AI</span>
          </div>
          
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <SidebarItem icon={LayoutDashboard} label="Command Center" active={activeModule === 'command-center'} onClick={() => setActiveModule('command-center')} />
            <SidebarItem icon={Users} label="AR Intelligence" active={activeModule === 'ar-intelligence'} onClick={() => setActiveModule('ar-intelligence')} />
            <SidebarItem icon={Truck} label="AP Optimization" active={activeModule === 'ap-optimization'} onClick={() => setActiveModule('ap-optimization')} />
            <SidebarItem icon={BarChart3} label="KPI Dashboard" active={activeModule === 'kpi-dashboard'} onClick={() => setActiveModule('kpi-dashboard')} />
            <SidebarItem icon={ShieldAlert} label="Leak Detection" active={activeModule === 'leak-detection'} onClick={() => setActiveModule('leak-detection')} />
            <SidebarItem icon={Zap} label="Simulation Engine" active={activeModule === 'simulation'} onClick={() => setActiveModule('simulation')} />
            <SidebarItem icon={MessageSquare} label="AI CFO Assistant" active={activeModule === 'ai-assistant'} onClick={() => setActiveModule('ai-assistant')} />
            <div className="pt-4 mt-4 border-t border-zinc-100">
              <SidebarItem icon={Database} label="Data Management" active={activeModule === 'data-management'} onClick={() => setActiveModule('data-management')} />
            </div>
          </nav>

          <div className="p-4 border-t border-zinc-100">
            <div className="flex items-center gap-3 px-4 py-3 bg-zinc-50 rounded-xl mb-4">
              <div className="w-8 h-8 bg-zinc-200 rounded-full flex items-center justify-center text-xs font-bold text-zinc-600">
                {user.displayName?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-zinc-900 truncate">{user.displayName}</p>
                <p className="text-[10px] text-zinc-400 truncate">{user.email}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-500 hover:bg-rose-50 transition-colors font-semibold text-sm"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <AnimatePresence>
            {importStatus && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={cn(
                  "mb-6 p-4 rounded-xl border flex items-center justify-between",
                  importStatus.type === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-700" :
                  importStatus.type === 'error' ? "bg-rose-50 border-rose-100 text-rose-700" :
                  "bg-zinc-50 border-zinc-100 text-zinc-700"
                )}
              >
                <div className="flex items-center gap-3">
                  {importStatus.type === 'loading' ? <Loader2 size={18} className="animate-spin" /> : 
                   importStatus.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  <span className="text-sm font-medium">{importStatus.message}</span>
                </div>
                {importStatus.type !== 'loading' && (
                  <button onClick={() => setImportStatus(null)} className="text-current opacity-50 hover:opacity-100">
                    <Plus size={18} className="rotate-45" />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {activeModule === 'command-center' && (
              <motion.div key="cc" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold text-zinc-900">Cash Flow Command Center</h2>
                    <p className="text-zinc-500 mt-1">Real-time liquidity visibility and risk assessment.</p>
                  </div>
                  <div className={cn(
                    "px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2",
                    totals.net > totals.bankTotal ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                  )}>
                    <div className={cn("w-2 h-2 rounded-full animate-pulse", totals.net > totals.bankTotal ? "bg-emerald-500" : "bg-rose-500")} />
                    {totals.net > totals.bankTotal ? "Liquidity Healthy" : "Liquidity Risk"}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <StatBox label="Total Bank Balance" value={`NPR ${totals.bankTotal.toLocaleString()}`} />
                  <StatBox label="Expected Receipts" value={`NPR ${totals.arTotal.toLocaleString()}`} type="positive" />
                  <StatBox label="Expected Payments" value={`NPR ${totals.apTotal.toLocaleString()}`} type="negative" />
                  <StatBox label="Net Short-Term Position" value={`NPR ${totals.net.toLocaleString()}`} subValue="Projected liquidity" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <ModuleCard title="Liquidity Risk Assessment">
                    <div className="space-y-6">
                      <div className="flex items-center gap-4 p-4 rounded-xl bg-zinc-50 border border-zinc-100">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center text-white",
                          totals.net < 0 ? "bg-rose-500" : totals.net < totals.bankTotal ? "bg-amber-500" : "bg-emerald-500"
                        )}>
                          <AlertCircle size={24} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Risk Level</p>
                          <p className="text-xl font-bold text-zinc-900">
                            {totals.net < 0 ? "High" : totals.net < totals.bankTotal ? "Moderate" : "Low"}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <h4 className="text-sm font-bold text-zinc-900">Key Drivers of Risk</h4>
                        <ul className="space-y-2">
                          {totals.apTotal > totals.bankTotal && <li className="text-sm text-zinc-600 flex items-center gap-2"><ArrowRight size={14} className="text-rose-500" /> Payables exceed current cash on hand.</li>}
                          {kpis.dso > 45 && <li className="text-sm text-zinc-600 flex items-center gap-2"><ArrowRight size={14} className="text-amber-500" /> High DSO (Collection delay risk).</li>}
                          {kpis.concentration > 50 && <li className="text-sm text-zinc-600 flex items-center gap-2"><ArrowRight size={14} className="text-amber-500" /> High customer concentration risk.</li>}
                          {cashLeaks.length > 0 && <li className="text-sm text-zinc-600 flex items-center gap-2"><ArrowRight size={14} className="text-rose-500" /> Potential cash leaks detected.</li>}
                        </ul>
                      </div>
                      <div className="p-4 rounded-xl bg-zinc-900 text-white">
                        <h4 className="text-sm font-bold mb-2">Immediate Recommended Actions</h4>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          {totals.net < 0 
                            ? "Prioritize critical vendor payments and accelerate AR collections immediately. Consider short-term credit facility."
                            : "Maintain current collection efforts and monitor high-value payables. Optimize payment timing to preserve cash."}
                        </p>
                      </div>
                    </div>
                  </ModuleCard>

                  <ModuleCard title="Cash Flow Trend">
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[
                          { name: 'Current Cash', value: totals.bankTotal },
                          { name: 'Net Position', value: totals.net }
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#a1a1aa', fontSize: 12 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#a1a1aa', fontSize: 12 }} />
                          <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                          <Bar dataKey="value" fill="#18181b" radius={[8, 8, 0, 0]} barSize={60} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </ModuleCard>
                </div>
              </motion.div>
            )}

            {activeModule === 'ar-intelligence' && (
              <motion.div key="ar" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                <div>
                  <h2 className="text-3xl font-bold text-zinc-900">Accounts Receivable Intelligence</h2>
                  <p className="text-zinc-500 mt-1">Optimize cash collection and identify high-risk customers.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatBox label="Total Receivables" value={`NPR ${totals.arTotal.toLocaleString()}`} />
                  <StatBox label="Overdue Amount" value={`NPR ${(totals.arTotal - arAging.current).toLocaleString()}`} type="negative" />
                  <StatBox label="Avg Days Outstanding" value={`${kpis.dso} Days`} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <ModuleCard title="AR Aging Summary">
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Current', value: arAging.current },
                              { name: '1-30 Days', value: arAging['1-30'] },
                              { name: '31-60 Days', value: arAging['31-60'] },
                              { name: '61-90 Days', value: arAging['61-90'] },
                              { name: '90+ Days', value: arAging['90+'] }
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            <Cell fill="#10b981" />
                            <Cell fill="#fbbf24" />
                            <Cell fill="#f59e0b" />
                            <Cell fill="#ef4444" />
                            <Cell fill="#b91c1c" />
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </ModuleCard>

                  <ModuleCard title="Collection Priority List">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="text-zinc-400 uppercase text-[10px] font-bold tracking-wider">
                            <th className="pb-4">Customer</th>
                            <th className="pb-4 text-right">Amount</th>
                            <th className="pb-4 text-right">Overdue</th>
                            <th className="pb-4 text-right">Risk</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {receivables.filter(r => r.daysOutstanding > 0).sort((a, b) => b.amountOutstanding - a.amountOutstanding).slice(0, 5).map((r, i) => (
                            <tr key={i} className="group">
                              <td className="py-3 font-semibold text-zinc-900">{r.customerName}</td>
                              <td className="py-3 text-right">NPR {r.amountOutstanding.toLocaleString()}</td>
                              <td className="py-3 text-right text-rose-500 font-bold">{r.daysOutstanding}d</td>
                              <td className="py-3 text-right">
                                <span className={cn(
                                  "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                                  r.daysOutstanding > 60 ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"
                                )}>
                                  {r.daysOutstanding > 60 ? "High" : "Moderate"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </ModuleCard>
                </div>
              </motion.div>
            )}

            {activeModule === 'ap-optimization' && (
              <motion.div key="ap" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                <div>
                  <h2 className="text-3xl font-bold text-zinc-900">Accounts Payable Optimization</h2>
                  <p className="text-zinc-500 mt-1">Preserve liquidity while maintaining vendor relationships.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatBox label="Total Payables" value={`NPR ${totals.apTotal.toLocaleString()}`} />
                  <StatBox label="Upcoming (7 Days)" value={`NPR ${payables.filter(p => safeDifferenceInDays(p.dueDate, new Date()) <= 7).reduce((acc, p) => acc + p.amountOutstanding, 0).toLocaleString()}`} type="negative" />
                  <StatBox label="Avg Payment Terms" value="Net 30" />
                </div>

                <ModuleCard title="Payables Strategy">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="text-zinc-400 uppercase text-[10px] font-bold tracking-wider">
                          <th className="pb-4">Vendor</th>
                          <th className="pb-4 text-right">Amount</th>
                          <th className="pb-4 text-right">Due Date</th>
                          <th className="pb-4 text-right">Suggested Date</th>
                          <th className="pb-4 text-right">Risk</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {payables.sort((a, b) => {
                          const dateA = parseISO(a.dueDate);
                          const dateB = parseISO(b.dueDate);
                          return (isNaN(dateA.getTime()) ? 0 : dateA.getTime()) - (isNaN(dateB.getTime()) ? 0 : dateB.getTime());
                        }).slice(0, 10).map((p, i) => (
                          <tr key={i}>
                            <td className="py-4 font-semibold text-zinc-900">{p.vendorName}</td>
                            <td className="py-4 text-right">NPR {p.amountOutstanding.toLocaleString()}</td>
                            <td className="py-4 text-right text-zinc-500">{safeFormatDate(p.dueDate)}</td>
                            <td className="py-4 text-right text-emerald-600 font-bold">
                              {safeFormatDate(safeAddDays(p.dueDate, -2).toISOString())}
                            </td>
                            <td className="py-4 text-right">
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                                p.amountOutstanding > 500000 ? "bg-rose-50 text-rose-600" : "bg-zinc-50 text-zinc-600"
                              )}>
                                {p.amountOutstanding > 500000 ? "High" : "Low"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ModuleCard>
              </motion.div>
            )}

            {activeModule === 'kpi-dashboard' && (
              <motion.div key="kpi" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                <div>
                  <h2 className="text-3xl font-bold text-zinc-900">Working Capital KPI Dashboard</h2>
                  <p className="text-zinc-500 mt-1">Core metrics for operational efficiency.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  <ModuleCard title="Days Sales Outstanding (DSO)">
                    <div className="text-center py-8">
                      <p className="text-5xl font-bold text-zinc-900 mb-2">{kpis.dso}</p>
                      <p className="text-sm text-zinc-500 font-medium uppercase tracking-widest">Days</p>
                      <div className="mt-6 p-4 rounded-xl bg-zinc-50 text-left">
                        <p className="text-xs font-bold text-zinc-400 uppercase mb-1">Interpretation</p>
                        <p className="text-sm text-zinc-700">
                          {kpis.dso > 45 ? "High collection cycle. Cash is tied up in receivables." : "Efficient collection cycle. Good liquidity flow."}
                        </p>
                      </div>
                    </div>
                  </ModuleCard>

                  <ModuleCard title="Days Payables Outstanding (DPO)">
                    <div className="text-center py-8">
                      <p className="text-5xl font-bold text-zinc-900 mb-2">{kpis.dpo}</p>
                      <p className="text-sm text-zinc-500 font-medium uppercase tracking-widest">Days</p>
                      <div className="mt-6 p-4 rounded-xl bg-zinc-50 text-left">
                        <p className="text-xs font-bold text-zinc-400 uppercase mb-1">Interpretation</p>
                        <p className="text-sm text-zinc-700">
                          {kpis.dpo < 30 ? "Aggressive payment schedule. Potential to extend terms." : "Healthy payment cycle. Preserving cash effectively."}
                        </p>
                      </div>
                    </div>
                  </ModuleCard>

                  <ModuleCard title="AR Concentration Risk">
                    <div className="text-center py-8">
                      <p className="text-5xl font-bold text-zinc-900 mb-2">{kpis.concentration.toFixed(1)}%</p>
                      <p className="text-sm text-zinc-500 font-medium uppercase tracking-widest">Top 3 Customers</p>
                      <div className="mt-6 p-4 rounded-xl bg-zinc-50 text-left">
                        <p className="text-xs font-bold text-zinc-400 uppercase mb-1">Operational Implication</p>
                        <p className="text-sm text-zinc-700">
                          {kpis.concentration > 40 ? "High dependency. A single default could impact liquidity." : "Diversified receivable base. Lower systemic risk."}
                        </p>
                      </div>
                    </div>
                  </ModuleCard>
                </div>
              </motion.div>
            )}

            {activeModule === 'leak-detection' && (
              <motion.div key="leak" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                <div>
                  <h2 className="text-3xl font-bold text-zinc-900">Cash Leak Detection</h2>
                  <p className="text-zinc-500 mt-1">Identify anomalies and suspicious financial patterns.</p>
                </div>

                <ModuleCard title="Cash Leak Alerts">
                  <div className="space-y-4">
                    {cashLeaks.map((leak, i) => (
                      <div key={i} className="flex items-start gap-4 p-6 rounded-2xl bg-white border border-zinc-200 shadow-sm hover:shadow-md transition-all">
                        <div className={cn(
                          "p-3 rounded-xl",
                          leak.risk === 'High' ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"
                        )}>
                          <ShieldAlert size={24} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-bold text-zinc-900">{leak.type}</h4>
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                              leak.risk === 'High' ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"
                            )}>{leak.risk} Risk</span>
                          </div>
                          <p className="text-sm text-zinc-600 mb-3">{leak.entity} — NPR {leak.amount.toLocaleString()}</p>
                          <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                            <p className="text-xs font-bold text-zinc-400 uppercase mb-1">Recommended Investigation</p>
                            <p className="text-sm text-zinc-700">{leak.recommendation}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {cashLeaks.length === 0 && (
                      <div className="text-center py-12">
                        <CheckCircle2 className="mx-auto text-emerald-500 mb-4" size={48} />
                        <p className="text-lg font-bold text-zinc-900">No Leaks Detected</p>
                        <p className="text-zinc-500">All financial patterns appear normal.</p>
                      </div>
                    )}
                  </div>
                </ModuleCard>
              </motion.div>
            )}

            {activeModule === 'simulation' && (
              <motion.div key="sim" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                <div>
                  <h2 className="text-3xl font-bold text-zinc-900">Scenario Simulation Engine</h2>
                  <p className="text-zinc-500 mt-1">Simulate the impact of market shifts on your liquidity.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <ModuleCard title="Simulation Controls" className="lg:col-span-1">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase">Delayed Receivables (%)</label>
                        <input type="range" min="0" max="100" value={simScenario.delayedReceivables} onChange={e => setSimScenario({...simScenario, delayedReceivables: parseInt(e.target.value)})} className="w-full" />
                        <p className="text-right text-sm font-bold">{simScenario.delayedReceivables}%</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase">Accelerated Payables (%)</label>
                        <input type="range" min="0" max="100" value={simScenario.acceleratedPayables} onChange={e => setSimScenario({...simScenario, acceleratedPayables: parseInt(e.target.value)})} className="w-full" />
                        <p className="text-right text-sm font-bold">{simScenario.acceleratedPayables}%</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase">Revenue Decline (%)</label>
                        <input type="range" min="0" max="100" value={simScenario.revenueDecline} onChange={e => setSimScenario({...simScenario, revenueDecline: parseInt(e.target.value)})} className="w-full" />
                        <p className="text-right text-sm font-bold">{simScenario.revenueDecline}%</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase">Unexpected Expense (NPR)</label>
                        <input type="number" value={simScenario.unexpectedExpense} onChange={e => setSimScenario({...simScenario, unexpectedExpense: parseInt(e.target.value) || 0})} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 text-sm" />
                      </div>
                    </div>
                  </ModuleCard>

                  <div className="lg:col-span-2 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <StatBox label="Simulated Cash Impact" value={`- NPR ${simulationResults.totalImpact.toLocaleString()}`} type="negative" />
                      <StatBox label="Revised Net Position" value={`NPR ${simulationResults.revisedNet.toLocaleString()}`} type={simulationResults.revisedNet < 0 ? 'negative' : 'neutral'} />
                    </div>

                    <ModuleCard title="Scenario Summary">
                      <div className="space-y-6">
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-zinc-50 border border-zinc-100">
                          <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center text-white",
                            simulationResults.risk === 'High' ? "bg-rose-500" : simulationResults.risk === 'Moderate' ? "bg-amber-500" : "bg-emerald-500"
                          )}>
                            <Zap size={24} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Simulated Risk Assessment</p>
                            <p className="text-xl font-bold text-zinc-900">{simulationResults.risk} Risk</p>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <h4 className="text-sm font-bold text-zinc-900">Recommended Actions for this Scenario</h4>
                          <ul className="space-y-2">
                            {simScenario.delayedReceivables > 20 && <li className="text-sm text-zinc-600 flex items-center gap-2"><ArrowRight size={14} className="text-rose-500" /> Implement aggressive collection follow-ups.</li>}
                            {simScenario.revenueDecline > 15 && <li className="text-sm text-zinc-600 flex items-center gap-2"><ArrowRight size={14} className="text-rose-500" /> Freeze non-essential spending immediately.</li>}
                            {simulationResults.revisedNet < 0 && <li className="text-sm text-zinc-600 flex items-center gap-2"><ArrowRight size={14} className="text-rose-500" /> Secure emergency liquidity line.</li>}
                          </ul>
                        </div>
                      </div>
                    </ModuleCard>
                  </div>
                </div>
              </motion.div>
            )}

            {activeModule === 'ai-assistant' && (
              <motion.div key="ai" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full flex flex-col">
                <div className="mb-8">
                  <h2 className="text-3xl font-bold text-zinc-900">AI CFO Assistant</h2>
                  <p className="text-zinc-500 mt-1">Get data-driven financial advice and insights.</p>
                </div>

                <div className="flex-1 bg-white rounded-2xl border border-zinc-200 shadow-sm flex flex-col overflow-hidden min-h-[600px]">
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {chatMessages.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                        <MessageSquare size={48} className="text-zinc-300" />
                        <div>
                          <p className="text-lg font-bold text-zinc-900">How can I help you today?</p>
                          <p className="text-sm text-zinc-500 max-w-xs">Ask about liquidity, collections, or vendor strategies based on your data.</p>
                        </div>
                      </div>
                    )}
                    {chatMessages.map((msg, i) => (
                      <div key={i} className={cn(
                        "flex",
                        msg.role === 'user' ? "justify-end" : "justify-start"
                      )}>
                        <div className={cn(
                          "max-w-[80%] p-4 rounded-2xl",
                          msg.role === 'user' 
                            ? "bg-zinc-900 text-white rounded-tr-none" 
                            : "bg-zinc-50 text-zinc-900 border border-zinc-100 rounded-tl-none"
                        )}>
                          <div className="prose prose-sm max-w-none prose-zinc dark:prose-invert">
                            <Markdown>{msg.content}</Markdown>
                          </div>
                        </div>
                      </div>
                    ))}
                    {isTyping && (
                      <div className="flex justify-start">
                        <div className="bg-zinc-50 p-4 rounded-2xl rounded-tl-none border border-zinc-100">
                          <Loader2 className="animate-spin text-zinc-400" size={20} />
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <div className="p-4 border-t border-zinc-100 bg-zinc-50/50">
                    <div className="flex gap-3">
                      <input 
                        type="text" 
                        value={inputMessage}
                        onChange={e => setInputMessage(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Ask your AI CFO..."
                        className="flex-1 bg-white border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                      />
                      <button 
                        onClick={handleSendMessage}
                        disabled={isTyping || !inputMessage.trim()}
                        className="bg-zinc-900 text-white p-3 rounded-xl hover:bg-zinc-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-zinc-900/10"
                      >
                        <Send size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeModule === 'data-management' && (
              <motion.div key="data" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                <div>
                  <h2 className="text-3xl font-bold text-zinc-900">Data Management</h2>
                  <p className="text-zinc-500 mt-1">Upload your financial datasets for analysis.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <ModuleCard title="Bank Balance Data">
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-100 text-xs text-zinc-500 space-y-1">
                        <p className="font-bold text-zinc-700 uppercase">Required Columns:</p>
                        <p>Bank Name, Account Name, Balance, Currency, Date</p>
                      </div>
                      <label className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white py-3 rounded-xl font-semibold cursor-pointer hover:bg-zinc-800 transition-all">
                        <Upload size={18} />
                        <span>Upload Bank Data</span>
                        <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={e => handleFileUpload(e, 'bank')} />
                      </label>
                      <p className="text-center text-[10px] text-zinc-400 font-medium">Current Records: {bankBalances.length}</p>
                    </div>
                  </ModuleCard>

                  <ModuleCard title="AR Ledger">
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-100 text-xs text-zinc-500 space-y-1">
                        <p className="font-bold text-zinc-700 uppercase">Required Columns:</p>
                        <p>Customer Name, Invoice Number, Invoice Date, Due Date, Invoice Amount, Amount Outstanding, Payment Terms, Days Outstanding</p>
                      </div>
                      <label className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white py-3 rounded-xl font-semibold cursor-pointer hover:bg-zinc-800 transition-all">
                        <Upload size={18} />
                        <span>Upload AR Ledger</span>
                        <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={e => handleFileUpload(e, 'ar')} />
                      </label>
                      <p className="text-center text-[10px] text-zinc-400 font-medium">Current Records: {receivables.length}</p>
                    </div>
                  </ModuleCard>

                  <ModuleCard title="AP Ledger">
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-100 text-xs text-zinc-500 space-y-1">
                        <p className="font-bold text-zinc-700 uppercase">Required Columns:</p>
                        <p>Vendor Name, Invoice Number, Invoice Date, Due Date, Invoice Amount, Amount Outstanding, Payment Terms, Days Outstanding</p>
                      </div>
                      <label className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white py-3 rounded-xl font-semibold cursor-pointer hover:bg-zinc-800 transition-all">
                        <Upload size={18} />
                        <span>Upload AP Ledger</span>
                        <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={e => handleFileUpload(e, 'ap')} />
                      </label>
                      <p className="text-center text-[10px] text-zinc-400 font-medium">Current Records: {payables.length}</p>
                    </div>
                  </ModuleCard>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </ErrorBoundary>
  );
}
