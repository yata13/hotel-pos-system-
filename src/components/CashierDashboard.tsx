import React, { useState, useEffect } from 'react';
import { BillRequest, User } from '../types';
import { CreditCard, Banknote, Receipt, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CashierDashboard({ user }: { user: User }) {
  const [bills, setBills] = useState<BillRequest[]>([]);
  const [selectedBill, setSelectedBill] = useState<BillRequest | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recentReceipts, setRecentReceipts] = useState<any[]>([]);

  useEffect(() => {
    fetchBills();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'BILL_REQUEST') {
        fetchBills();
      }
    };

    return () => ws.close();
  }, []);

  const fetchBills = async () => {
    const res = await fetch('/api/cashier/bills');
    const data = await res.json();
    // MySQL returns numbers as strings — normalize them
    setBills(data.map((bill: any) => ({
      ...bill,
      total: Number(bill.total),
      subtotal: Number(bill.subtotal),
      tax: Number(bill.tax),
      service_charge: Number(bill.service_charge),
      items: (bill.items || []).map((item: any) => ({
        ...item,
        unit_price: Number(item.unit_price),
        quantity: Number(item.quantity),
      }))
    })));
  };

  const processPayment = async (method: string) => {
    if (!selectedBill) return;
    setIsProcessing(true);

    const res = await fetch('/api/cashier/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: selectedBill.order_id,
        tableId: selectedBill.table_id,
        paymentMethod: method,
        cashierId: 'cashier-1',
        total: selectedBill.total
      })
    });

    if (res.ok) {
      const data = await res.json();
      setRecentReceipts(prev => [{
        number: data.receiptNumber,
        table: selectedBill.table_number,
        total: selectedBill.total,
        method
      }, ...prev].slice(0, 5));
      setSelectedBill(null);
      fetchBills();
    }
    setIsProcessing(false);
  };

  return (
    <div className="p-6 bg-zinc-50 min-h-screen flex gap-8">
      <div className="flex-1">
        <header className="mb-8">
          <h1 className="text-4xl font-black text-zinc-900 tracking-tight">CASHIER DESK</h1>
          <p className="text-zinc-500 font-medium">Process payments and close tables</p>
        </header>

        <div className="space-y-8">
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-zinc-800">
              <Receipt className="w-5 h-5 text-zinc-400" /> Pending Requests
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatePresence mode="popLayout">
                {bills.length === 0 ? (
                  <div className="col-span-full p-12 border-2 border-dashed rounded-[2rem] text-center text-zinc-400">
                    <p className="font-bold">No pending bill requests</p>
                  </div>
                ) : (
                  bills.map((bill) => (
                    <motion.div
                      key={bill.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      onClick={() => setSelectedBill(bill)}
                      className={`p-6 rounded-[2rem] border-2 cursor-pointer transition-all ${selectedBill?.id === bill.id ? 'bg-white border-zinc-900 shadow-2xl ring-4 ring-zinc-900/5' : 'bg-white border-transparent shadow-sm hover:shadow-md'
                        }`}
                    >
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-2xl font-black text-zinc-900">Table {bill.table_number}</span>
                        <span className="text-xl font-black text-zinc-900">${Number(bill.total).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-zinc-400">
                        <span>{bill.items.length} items</span>
                        <span>{new Date(bill.requested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-zinc-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" /> Recent Activity
            </h2>
            <div className="bg-white rounded-[2rem] border border-zinc-200 overflow-hidden shadow-sm">
              {recentReceipts.length === 0 ? (
                <p className="p-8 text-center text-zinc-400 text-sm italic">No recent payments processed</p>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-zinc-50 border-b border-zinc-200">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Receipt #</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Table</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Amount</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Method</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {recentReceipts.map((r, i) => (
                      <tr key={i} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs font-bold text-zinc-600">{r.number}</td>
                        <td className="px-6 py-4 font-bold text-zinc-900">T{r.table}</td>
                        <td className="px-6 py-4 font-black text-zinc-900">${r.total.toFixed(2)}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-tighter ${r.method === 'cash' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                            {r.method}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      </div>

      <div className="w-[28rem] bg-white rounded-[2.5rem] shadow-2xl border border-zinc-200 flex flex-col overflow-hidden sticky top-6 h-[calc(100vh-3rem)]">
        {selectedBill ? (
          <>
            <div className="p-8 border-b bg-zinc-900 text-white">
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-2xl font-black tracking-tight">BILL SUMMARY</h2>
                <button onClick={() => setSelectedBill(null)} className="text-zinc-500 hover:text-white transition-colors">
                  Close
                </button>
              </div>
              <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">Table {selectedBill.table_number} • Order #{selectedBill.order_id.slice(0, 8)}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              <div className="space-y-4">
                {selectedBill.items.map((item) => (
                  <div key={item.id} className="flex justify-between items-start">
                    <div className="flex-1 pr-4">
                      <p className="font-bold text-zinc-900 leading-tight">{item.menu_item_name}</p>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase">{item.quantity} x ${Number(item.unit_price).toFixed(2)}</p>
                    </div>
                    <p className="font-black text-zinc-900">${(Number(item.quantity) * Number(item.unit_price)).toFixed(2)}</p>
                  </div>
                ))}
              </div>

              <div className="pt-6 border-t border-zinc-100 space-y-3">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-zinc-400 uppercase tracking-widest">Subtotal</span>
                  <span className="text-zinc-900">${Number(selectedBill.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-zinc-400 uppercase tracking-widest">Tax (15%)</span>
                  <span className="text-zinc-900">${Number(selectedBill.tax).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-zinc-400 uppercase tracking-widest">Service (10%)</span>
                  <span className="text-zinc-900">${Number(selectedBill.service_charge).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-3xl font-black pt-4 border-t-2 border-zinc-900 text-zinc-900">
                  <span>TOTAL</span>
                  <span>${Number(selectedBill.total).toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="p-8 bg-zinc-50 border-t border-zinc-200 space-y-4">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] text-center mb-2">Finalize Payment</p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => processPayment('cash')}
                  disabled={isProcessing}
                  className="p-6 bg-white border-2 border-zinc-200 rounded-[2rem] flex flex-col items-center gap-3 hover:border-emerald-500 hover:bg-emerald-50 transition-all active:scale-95 disabled:opacity-50 group shadow-sm"
                >
                  <Banknote className="w-8 h-8 text-emerald-600 group-hover:scale-110 transition-transform" />
                  <span className="font-black text-xs uppercase tracking-widest text-zinc-900">Cash</span>
                </button>
                <button
                  onClick={() => processPayment('card')}
                  disabled={isProcessing}
                  className="p-6 bg-white border-2 border-zinc-200 rounded-[2rem] flex flex-col items-center gap-3 hover:border-blue-500 hover:bg-blue-50 transition-all active:scale-95 disabled:opacity-50 group shadow-sm"
                >
                  <CreditCard className="w-8 h-8 text-blue-600 group-hover:scale-110 transition-transform" />
                  <span className="font-black text-xs uppercase tracking-widest text-zinc-900">Card</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-zinc-400">
            <div className="w-24 h-24 bg-zinc-50 rounded-full flex items-center justify-center mb-6">
              <Receipt className="w-10 h-10 opacity-20" />
            </div>
            <p className="font-bold text-zinc-400 uppercase tracking-widest text-sm">Select a bill request<br />to process payment</p>
          </div>
        )}
      </div>
    </div>
  );
}

