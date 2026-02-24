import React, { useState, useEffect } from 'react';
import { Order, User } from '../types';
import { Clock, CheckCircle, Play, ChefHat } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function KitchenDashboard({ user }: { user: User }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [acknowledgedItems, setAcknowledgedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchOrders();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'ORDER_NEW') {
        fetchOrders();
      } else if (data.type === 'ORDER_STATUS_UPDATE') {
        fetchOrders();
      }
    };

    return () => ws.close();
  }, []);

  const fetchOrders = async () => {
    const res = await fetch('/api/orders/kitchen');
    const data = await res.json();
    
    // Separate active and recently completed/ready
    const active = data.filter((o: Order) => o.status === 'pending' || o.status === 'preparing');
    const ready = data.filter((o: Order) => o.status === 'ready');
    
    setOrders(active);
    setCompletedOrders(ready);
  };

  const toggleItemAck = (itemId: string) => {
    setAcknowledgedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const isOrderFullyAck = (order: Order) => {
    return order.items?.every(item => acknowledgedItems[item.id]) ?? false;
  };

  const updateStatus = async (orderId: string, status: string) => {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (res.ok) fetchOrders();
  };

  return (
    <div className="p-6 bg-zinc-50 min-h-screen">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-zinc-900 p-2 rounded-xl">
            <ChefHat className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">Kitchen Display</h1>
            <p className="text-zinc-500">Active orders queue</p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="bg-white px-4 py-2 rounded-xl border border-zinc-200 shadow-sm flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-sm font-bold text-zinc-600">{orders.length} Active</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        <div className="xl:col-span-3">
          <h2 className="text-xl font-bold mb-4 text-zinc-800 flex items-center gap-2">
            <Play className="w-5 h-5 text-blue-500" /> Incoming & Preparing
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {orders.length === 0 ? (
                <div className="col-span-full p-20 border-2 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center text-zinc-400">
                  <ChefHat className="w-12 h-12 mb-4 opacity-20" />
                  <p className="font-bold">No active orders. Kitchen is clear!</p>
                </div>
              ) : (
                orders.map((order) => (
                  <motion.div
                    key={order.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-white rounded-[2rem] shadow-xl shadow-zinc-200/50 border border-zinc-100 overflow-hidden flex flex-col"
                  >
                    <div className={`p-5 flex justify-between items-center ${
                      order.status === 'pending' ? 'bg-amber-500' : 'bg-blue-600'
                    } text-white`}>
                      <span className="text-2xl font-black">T{order.table_number}</span>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">{order.status}</span>
                        <div className="flex items-center gap-1 text-sm font-bold">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 flex-1">
                      <ul className="space-y-4">
                        {order.items?.map((item) => (
                          <li 
                            key={item.id} 
                            onClick={() => toggleItemAck(item.id)}
                            className={`flex justify-between items-start p-2 rounded-xl cursor-pointer transition-colors ${
                              acknowledgedItems[item.id] ? 'bg-emerald-50 opacity-50' : 'hover:bg-zinc-50'
                            }`}
                          >
                            <div className="flex gap-3">
                              <span className={`font-black text-xl min-w-[1.5rem] ${acknowledgedItems[item.id] ? 'text-emerald-600' : 'text-zinc-900'}`}>
                                {item.quantity}
                              </span>
                              <div>
                                <p className={`font-bold leading-tight ${acknowledgedItems[item.id] ? 'text-emerald-800 line-through' : 'text-zinc-800'}`}>
                                  {item.menu_item_name}
                                </p>
                                {item.special_instructions && (
                                  <p className="text-[10px] text-rose-500 font-bold uppercase mt-1">
                                    !! {item.special_instructions}
                                  </p>
                                )}
                              </div>
                            </div>
                            {acknowledgedItems[item.id] && <CheckCircle className="w-4 h-4 text-emerald-500 mt-1" />}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-4 bg-zinc-50 border-t flex gap-2">
                      {order.status === 'pending' ? (
                        <button
                          onClick={() => updateStatus(order.id, 'preparing')}
                          className="flex-1 py-4 bg-zinc-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-zinc-800 transition-all active:scale-95"
                        >
                          Start Prep
                        </button>
                      ) : (
                        <button
                          onClick={() => updateStatus(order.id, 'ready')}
                          disabled={!isOrderFullyAck(order)}
                          className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          Mark Ready
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="bg-zinc-100/50 rounded-[2.5rem] p-6 border border-zinc-200">
          <h2 className="text-xl font-bold mb-6 text-zinc-800 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-500" /> Ready for Pickup
          </h2>
          <div className="space-y-4">
            {completedOrders.length === 0 ? (
              <p className="text-center text-zinc-400 text-sm py-12">No orders waiting</p>
            ) : (
              completedOrders.map((order) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex justify-between items-center"
                >
                  <div>
                    <p className="font-black text-lg text-zinc-900">Table {order.table_number}</p>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase">Ready at {new Date(order.ready_at!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

