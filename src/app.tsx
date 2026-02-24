/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import WaiterDashboard from './components/WaiterDashboard';
import KitchenDashboard from './components/KitchenDashboard';
import CashierDashboard from './components/CashierDashboard';
import ManagerDashboard from './components/ManagerDashboard';
import { UserRole, User } from './types';
import { UtensilsCrossed, ChefHat, Receipt, LogOut, BellRing, ShieldCheck, Moon, Sun, User as UserIcon, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function App() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'info' | 'success' | 'warning' }[]>([]);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      let message = '';
      let type: 'info' | 'success' | 'warning' = 'info';

      if (data.type === 'ORDER_NEW' && role === 'chef') {
        message = `New Order for Table ${data.order.table_number}!`;
        type = 'warning';
      } else if (data.type === 'ORDER_STATUS_UPDATE' && data.status === 'ready' && role === 'waiter') {
        message = `Order for a table is ready!`;
        type = 'success';
      } else if (data.type === 'BILL_REQUEST' && role === 'cashier') {
        message = `New Bill Request for Table ${data.bill.table_number}!`;
        type = 'info';
      } else if (data.type === 'PAYMENT_COMPLETE' && role === 'waiter') {
        message = `Payment completed for Table ${data.tableId}. Table is now available.`;
        type = 'success';
      }

      if (message) {
        const id = crypto.randomUUID();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
      }
    };

    return () => ws.close();
  }, [role]);

  useEffect(() => {
    if (role && !user) {
      setLoadingUsers(true);
      fetch(`/api/users/${role}`)
        .then(res => res.json())
        .then(data => {
          setUsers(data);
          setLoadingUsers(false);
          // Auto-select if only one user
          if (data.length === 1) {
            setUser(data[0]);
          }
        });
    }
  }, [role, user]);

  if (!role) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6 transition-colors duration-300">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12 relative">
            <button 
              onClick={() => setIsDark(!isDark)}
              className="absolute -top-12 right-0 p-3 rounded-2xl bg-white dark:bg-zinc-800 shadow-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:scale-110 transition-all"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <h1 className="text-5xl font-black text-zinc-900 dark:text-white mb-4 tracking-tight">RESTAURANT FLOW</h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-lg">Select your role to enter the dashboard</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <RoleCard 
              title="Waiter" 
              icon={<UtensilsCrossed className="w-12 h-12" />} 
              description="Manage tables, take orders, and request bills."
              color="bg-emerald-500"
              onClick={() => setRole('waiter')}
            />
            <RoleCard 
              title="Kitchen" 
              icon={<ChefHat className="w-12 h-12" />} 
              description="Receive orders, manage prep, and mark as ready."
              color="bg-amber-500"
              onClick={() => setRole('chef')}
            />
            <RoleCard 
              title="Cashier" 
              icon={<Receipt className="w-12 h-12" />} 
              description="Process payments and generate receipts."
              color="bg-blue-500"
              onClick={() => setRole('cashier')}
            />
            <RoleCard 
              title="Manager" 
              icon={<ShieldCheck className="w-12 h-12" />} 
              description="View reports, analytics, and overall operations."
              color="bg-purple-500"
              onClick={() => setRole('manager')}
            />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6 transition-colors duration-300">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-12 relative">
            <button 
              onClick={() => setRole(null)}
              className="absolute -top-12 left-0 p-3 rounded-2xl bg-white dark:bg-zinc-800 shadow-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:scale-110 transition-all flex items-center gap-2 text-sm font-bold"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <h1 className="text-4xl font-black text-zinc-900 dark:text-white mb-2 tracking-tight uppercase">Select Your Profile</h1>
            <p className="text-zinc-500 dark:text-zinc-400">Identify yourself to access the {role} portal</p>
          </div>

          {loadingUsers ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-zinc-900 dark:border-white border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-zinc-500 font-bold">Loading profiles...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {users.map((u) => (
                <motion.button
                  key={u.id}
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setUser(u)}
                  className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 flex items-center gap-4 hover:border-zinc-900 dark:hover:border-white transition-all text-left"
                >
                  <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                    <UserIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-black text-zinc-900 dark:text-white">{u.username}</p>
                    <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">{u.role}</p>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 transition-colors duration-300">
      <nav className="bg-zinc-900 text-white px-6 py-3 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${
            role === 'waiter' ? 'bg-emerald-500' :
            role === 'chef' ? 'bg-amber-500' :
            role === 'manager' ? 'bg-purple-500' :
            'bg-blue-500'
          }`} />
          <span className="font-bold uppercase tracking-widest text-sm">
            {user.username} ({role})
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsDark(!isDark)}
            className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            title="Toggle Dark Mode"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button 
            onClick={() => {
              setRole(null);
              setUser(null);
            }}
            className="flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </nav>
      
      <main>
        {role === 'waiter' && <WaiterDashboard user={user} />}
        {role === 'chef' && <KitchenDashboard user={user} />}
        {role === 'cashier' && <CashierDashboard user={user} />}
        {role === 'manager' && <ManagerDashboard user={user} />}
      </main>

      {/* Global Toasts */}
      <div className="fixed bottom-6 right-6 z-50 space-y-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`pointer-events-auto p-4 rounded-2xl shadow-2xl border flex items-center gap-3 min-w-[300px] ${
                toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                toast.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                'bg-blue-50 border-blue-200 text-blue-800'
              }`}
            >
              <div className={`p-2 rounded-xl ${
                toast.type === 'success' ? 'bg-emerald-500 text-white' :
                toast.type === 'warning' ? 'bg-amber-500 text-white' :
                'bg-blue-500 text-white'
              }`}>
                <BellRing className="w-4 h-4" />
              </div>
              <p className="font-bold text-sm">{toast.message}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function RoleCard({ title, icon, description, color, onClick }: any) {
  return (
    <motion.div
      whileHover={{ y: -8 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-xl shadow-zinc-200/50 dark:shadow-none border border-zinc-100 dark:border-zinc-800 cursor-pointer flex flex-col items-center text-center group"
    >
      <div className={`${color} p-6 rounded-3xl text-white mb-6 group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-3">{title}</h2>
      <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">{description}</p>
    </motion.div>
  );
}
