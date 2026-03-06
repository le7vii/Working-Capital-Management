import React, { useState, useEffect, useMemo } from 'react';
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
  orderBy
} from 'firebase/firestore';
import { 
  format, 
  addWeeks, 
  startOfWeek, 
  endOfWeek, 
  isWithinInterval, 
  parseISO,
  startOfDay,
  addDays
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
  LineChart,
  Line,
  ReferenceLine
} from 'recharts';
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  LogOut, 
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Calendar as CalendarIcon,
  ChevronRight,
  ChevronLeft,
  Search,
  MoreVertical,
  Trash2,
  Edit2
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { Transaction, TransactionType, TransactionStatus } from './types';
import { ErrorBoundary } from './components/ErrorBoundary';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const StatCard = ({ title, amount, type, icon: Icon }: { title: string, amount: number, type: 'positive' | 'negative' | 'neutral', icon: any }) => (
  <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
    <div className="flex items-center justify-between mb-4">
      <div className={cn(
        "p-2 rounded-xl",
        type === 'positive' ? "bg-emerald-50 text-emerald-600" : 
        type === 'negative' ? "bg-rose-50 text-rose-600" : 
        "bg-zinc-50 text-zinc-600"
      )}>
        <Icon size={20} />
      </div>
      <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{title}</span>
    </div>
    <div className="flex flex-col">
      <span className="text-2xl font-bold text-zinc-900">
        ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      <div className="flex items-center mt-1">
        {type === 'positive' ? <ArrowUpRight size={14} className="text-emerald-500 mr-1" /> : 
         type === 'negative' ? <ArrowDownRight size={14} className="text-rose-500 mr-1" /> : null}
        <span className={cn(
          "text-xs font-medium",
          type === 'positive' ? "text-emerald-500" : 
          type === 'negative' ? "text-rose-500" : 
          "text-zinc-400"
        )}>
          {type === 'positive' ? 'Receivables' : type === 'negative' ? 'Payables' : 'Net Position'}
        </span>
      </div>
    </div>
  </div>
);

const TransactionModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  initialData, 
  userId 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onSubmit: (data: Partial<Transaction>) => void,
  initialData?: Transaction | null,
  userId: string
}) => {
  const [formData, setFormData] = useState<Partial<Transaction>>({
    type: 'receivable',
    amount: 0,
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    status: 'pending',
    description: '',
    counterparty: '',
    category: '',
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        type: 'receivable',
        amount: 0,
        dueDate: format(new Date(), 'yyyy-MM-dd'),
        status: 'pending',
        description: '',
        counterparty: '',
        category: '',
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-bottom border-zinc-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-900">
            {initialData ? 'Edit Transaction' : 'New Transaction'}
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <Plus className="rotate-45" size={24} />
          </button>
        </div>
        <form className="p-6 space-y-4" onSubmit={(e) => {
          e.preventDefault();
          onSubmit(formData);
        }}>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Type</label>
              <select 
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as TransactionType })}
              >
                <option value="receivable">Receivable (In)</option>
                <option value="payable">Payable (Out)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Amount</label>
              <input 
                type="number" 
                step="0.01"
                required
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Due Date</label>
              <input 
                type="date" 
                required
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</label>
              <select 
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as TransactionStatus })}
              >
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Counterparty</label>
            <input 
              type="text" 
              placeholder="Client or Vendor name"
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all"
              value={formData.counterparty}
              onChange={(e) => setFormData({ ...formData, counterparty: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Description</label>
            <textarea 
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all min-h-[80px]"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 bg-zinc-100 text-zinc-600 py-3 rounded-xl font-medium hover:bg-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-1 bg-zinc-900 text-white py-3 rounded-xl font-medium hover:bg-zinc-800 transition-colors"
            >
              {initialData ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      orderBy('dueDate', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];
      setTransactions(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    return unsubscribe;
  }, [user]);

  const stats = useMemo(() => {
    const receivables = transactions
      .filter(t => t.type === 'receivable' && t.status !== 'paid')
      .reduce((acc, t) => acc + t.amount, 0);
    const payables = transactions
      .filter(t => t.type === 'payable' && t.status !== 'paid')
      .reduce((acc, t) => acc + t.amount, 0);
    return { receivables, payables, net: receivables - payables };
  }, [transactions]);

  const forecastData = useMemo(() => {
    const weeks = 8;
    const data = [];
    const today = startOfDay(new Date());

    for (let i = 0; i < weeks; i++) {
      const weekStart = startOfWeek(addWeeks(today, i), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      
      const weekReceivables = transactions
        .filter(t => t.type === 'receivable' && t.status !== 'paid' && isWithinInterval(parseISO(t.dueDate), { start: weekStart, end: weekEnd }))
        .reduce((acc, t) => acc + t.amount, 0);
      
      const weekPayables = transactions
        .filter(t => t.type === 'payable' && t.status !== 'paid' && isWithinInterval(parseISO(t.dueDate), { start: weekStart, end: weekEnd }))
        .reduce((acc, t) => acc + t.amount, 0);

      data.push({
        name: format(weekStart, 'MMM dd'),
        receivables: weekReceivables,
        payables: weekPayables,
        balance: weekReceivables - weekPayables,
        gap: Math.min(0, weekReceivables - weekPayables)
      });
    }
    return data;
  }, [transactions]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleAddTransaction = async (data: Partial<Transaction>) => {
    if (!user) return;
    try {
      const newDoc = {
        ...data,
        userId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await addDoc(collection(db, 'transactions'), newDoc);
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'transactions');
    }
  };

  const handleUpdateTransaction = async (data: Partial<Transaction>) => {
    if (!user || !editingTransaction?.id) return;
    try {
      const docRef = doc(db, 'transactions', editingTransaction.id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: new Date().toISOString(),
      });
      setIsModalOpen(false);
      setEditingTransaction(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `transactions/${editingTransaction.id}`);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!user) return;
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    try {
      await deleteDoc(doc(db, 'transactions', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `transactions/${id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 bg-zinc-200 rounded-full mb-4"></div>
          <div className="h-4 w-32 bg-zinc-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl rotate-3">
            <Wallet className="text-white" size={40} />
          </div>
          <h1 className="text-4xl font-bold text-zinc-900 mb-4 tracking-tight">CapitalFlow</h1>
          <p className="text-zinc-500 mb-10 text-lg leading-relaxed">
            Master your company's cash flow. Track payables, receivables, and predict working capital gaps with precision.
          </p>
          <button 
            onClick={handleLogin}
            className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-semibold text-lg hover:bg-zinc-800 transition-all shadow-lg hover:shadow-zinc-900/20 active:scale-[0.98]"
          >
            Sign in with Google
          </button>
          <p className="mt-6 text-xs text-zinc-400 uppercase tracking-widest font-bold">Secure Enterprise Grade Tracking</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans">
        {/* Navigation */}
        <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-zinc-200 px-4 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center shadow-lg">
              <Wallet className="text-white" size={20} />
            </div>
            <span className="text-xl font-bold tracking-tight">CapitalFlow</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-semibold">{user.displayName}</span>
              <span className="text-xs text-zinc-400">{user.email}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2.5 rounded-xl hover:bg-zinc-100 text-zinc-500 transition-colors"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto p-4 sm:p-8 space-y-8">
          {/* Header & Quick Actions */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900">Financial Overview</h2>
              <p className="text-zinc-500 mt-1">Real-time status of your working capital.</p>
            </div>
            <button 
              onClick={() => {
                setEditingTransaction(null);
                setIsModalOpen(true);
              }}
              className="bg-zinc-900 text-white px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all shadow-lg hover:shadow-zinc-900/20 active:scale-[0.98]"
            >
              <Plus size={20} />
              <span>New Transaction</span>
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard title="Total Receivables" amount={stats.receivables} type="positive" icon={TrendingUp} />
            <StatCard title="Total Payables" amount={stats.payables} type="negative" icon={TrendingDown} />
            <StatCard title="Net Cash Position" amount={stats.net} type="neutral" icon={Wallet} />
          </div>

          {/* Forecast Chart */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-zinc-200 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">8-Week Cash Flow Forecast</h3>
                <p className="text-sm text-zinc-500">Predicting working capital gaps based on due dates.</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  <span className="text-xs font-medium text-zinc-500">In</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                  <span className="text-xs font-medium text-zinc-500">Out</span>
                </div>
              </div>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={forecastData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#a1a1aa', fontSize: 12 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#a1a1aa', fontSize: 12 }}
                    tickFormatter={(value) => `$${value >= 1000 ? (value/1000).toFixed(0) + 'k' : value}`}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="receivables" fill="#10b981" radius={[4, 4, 0, 0]} barSize={24} />
                  <Bar dataKey="payables" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={24} />
                  <ReferenceLine y={0} stroke="#e4e4e7" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            {/* Gap Alerts */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {forecastData.filter(d => d.balance < 0).map((gap, idx) => (
                <div key={idx} className="flex items-start gap-3 p-4 rounded-xl bg-rose-50 border border-rose-100">
                  <AlertCircle className="text-rose-500 shrink-0" size={18} />
                  <div>
                    <p className="text-sm font-bold text-rose-900">Gap: {gap.name}</p>
                    <p className="text-xs text-rose-700">Shortfall of ${Math.abs(gap.balance).toLocaleString()}</p>
                  </div>
                </div>
              ))}
              {forecastData.filter(d => d.balance < 0).length === 0 && (
                <div className="col-span-full flex items-center justify-center p-4 rounded-xl bg-emerald-50 border border-emerald-100 gap-3">
                  <CheckCircle2 className="text-emerald-500" size={18} />
                  <p className="text-sm font-medium text-emerald-900">No working capital gaps identified in the next 8 weeks.</p>
                </div>
              )}
            </div>
          </div>

          {/* Transaction List */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <h3 className="text-lg font-bold text-zinc-900">Recent Transactions</h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search..." 
                    className="pl-9 pr-4 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/5 w-48 sm:w-64"
                  />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50/50">
                    <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Counterparty</th>
                    <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Due Date</th>
                    <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">Amount</th>
                    <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-zinc-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                          t.status === 'paid' ? "bg-emerald-50 text-emerald-600" : 
                          t.status === 'overdue' ? "bg-rose-50 text-rose-600" : 
                          "bg-amber-50 text-amber-600"
                        )}>
                          {t.status === 'paid' ? <CheckCircle2 size={12} /> : 
                           t.status === 'overdue' ? <AlertCircle size={12} /> : 
                           <Clock size={12} />}
                          {t.status}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-zinc-900">{t.counterparty || 'N/A'}</span>
                          <span className="text-xs text-zinc-400 truncate max-w-[200px]">{t.description}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-zinc-600">
                          <CalendarIcon size={14} className="text-zinc-400" />
                          {format(parseISO(t.dueDate), 'MMM dd, yyyy')}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={cn(
                          "text-sm font-bold",
                          t.type === 'receivable' ? "text-emerald-600" : "text-rose-600"
                        )}>
                          {t.type === 'receivable' ? '+' : '-'}${t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => {
                              setEditingTransaction(t);
                              setIsModalOpen(true);
                            }}
                            className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => t.id && handleDeleteTransaction(t.id)}
                            className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-zinc-400 italic">
                        No transactions found. Start by adding your first payable or receivable.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        <TransactionModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          onSubmit={editingTransaction ? handleUpdateTransaction : handleAddTransaction}
          initialData={editingTransaction}
          userId={user.uid}
        />
      </div>
    </ErrorBoundary>
  );
}
