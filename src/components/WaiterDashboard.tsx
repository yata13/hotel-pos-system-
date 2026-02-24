import { useState, useEffect } from 'react';
import { Order, Table, MenuItem, User } from '../types';
import {
  UtensilsCrossed,
  ShoppingCart,
  Plus,
  Minus,
  CheckCircle,
  Clock,
  AlertCircle,
  Receipt,
  X,
  ChevronRight,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CartItem extends MenuItem {
  quantity: number;
  special_instructions?: string;
}

export default function WaiterDashboard({ user }: { user: User }) {
  const [tables, setTables] = useState<Table[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [kitchenNotes, setKitchenNotes] = useState('');
  const [activeView, setActiveView] = useState<'tables' | 'menu' | 'orders'>('tables');
  const [menuSearch, setMenuSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchTables();
    fetchMenu();
    fetchActiveOrders();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (['TABLE_UPDATE', 'PAYMENT_COMPLETE', 'ORDER_STATUS_UPDATE', 'BILL_REQUEST'].includes(data.type)) {
        fetchTables();
        fetchActiveOrders();
      }
    };

    return () => ws.close();
  }, []);

  const fetchTables = async () => {
    const res = await fetch('/api/tables');
    const data = await res.json();
    setTables(data);
  };

  const fetchMenu = async () => {
    const res = await fetch('/api/menu');
    const data = await res.json();
    // MySQL returns numbers as strings — cast price to Number
    setMenu(data.map((item: any) => ({ ...item, price: Number(item.price) })));
  };

  const fetchActiveOrders = async () => {
    const res = await fetch('/api/orders/kitchen');
    const data = await res.json();
    setActiveOrders(data);
  };

  const categories = ['All', ...Array.from(new Set(menu.map(m => m.category)))];

  const filteredMenu = menu.filter(item => {
    const matchCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchSearch = item.name.toLowerCase().includes(menuSearch.toLowerCase());
    return matchCategory && matchSearch && item.is_available;
  });

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) {
        return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { ...item, price: Number(item.price), quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === id);
      if (existing && existing.quantity > 1) {
        return prev.map(c => c.id === id ? { ...c, quantity: c.quantity - 1 } : c);
      }
      return prev.filter(c => c.id !== id);
    });
  };

  const deleteFromCart = (id: string) => {
    setCart(prev => prev.filter(c => c.id !== id));
  };

  const cartTotal = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

  const placeOrder = async () => {
    if (!selectedTable || cart.length === 0) return;
    setIsSubmitting(true);

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableId: selectedTable.id,
        waiterId: user.id,
        items: cart.map(c => ({ id: c.id, price: c.price, quantity: c.quantity })),
        kitchenNotes
      })
    });

    if (res.ok) {
      setCart([]);
      setKitchenNotes('');
      setSuccessMsg(`Order placed for Table ${selectedTable.table_number}!`);
      fetchTables();
      fetchActiveOrders();
      setActiveView('tables');
      setTimeout(() => setSuccessMsg(''), 3000);
    }
    setIsSubmitting(false);
  };

  const requestBill = async (order: Order) => {
    const res = await fetch(`/api/orders/${order.id}/bill-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId: order.table_id, waiterId: user.id })
    });
    if (res.ok) {
      fetchTables();
      setSuccessMsg(`Bill requested for Table ${order.table_number}!`);
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

  const getTableOrders = (tableId: string) =>
    activeOrders.filter(o => o.table_id === tableId && o.status !== 'paid');

  const statusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'occupied': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'billing': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-zinc-100 text-zinc-600 border-zinc-200';
    }
  };

  const orderStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-amber-500" />;
      case 'preparing': return <UtensilsCrossed className="w-4 h-4 text-blue-500" />;
      case 'ready': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      default: return <AlertCircle className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <div className="p-6 bg-zinc-50 min-h-screen">
      {/* Header */}
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-zinc-900 tracking-tight">WAITER PORTAL</h1>
          <p className="text-zinc-500 font-medium">Manage tables & place orders</p>
        </div>
        <div className="flex bg-white p-1 rounded-2xl border border-zinc-200 shadow-sm gap-1">
          {(['tables', 'menu', 'orders'] as const).map(view => (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold capitalize transition-all ${activeView === view ? 'bg-zinc-900 text-white shadow' : 'text-zinc-500 hover:bg-zinc-50'
                }`}
            >
              {view === 'menu' ? 'New Order' : view}
              {view === 'menu' && cart.length > 0 && (
                <span className="ml-2 bg-emerald-500 text-white text-[10px] font-black rounded-full px-1.5 py-0.5">
                  {cart.reduce((s, c) => s + c.quantity, 0)}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Success notification */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 px-6 py-4 rounded-2xl font-bold flex items-center gap-3"
          >
            <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            {successMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* TABLES VIEW */}
      {activeView === 'tables' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {tables.map(table => {
            const tableOrders = getTableOrders(table.id);
            const hasReadyOrder = tableOrders.some(o => o.status === 'ready');
            return (
              <motion.div
                key={table.id}
                whileHover={{ y: -4 }}
                className={`bg-white rounded-[2rem] border-2 p-6 shadow-sm cursor-pointer transition-all ${statusColor(table.status)} ${hasReadyOrder ? 'ring-4 ring-emerald-300 ring-offset-2' : ''
                  }`}
                onClick={() => {
                  setSelectedTable(table);
                  setActiveView('menu');
                }}
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="text-3xl font-black text-zinc-900">T{table.table_number}</span>
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border ${statusColor(table.status)}`}>
                    {table.status}
                  </span>
                </div>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-zinc-400 uppercase tracking-widest">Capacity</span>
                    <span className="text-zinc-700">{table.capacity} guests</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-zinc-400 uppercase tracking-widest">Section</span>
                    <span className="text-zinc-700">{table.section || 'Main'}</span>
                  </div>
                </div>

                {tableOrders.length > 0 && (
                  <div className="space-y-2 border-t border-zinc-100 pt-4">
                    {tableOrders.map(order => (
                      <div key={order.id} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          {orderStatusIcon(order.status)}
                          <span className="font-bold text-zinc-700 capitalize">{order.status}</span>
                        </div>
                        {order.status === 'ready' && (
                          <button
                            onClick={e => { e.stopPropagation(); requestBill(order); }}
                            className="text-[10px] font-black uppercase tracking-widest bg-zinc-900 text-white px-2 py-1 rounded-lg hover:bg-zinc-700 flex items-center gap-1"
                          >
                            <Receipt className="w-3 h-3" /> Bill
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-end mt-4 text-zinc-400 text-xs font-bold">
                  <span>Select to order</span>
                  <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* MENU / NEW ORDER VIEW */}
      {activeView === 'menu' && (
        <div className="flex gap-6">
          {/* Menu Panel */}
          <div className="flex-1 space-y-6">
            {/* Table Selector */}
            <div className="bg-white rounded-[2rem] border border-zinc-200 p-5 flex items-center gap-4 flex-wrap shadow-sm">
              <span className="text-sm font-black text-zinc-500 uppercase tracking-widest">Order For:</span>
              <div className="flex gap-2 flex-wrap">
                {tables.filter(t => t.status !== 'billing').map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTable(t)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${selectedTable?.id === t.id
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
                      }`}
                  >
                    T{t.table_number}
                  </button>
                ))}
              </div>
              {selectedTable && (
                <span className="ml-auto text-sm font-bold text-emerald-600">
                  ✓ Table {selectedTable.table_number} selected
                </span>
              )}
            </div>

            {/* Search & Filter */}
            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search menu..."
                  value={menuSearch}
                  onChange={e => setMenuSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-zinc-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 ring-zinc-900/5"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2.5 rounded-2xl text-sm font-bold transition-all ${selectedCategory === cat
                      ? 'bg-zinc-900 text-white'
                      : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                      }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Menu Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMenu.map(item => {
                const inCart = cart.find(c => c.id === item.id);
                return (
                  <motion.div
                    key={item.id}
                    whileHover={{ y: -3 }}
                    className="bg-white rounded-[2rem] border border-zinc-200 overflow-hidden shadow-sm flex flex-col"
                  >
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-full h-36 object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="h-36 bg-zinc-100 flex items-center justify-center text-zinc-300 text-5xl">🍽</div>
                    )}
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-black text-zinc-900 leading-tight">{item.name}</h4>
                        <span className="font-black text-emerald-600 ml-2 flex-shrink-0">${Number(item.price).toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-zinc-500 mb-4 line-clamp-2 flex-1">{item.description}</p>
                      {inCart ? (
                        <div className="flex items-center justify-between bg-zinc-50 rounded-2xl p-1">
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="w-9 h-9 bg-white border border-zinc-200 rounded-xl flex items-center justify-center hover:bg-zinc-100 transition"
                          >
                            <Minus className="w-4 h-4 text-zinc-700" />
                          </button>
                          <span className="font-black text-zinc-900">{inCart.quantity}</span>
                          <button
                            onClick={() => addToCart(item)}
                            className="w-9 h-9 bg-zinc-900 rounded-xl flex items-center justify-center hover:bg-zinc-800 transition"
                          >
                            <Plus className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(item)}
                          className="w-full py-2.5 bg-zinc-900 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-zinc-800 transition"
                        >
                          <Plus className="w-4 h-4" /> Add
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
              {filteredMenu.length === 0 && (
                <div className="col-span-full text-center py-20 text-zinc-400 font-bold">
                  No menu items found.
                </div>
              )}
            </div>
          </div>

          {/* Cart Sidebar */}
          <div className="w-80 flex-shrink-0">
            <div className="bg-white rounded-[2rem] border border-zinc-200 shadow-sm sticky top-6 flex flex-col overflow-hidden">
              <div className="p-6 border-b border-zinc-100 bg-zinc-900 text-white">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" /> Cart
                  </h2>
                  {cart.length > 0 && (
                    <button onClick={() => setCart([])} className="text-zinc-500 hover:text-white text-xs font-bold">
                      Clear
                    </button>
                  )}
                </div>
                {selectedTable ? (
                  <p className="text-zinc-400 text-xs font-bold mt-1 uppercase tracking-widest">Table {selectedTable.table_number}</p>
                ) : (
                  <p className="text-rose-400 text-xs font-bold mt-1">⚠ Select a table above</p>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[400px]">
                {cart.length === 0 ? (
                  <p className="text-center text-zinc-400 text-sm py-10 font-bold">Cart is empty</p>
                ) : (
                  cart.map(item => (
                    <div key={item.id} className="flex items-start gap-3 bg-zinc-50 p-3 rounded-2xl">
                      <div className="flex-1">
                        <p className="font-bold text-zinc-900 text-sm">{item.name}</p>
                        <p className="text-xs text-zinc-500">${Number(item.price).toFixed(2)} × {item.quantity}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => removeFromCart(item.id)} className="w-7 h-7 bg-white border border-zinc-200 rounded-lg flex items-center justify-center hover:bg-zinc-100">
                          <Minus className="w-3 h-3 text-zinc-600" />
                        </button>
                        <span className="w-5 text-center text-xs font-black">{item.quantity}</span>
                        <button onClick={() => addToCart(item)} className="w-7 h-7 bg-zinc-900 rounded-lg flex items-center justify-center hover:bg-zinc-800">
                          <Plus className="w-3 h-3 text-white" />
                        </button>
                        <button onClick={() => deleteFromCart(item.id)} className="w-7 h-7 text-rose-400 hover:text-rose-600 flex items-center justify-center ml-1">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-5 border-t border-zinc-100 space-y-4">
                  <textarea
                    placeholder="Kitchen notes (optional)..."
                    value={kitchenNotes}
                    onChange={e => setKitchenNotes(e.target.value)}
                    className="w-full text-sm p-3 bg-zinc-50 border border-zinc-200 rounded-2xl resize-none h-16 focus:outline-none focus:ring-2 ring-zinc-900/5 font-medium"
                  />
                  <div className="flex justify-between text-sm font-bold text-zinc-700">
                    <span>Subtotal</span>
                    <span>${cartTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-zinc-400">
                    <span>+ Tax & Service (25%)</span>
                    <span>${(cartTotal * 0.25).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-black text-zinc-900 pt-1 border-t border-zinc-100">
                    <span>Total</span>
                    <span>${(cartTotal * 1.25).toFixed(2)}</span>
                  </div>
                  <button
                    onClick={placeOrder}
                    disabled={!selectedTable || isSubmitting}
                    className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-black text-sm hover:bg-zinc-800 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Placing Order...' : 'Place Order →'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE ORDERS VIEW */}
      {activeView === 'orders' && (
        <div className="space-y-4">
          <h2 className="text-2xl font-black text-zinc-900 mb-6">Active Orders</h2>
          {activeOrders.length === 0 ? (
            <div className="bg-white rounded-[2rem] border border-zinc-200 p-20 text-center text-zinc-400">
              <UtensilsCrossed className="w-10 h-10 mx-auto mb-4 opacity-30" />
              <p className="font-bold">No active orders right now.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeOrders.map(order => (
                <motion.div
                  key={order.id}
                  whileHover={{ y: -3 }}
                  className="bg-white rounded-[2rem] border border-zinc-200 shadow-sm overflow-hidden"
                >
                  <div className={`p-5 flex justify-between items-center ${order.status === 'ready' ? 'bg-emerald-600' :
                    order.status === 'preparing' ? 'bg-blue-600' : 'bg-amber-500'
                    } text-white`}>
                    <span className="text-2xl font-black">T{order.table_number}</span>
                    <div className="flex items-center gap-2 text-sm font-bold">
                      {orderStatusIcon(order.status)}
                      <span className="capitalize">{order.status}</span>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="space-y-2 mb-4">
                      {order.items?.map((item: any) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="font-bold text-zinc-800">{item.quantity}× {item.menu_item_name}</span>
                          <span className="text-zinc-500">${(Number(item.unit_price) * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="border-t pt-3 flex justify-between font-black text-zinc-900">
                      <span>Total</span>
                      <span>${Number(order.total)?.toFixed(2)}</span>
                    </div>
                    {order.status === 'ready' && (
                      <button
                        onClick={() => requestBill(order)}
                        className="mt-4 w-full py-3 bg-zinc-900 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-zinc-800 transition"
                      >
                        <Receipt className="w-4 h-4" /> Request Bill
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
