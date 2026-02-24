import React, { useState, useEffect } from 'react';
import { Order, Table, MenuItem, User } from '../types';
import {
  TrendingUp,
  Users,
  Utensils,
  DollarSign,
  Clock,
  Search,
  BarChart3,
  LayoutDashboard,
  ClipboardList,
  UserPlus,
  Trash2,
  Shield,
  Edit,
  PlusCircle,
  Image as ImageIcon,
  Calendar
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

export default function ManagerDashboard({ user }: { user: User }) {
  const [stats, setStats] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [dailyReport, setDailyReport] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'tables' | 'users' | 'menu' | 'financials' | 'daily'>('overview');
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isAddingMenuItem, setIsAddingMenuItem] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);
  const [newUser, setNewUser] = useState({ username: '', role: 'waiter' as any, salary: 0 });
  const [newMenuItem, setNewMenuItem] = useState({
    name: '',
    description: '',
    price: 0,
    category: 'Main',
    image_url: '',
    is_available: true
  });

  useEffect(() => {
    fetchStats();
    fetchOrders();
    fetchTables();
    fetchUsers();
    fetchMenu();
    fetchDailyReport();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (['ORDER_NEW', 'ORDER_STATUS_UPDATE', 'PAYMENT_COMPLETE', 'TABLE_UPDATE'].includes(data.type)) {
        fetchStats();
        fetchOrders();
        fetchTables();
        fetchDailyReport();
      }
    };

    return () => ws.close();
  }, []);

  const fetchStats = async () => {
    const res = await fetch('/api/manager/stats');
    const raw = await res.json();
    // MySQL returns numbers as strings — normalize everything
    setStats({
      ...raw,
      totalRevenue: Number(raw.totalRevenue ?? 0),
      totalSalaries: Number(raw.totalSalaries ?? 0),
      netProfit: Number(raw.netProfit ?? 0),
      avgOrderValue: Number(raw.avgOrderValue ?? 0),
      revenueByCategory: (raw.revenueByCategory || []).map((c: any) => ({
        ...c,
        revenue: Number(c.revenue ?? 0)
      })),
      topItems: (raw.topItems || []).map((i: any) => ({
        ...i,
        quantity: Number(i.quantity ?? 0),
        revenue: Number(i.revenue ?? 0)
      }))
    });
  };

  const fetchOrders = async () => {
    const res = await fetch('/api/manager/orders');
    const data = await res.json();
    setOrders(data.map((o: any) => ({ ...o, total: Number(o.total ?? 0) })));
  };

  const fetchTables = async () => {
    const res = await fetch('/api/tables');
    const data = await res.json();
    setTables(data);
  };

  const fetchUsers = async () => {
    const res = await fetch('/api/users');
    const data = await res.json();
    setUsers(data);
  };

  const fetchMenu = async () => {
    const res = await fetch('/api/menu');
    const data = await res.json();
    setMenu(data.map((item: any) => ({
      ...item,
      price: Number(item.price ?? 0),
      is_available: Boolean(item.is_available)
    })));
  };

  const fetchDailyReport = async (date?: string) => {
    const d = date || selectedDate;
    const res = await fetch(`/api/manager/daily-report?date=${d}`);
    const raw = await res.json();
    setDailyReport({
      ...raw,
      totalRevenue: Number(raw.totalRevenue ?? 0),
      totalOrders: Number(raw.totalOrders ?? 0),
      hourlyRevenue: (raw.hourlyRevenue || []).map((h: any) => ({
        ...h,
        revenue: Number(h.revenue ?? 0)
      }))
    });
  };

  useEffect(() => {
    fetchDailyReport();
  }, [selectedDate]);

  const handleAddMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMenuItem)
    });
    if (res.ok) {
      fetchMenu();
      setIsAddingMenuItem(false);
      setNewMenuItem({ name: '', description: '', price: 0, category: 'Main', image_url: '', is_available: true });
    }
  };

  const handleUpdateMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMenuItem) return;
    const res = await fetch(`/api/menu/${editingMenuItem.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingMenuItem)
    });
    if (res.ok) {
      fetchMenu();
      setEditingMenuItem(null);
    }
  };

  const handleDeleteMenuItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this menu item?')) return;
    const res = await fetch(`/api/menu/${id}`, { method: 'DELETE' });
    if (res.ok) fetchMenu();
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser)
    });
    if (res.ok) {
      fetchUsers();
      setIsAddingUser(false);
      setNewUser({ username: '', role: 'waiter', salary: 0 });
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    if (res.ok) fetchUsers();
  };

  if (!stats) return <div className="p-8 text-center">Loading management data...</div>;

  return (
    <div className="p-6 bg-zinc-50 min-h-screen">
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-zinc-900 tracking-tight">MANAGER HUB</h1>
          <p className="text-zinc-500 font-medium">Real-time restaurant performance &amp; operations</p>
        </div>
        <div className="flex bg-white p-1 rounded-2xl border border-zinc-200 shadow-sm flex-wrap gap-1">
          <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<LayoutDashboard className="w-4 h-4" />} label="Overview" />
          <TabButton active={activeTab === 'daily'} onClick={() => setActiveTab('daily')} icon={<Calendar className="w-4 h-4" />} label="Daily Report" />
          <TabButton active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} icon={<ClipboardList className="w-4 h-4" />} label="Orders" />
          <TabButton active={activeTab === 'tables'} onClick={() => setActiveTab('tables')} icon={<Utensils className="w-4 h-4" />} label="Tables" />
          <TabButton active={activeTab === 'menu'} onClick={() => setActiveTab('menu')} icon={<Utensils className="w-4 h-4" />} label="Menu" />
          <TabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<Users className="w-4 h-4" />} label="Staff" />
          <TabButton active={activeTab === 'financials'} onClick={() => setActiveTab('financials')} icon={<DollarSign className="w-4 h-4" />} label="Financials" />
        </div>
      </header>

      {activeTab === 'overview' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Total Revenue" value={`$${stats.totalRevenue.toFixed(2)}`} icon={<DollarSign className="w-6 h-6" />} color="text-emerald-600" bg="bg-emerald-50" />
            <StatCard title="Total Salaries" value={`$${stats.totalSalaries.toFixed(2)}`} icon={<Users className="w-6 h-6" />} color="text-rose-600" bg="bg-rose-50" />
            <StatCard title="Net Profit" value={`$${stats.netProfit.toFixed(2)}`} icon={<TrendingUp className="w-6 h-6" />} color={stats.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"} bg={stats.netProfit >= 0 ? "bg-emerald-50" : "bg-rose-50"} />
            <StatCard title="Avg. Order Value" value={`$${stats.avgOrderValue.toFixed(2)}`} icon={<TrendingUp className="w-6 h-6" />} color="text-purple-600" bg="bg-purple-50" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-zinc-400" /> Revenue by Category
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.revenueByCategory}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="category" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} cursor={{ fill: '#f8fafc' }} />
                    <Bar dataKey="revenue" fill="#18181b" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-zinc-400" /> Top Selling Items
              </h3>
              <div className="space-y-4">
                {stats.topItems.map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl">
                    <div className="flex items-center gap-4">
                      <span className="w-8 h-8 flex items-center justify-center bg-zinc-900 text-white rounded-full text-xs font-bold">{i + 1}</span>
                      <div>
                        <p className="font-bold text-zinc-900">{item.name}</p>
                        <p className="text-xs text-zinc-500 uppercase font-bold tracking-widest">{item.category}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-zinc-900">{item.quantity} sold</p>
                      <p className="text-xs text-emerald-600 font-bold">${item.revenue.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="bg-white rounded-[2.5rem] border border-zinc-200 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-zinc-100 flex justify-between items-center">
            <h2 className="text-2xl font-black text-zinc-900">All Orders</h2>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input type="text" placeholder="Search orders..." className="pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 ring-zinc-900/5" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Order ID</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Table</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Status</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Items</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Total</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-8 py-4 font-mono text-xs font-bold text-zinc-500">#{order.id.slice(0, 8)}</td>
                    <td className="px-8 py-4 font-bold text-zinc-900">T{order.table_number}</td>
                    <td className="px-8 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${order.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                        order.status === 'ready' ? 'bg-blue-100 text-blue-700' :
                          order.status === 'preparing' ? 'bg-amber-100 text-amber-700' :
                            'bg-zinc-100 text-zinc-600'
                        }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-sm text-zinc-600">{order.items?.length || 0} items</td>
                    <td className="px-8 py-4 font-black text-zinc-900">${order.total.toFixed(2)}</td>
                    <td className="px-8 py-4 text-xs text-zinc-400 font-bold">{new Date(order.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'tables' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {tables.map((table) => (
            <div key={table.id} className="bg-white p-6 rounded-[2rem] border border-zinc-200 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <span className="text-2xl font-black text-zinc-900">{table.table_number}</span>
                <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${table.status === 'available' ? 'bg-emerald-100 text-emerald-700' :
                  table.status === 'occupied' ? 'bg-rose-100 text-rose-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                  {table.status}
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-zinc-400 uppercase tracking-widest">Capacity</span>
                  <span className="text-zinc-900">{table.capacity} guests</span>
                </div>
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-zinc-400 uppercase tracking-widest">Section</span>
                  <span className="text-zinc-900">{table.section}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black text-zinc-900">Staff Management</h2>
            <button onClick={() => setIsAddingUser(true)} className="bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-zinc-800 transition-all shadow-lg">
              <UserPlus className="w-5 h-5" /> Add Staff Member
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {users.map((u) => (
              <div key={u.id} className="bg-white p-6 rounded-[2rem] border border-zinc-200 shadow-sm flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${u.role === 'manager' ? 'bg-purple-100 text-purple-600' :
                    u.role === 'chef' ? 'bg-amber-100 text-amber-600' :
                      u.role === 'waiter' ? 'bg-emerald-100 text-emerald-600' :
                        'bg-blue-100 text-blue-600'
                    }`}>
                    {u.role === 'manager' ? <Shield className="w-6 h-6" /> : <Users className="w-6 h-6" />}
                  </div>
                  <div>
                    <p className="font-black text-zinc-900">{u.username}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{u.role} • ${u.salary}/mo</p>
                  </div>
                </div>
                {u.id !== user.id && (
                  <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {isAddingUser && (
            <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[3rem] p-10 max-w-md w-full shadow-2xl">
                <h3 className="text-3xl font-black text-zinc-900 mb-2">Add Staff</h3>
                <p className="text-zinc-500 mb-8 font-medium">Create a new profile for your team.</p>
                <form onSubmit={handleAddUser} className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Full Name</label>
                    <input required type="text" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} className="w-full px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 ring-zinc-900/5 font-bold" placeholder="e.g. John Smith" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Role</label>
                    <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value as any })} className="w-full px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 ring-zinc-900/5 font-bold appearance-none">
                      <option value="waiter">Waiter</option>
                      <option value="chef">Kitchen Staff</option>
                      <option value="cashier">Cashier</option>
                      <option value="manager">Manager</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Monthly Salary ($)</label>
                    <input required type="number" value={newUser.salary} onChange={e => setNewUser({ ...newUser, salary: parseFloat(e.target.value) })} className="w-full px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 ring-zinc-900/5 font-bold" placeholder="e.g. 2500" />
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setIsAddingUser(false)} className="flex-1 px-6 py-4 rounded-2xl font-bold text-zinc-500 hover:bg-zinc-50 transition-all">Cancel</button>
                    <button type="submit" className="flex-1 px-6 py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg">Create Profile</button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'menu' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black text-zinc-900">Menu Management</h2>
            <button onClick={() => setIsAddingMenuItem(true)} className="bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-zinc-800 transition-all shadow-lg">
              <PlusCircle className="w-5 h-5" /> Add Menu Item
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {menu.map((item) => (
              <div key={item.id} className="bg-white rounded-[2rem] border border-zinc-200 shadow-sm overflow-hidden flex flex-col">
                <div className="h-40 bg-zinc-100 relative">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-300">
                      <ImageIcon className="w-12 h-12" />
                    </div>
                  )}
                  <div className="absolute top-4 right-4 flex gap-2">
                    <button onClick={() => setEditingMenuItem(item)} className="p-2 bg-white/90 backdrop-blur-sm rounded-xl text-zinc-600 hover:text-zinc-900 shadow-sm transition-all">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteMenuItem(item.id)} className="p-2 bg-white/90 backdrop-blur-sm rounded-xl text-rose-500 hover:text-rose-700 shadow-sm transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-black text-zinc-900">{item.name}</h4>
                    <span className="font-black text-emerald-600">${item.price.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-zinc-500 mb-4 line-clamp-2 flex-1">{item.description}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 bg-zinc-50 px-2 py-1 rounded-lg">{item.category}</span>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${item.is_available ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {item.is_available ? 'Available' : 'Sold Out'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {(isAddingMenuItem || editingMenuItem) && (
            <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[3rem] p-10 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
                <h3 className="text-3xl font-black text-zinc-900 mb-2">{editingMenuItem ? 'Edit Menu Item' : 'Add Menu Item'}</h3>
                <p className="text-zinc-500 mb-8 font-medium">{editingMenuItem ? 'Update details for this dish.' : 'Create a new dish for your menu.'}</p>
                <form onSubmit={editingMenuItem ? handleUpdateMenuItem : handleAddMenuItem} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Item Name</label>
                    <input required type="text" value={editingMenuItem ? editingMenuItem.name : newMenuItem.name} onChange={e => editingMenuItem ? setEditingMenuItem({ ...editingMenuItem, name: e.target.value }) : setNewMenuItem({ ...newMenuItem, name: e.target.value })} className="w-full px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 ring-zinc-900/5 font-bold" placeholder="e.g. Wagyu Burger" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Description</label>
                    <textarea required value={editingMenuItem ? editingMenuItem.description : newMenuItem.description} onChange={e => editingMenuItem ? setEditingMenuItem({ ...editingMenuItem, description: e.target.value }) : setNewMenuItem({ ...newMenuItem, description: e.target.value })} className="w-full px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 ring-zinc-900/5 font-bold h-24 resize-none" placeholder="Describe the dish..." />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Price ($)</label>
                    <input required type="number" step="0.01" value={editingMenuItem ? editingMenuItem.price : newMenuItem.price} onChange={e => editingMenuItem ? setEditingMenuItem({ ...editingMenuItem, price: parseFloat(e.target.value) }) : setNewMenuItem({ ...newMenuItem, price: parseFloat(e.target.value) })} className="w-full px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 ring-zinc-900/5 font-bold" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Category</label>
                    <select value={editingMenuItem ? editingMenuItem.category : newMenuItem.category} onChange={e => editingMenuItem ? setEditingMenuItem({ ...editingMenuItem, category: e.target.value }) : setNewMenuItem({ ...newMenuItem, category: e.target.value })} className="w-full px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 ring-zinc-900/5 font-bold appearance-none">
                      <option value="Starters">Starters</option>
                      <option value="Main">Main Course</option>
                      <option value="Desserts">Desserts</option>
                      <option value="Drinks">Drinks</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Image URL</label>
                    <input type="url" value={editingMenuItem ? editingMenuItem.image_url : newMenuItem.image_url} onChange={e => editingMenuItem ? setEditingMenuItem({ ...editingMenuItem, image_url: e.target.value }) : setNewMenuItem({ ...newMenuItem, image_url: e.target.value })} className="w-full px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 ring-zinc-900/5 font-bold" placeholder="https://..." />
                  </div>
                  <div className="md:col-span-2 flex items-center gap-3">
                    <input type="checkbox" id="is_available" checked={editingMenuItem ? editingMenuItem.is_available : newMenuItem.is_available} onChange={e => editingMenuItem ? setEditingMenuItem({ ...editingMenuItem, is_available: e.target.checked }) : setNewMenuItem({ ...newMenuItem, is_available: e.target.checked })} className="w-5 h-5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900" />
                    <label htmlFor="is_available" className="text-sm font-bold text-zinc-700">Available for ordering</label>
                  </div>
                  <div className="md:col-span-2 flex gap-4 pt-4">
                    <button type="button" onClick={() => { setIsAddingMenuItem(false); setEditingMenuItem(null); }} className="flex-1 px-6 py-4 rounded-2xl font-bold text-zinc-500 hover:bg-zinc-50 transition-all">Cancel</button>
                    <button type="submit" className="flex-1 px-6 py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg">{editingMenuItem ? 'Update Item' : 'Add to Menu'}</button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'financials' && (
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm">
            <h2 className="text-2xl font-black text-zinc-900 mb-6">Monthly Financial Report</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100">
                <p className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-2">Monthly Revenue</p>
                <p className="text-4xl font-black text-emerald-900">${stats.totalRevenue.toFixed(2)}</p>
              </div>
              <div className="p-6 bg-rose-50 rounded-3xl border border-rose-100">
                <p className="text-xs font-black text-rose-600 uppercase tracking-widest mb-2">Monthly Expenses</p>
                <p className="text-4xl font-black text-rose-900">${stats.totalSalaries.toFixed(2)}</p>
              </div>
              <div className={`p-6 rounded-3xl border ${stats.netProfit >= 0 ? 'bg-zinc-900 border-zinc-800' : 'bg-rose-900 border-rose-800'}`}>
                <p className={`text-xs font-black uppercase tracking-widest mb-2 ${stats.netProfit >= 0 ? 'text-zinc-400' : 'text-rose-200'}`}>Net Profit</p>
                <p className="text-4xl font-black text-white">${stats.netProfit.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'daily' && dailyReport && (
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
              <h2 className="text-2xl font-black text-zinc-900">Daily Performance Report</h2>
              <p className="text-zinc-500 font-medium">Detailed breakdown for {new Date(selectedDate).toLocaleDateString(undefined, { dateStyle: 'full' })}</p>
            </div>
            <div className="flex items-center gap-4 bg-zinc-50 p-2 rounded-2xl border border-zinc-200">
              <Calendar className="w-5 h-5 text-zinc-400 ml-2" />
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-transparent border-none focus:ring-0 font-bold text-zinc-900 pr-4" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard title="Today's Revenue" value={`$${(dailyReport.totalRevenue || 0).toFixed(2)}`} icon={<DollarSign className="w-6 h-6" />} color="text-emerald-600" bg="bg-emerald-50" />
            <StatCard title="Orders Today" value={dailyReport.totalOrders || 0} icon={<ClipboardList className="w-6 h-6" />} color="text-blue-600" bg="bg-blue-50" />
            <StatCard title="Avg. Order" value={`$${dailyReport.totalOrders > 0 ? ((dailyReport.totalRevenue || 0) / dailyReport.totalOrders).toFixed(2) : '0.00'}`} icon={<TrendingUp className="w-6 h-6" />} color="text-purple-600" bg="bg-purple-50" />
          </div>

          {(dailyReport.hourlyRevenue?.length > 0) && (
            <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Clock className="w-5 h-5 text-zinc-400" /> Hourly Sales Peak
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyReport.hourlyRevenue}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#18181b" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#18181b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 10 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 10 }} />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Area type="monotone" dataKey="revenue" stroke="#18181b" fillOpacity={1} fill="url(#colorRev)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, color, bg }: any) {
  return (
    <motion.div whileHover={{ y: -4 }} className="bg-white p-6 rounded-[2rem] border border-zinc-200 shadow-sm flex items-center gap-6">
      <div className={`${bg} ${color} p-4 rounded-2xl`}>{icon}</div>
      <div>
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">{title}</p>
        <p className="text-2xl font-black text-zinc-900">{value}</p>
      </div>
    </motion.div>
  );
}

function TabButton({ active, onClick, icon, label }: any) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${active ? 'bg-zinc-900 text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-50'}`}>
      {icon}{label}
    </button>
  );
}
