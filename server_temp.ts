import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import initSqlJs from 'sql.js';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SQL = await initSqlJs();
const dbPath = 'restaurant.db';
let db: any;

if (fs.existsSync(dbPath)) {
  const buffer = fs.readFileSync(dbPath);
  db = new SQL.Database(buffer);
} else {
  db = new SQL.Database();
}

// Helper to save database
const saveDb = () => {
  const data = db.export();
  fs.writeFileSync(dbPath, data);
};

// Helper to run queries
const dbExec = (sql: string) => db.run(sql);
const dbPrepare = (sql: string) => ({
  run: (...params: any[]) => {
    db.run(sql, params);
    saveDb();
  },
  get: (...params: any[]) => {
    const result = db.exec(sql, params);
    return result[0]?.values[0] ? Object.fromEntries(result[0].columns.map((col: string, i: number) => [col, result[0].values[0][i]])) : undefined;
  },
  all: (...params: any[]) => {
    const result = db.exec(sql, params);
    if (!result[0]) return [];
    return result[0].values.map((row: any[]) => 
      Object.fromEntries(result[0].columns.map((col: string, i: number) => [col, row[i]]))
    );
  }
});

// Initialize Database Schema
dbExec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    role TEXT CHECK(role IN ('waiter', 'chef', 'cashier', 'manager', 'admin')),
    salary REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS tables (
    id TEXT PRIMARY KEY,
    table_number TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    section TEXT,
    status TEXT NOT NULL CHECK (status IN ('available', 'occupied', 'reserved', 'billing', 'cleaning')),
    current_order_id TEXT
  );

  CREATE TABLE IF NOT EXISTS menu_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    category TEXT
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    table_id TEXT REFERENCES tables(id),
    waiter_id TEXT REFERENCES users(id),
    status TEXT NOT NULL CHECK (status IN ('pending', 'preparing', 'ready', 'served', 'paid')),
    subtotal REAL DEFAULT 0,
    tax REAL DEFAULT 0,
    service_charge REAL DEFAULT 0,
    total REAL DEFAULT 0,
    kitchen_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ready_at DATETIME,
    completed_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT REFERENCES orders(id),
    menu_item_id TEXT REFERENCES menu_items(id),
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    special_instructions TEXT,
    status TEXT DEFAULT 'pending',
    acknowledged_at DATETIME,
    completed_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS bill_requests (
    id TEXT PRIMARY KEY,
    table_id TEXT REFERENCES tables(id),
    order_id TEXT REFERENCES orders(id),
    waiter_id TEXT REFERENCES users(id),
    status TEXT DEFAULT 'pending',
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS receipts (
    id TEXT PRIMARY KEY,
    receipt_number TEXT UNIQUE,
    order_id TEXT REFERENCES orders(id),
    total REAL NOT NULL,
    payment_method TEXT,
    cashier_id TEXT REFERENCES users(id),
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
saveDb();

// Seed initial data if empty
const tableCount = dbPrepare('SELECT COUNT(*) as count FROM tables').get() as { count: number };
if (!tableCount || tableCount.count === 0) {
  const insertTable = dbPrepare('INSERT INTO tables (id, table_number, capacity, section, status) VALUES (?, ?, ?, ?, ?)');
  const sections = ['Main Hall', 'Terrace', 'Private Room', 'Bar Area'];
  for (let i = 1; i <= 20; i++) {
    const section = sections[Math.floor((i - 1) / 5)];
    const capacity = i % 4 === 0 ? 6 : (i % 2 === 0 ? 4 : 2);
    insertTable.run(crypto.randomUUID(), `T${i}`, capacity, section, 'available');
  }

  const insertMenu = dbPrepare('INSERT INTO menu_items (id, name, price, category) VALUES (?, ?, ?, ?)');
  const menuItems = [
    ['Classic Bruschetta', 8.5, 'Starter'],
    ['Calamari Fritti', 12.0, 'Starter'],
    ['Stuffed Mushrooms', 9.5, 'Starter'],
    ['Caprese Salad', 11.0, 'Starter'],
    ['Signature Wagyu Burger', 24.0, 'Main'],
    ['Lobster Thermidor', 45.0, 'Main'],
    ['Ribeye Steak (300g)', 38.0, 'Main'],
    ['Wild Mushroom Risotto', 22.0, 'Main'],
    ['Pan-Seared Sea Bass', 29.0, 'Main'],
    ['Fettuccine Alfredo', 18.0, 'Main'],
    ['BBQ Pork Ribs', 26.0, 'Main'],
    ['Vegetarian Buddha Bowl', 17.0, 'Main'],
    ['New York Cheesecake', 9.0, 'Dessert'],
    ['Warm Apple Crumble', 8.5, 'Dessert'],
    ['Molten Lava Cake', 10.5, 'Dessert'],
    ['Artisan Gelato Scoop', 4.0, 'Dessert'],
    ['Espresso Martini', 14.0, 'Drink'],
    ['Old Fashioned', 13.0, 'Drink'],
    ['Virgin Mojito', 7.5, 'Drink'],
    ['Craft IPA', 8.0, 'Drink'],
    ['Sparkling Water (750ml)', 6.0, 'Drink'],
    ['Earl Grey Tea', 4.5, 'Drink']
  ];
  for (const [name, price, category] of menuItems) {
    insertMenu.run(crypto.randomUUID(), name, price, category);
  }

  const insertUser = dbPrepare('INSERT INTO users (id, username, role, salary) VALUES (?, ?, ?, ?)');
  insertUser.run('waiter-1', 'John Doe', 'waiter', 2500);
  insertUser.run('waiter-2', 'Jane Smith', 'waiter', 2500);
  insertUser.run('waiter-3', 'Mike Ross', 'waiter', 2500);
  insertUser.run('waiter-4', 'Sarah Connor', 'waiter', 2500);
  insertUser.run('waiter-5', 'Alex Vance', 'waiter', 2500);
  insertUser.run('chef-1', 'Chef Mario', 'chef', 4500);
  insertUser.run('cashier-1', 'Cashier Kelly', 'cashier', 3000);
  insertUser.run('manager-1', 'Manager Mike', 'manager', 6000);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  app.use(express.json());

  // WebSocket logic
  const clients = new Map<string, WebSocket>();

  wss.on('connection', (ws) => {
    const id = crypto.randomUUID();
    clients.set(id, ws);
    
    ws.on('message', (message) => {
      // Handle messages if needed, but mostly we'll broadcast from API
    });

    ws.on('close', () => {
      clients.delete(id);
    });
  });

  const broadcast = (data: any) => {
    const payload = JSON.stringify(data);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  };

  // API Routes
  app.get('/api/tables', (req, res) => {
    const tables = dbPrepare('SELECT * FROM tables').all();
    res.json(tables);
  });

  app.get('/api/menu', (req, res) => {
    const menu = dbPrepare('SELECT * FROM menu_items').all();
    res.json(menu);
  });

  app.post('/api/orders', (req, res) => {
    const { tableId, waiterId, items, kitchenNotes } = req.body;
    const orderId = crypto.randomUUID();
    
    const subtotal = items.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);
    const tax = subtotal * 0.15;
    const serviceCharge = subtotal * 0.10;
    const total = subtotal + tax + serviceCharge;

    dbPrepare('INSERT INTO orders (id, table_id, waiter_id, status, subtotal, tax, service_charge, total, kitchen_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(orderId, tableId, waiterId, 'pending', subtotal, tax, serviceCharge, total, kitchenNotes);

    const insertItem = dbPrepare('INSERT INTO order_items (id, order_id, menu_item_id, quantity, unit_price, status) VALUES (?, ?, ?, ?, ?, ?)');
    for (const item of items) {
      insertItem.run(crypto.randomUUID(), orderId, item.id, item.quantity, item.price, 'pending');
    }

    dbPrepare('UPDATE tables SET status = ?, current_order_id = ? WHERE id = ?')
      .run('occupied', orderId, tableId);
    
    const newOrder = dbPrepare('SELECT o.*, t.table_number FROM orders o JOIN tables t ON o.table_id = t.id WHERE o.id = ?').get(orderId);
    broadcast({ type: 'ORDER_NEW', order: newOrder });
    broadcast({ type: 'TABLE_UPDATE', tableId, status: 'occupied' });
    
    res.json({ success: true, orderId });
  });

  app.get('/api/orders/kitchen', (req, res) => {
    const orders = dbPrepare(`
      SELECT o.*, t.table_number 
      FROM orders o 
      JOIN tables t ON o.table_id = t.id 
      WHERE o.status IN ('pending', 'preparing', 'ready')
      ORDER BY o.created_at ASC
    `).all();

    const ordersWithItems = orders.map((order: any) => {
      const items = dbPrepare(`
        SELECT oi.*, mi.name as menu_item_name 
        FROM order_items oi 
        JOIN menu_items mi ON oi.menu_item_id = mi.id 
        WHERE oi.order_id = ?
      `).all(order.id);
      return { ...order, items };
    });

    res.json(ordersWithItems);
  });

  app.get('/api/orders/ready', (req, res) => {
    const orders = dbPrepare(`
      SELECT o.*, t.table_number 
      FROM orders o 
      JOIN tables t ON o.table_id = t.id 
      WHERE o.status = 'ready'
      ORDER BY o.ready_at ASC
    `).all();
    res.json(orders);
  });

  app.patch('/api/orders/:id/status', (req, res) => {
    const { status } = req.body;
    const orderId = req.params.id;
    
    if (status === 'ready') {
      dbPrepare('UPDATE orders SET status = ?, ready_at = ? WHERE id = ?')
        .run(status, new Date().toISOString(), orderId);
    } else if (status === 'served') {
      dbPrepare('UPDATE orders SET status = ?, completed_at = ? WHERE id = ?')
        .run(status, new Date().toISOString(), orderId);
    } else {
      dbPrepare('UPDATE orders SET status = ? WHERE id = ?').run(status, orderId);
    }
    
    broadcast({ type: 'ORDER_STATUS_UPDATE', orderId, status });
    res.json({ success: true });
  });

  app.post('/api/orders/:id/bill-request', (req, res) => {
    const orderId = req.params.id;
    const { tableId, waiterId } = req.body;
    const requestId = crypto.randomUUID();

    dbPrepare('INSERT INTO bill_requests (id, table_id, order_id, waiter_id) VALUES (?, ?, ?, ?)')
      .run(requestId, tableId, orderId, waiterId);
    
    dbPrepare('UPDATE tables SET status = ? WHERE id = ?').run('billing', tableId);
    
    const bill = dbPrepare('SELECT br.*, t.table_number FROM bill_requests br JOIN tables t ON br.table_id = t.id WHERE br.id = ?').get(requestId);
    broadcast({ type: 'BILL_REQUEST', bill });
    broadcast({ type: 'TABLE_UPDATE', tableId, status: 'billing' });
    
    res.json({ success: true });
  });

  app.get('/api/cashier/bills', (req, res) => {
    const bills = dbPrepare(`
      SELECT br.*, t.table_number, o.total, o.subtotal, o.tax, o.service_charge
      FROM bill_requests br
      JOIN tables t ON br.table_id = t.id
      JOIN orders o ON br.order_id = o.id
      WHERE br.status = 'pending'
    `).all();

    const billsWithItems = bills.map((bill: any) => {
      const items = dbPrepare(`
        SELECT oi.*, mi.name as menu_item_name 
        FROM order_items oi 
        JOIN menu_items mi ON oi.menu_item_id = mi.id 
        WHERE oi.order_id = ?
      `).all(bill.order_id);
      return { ...bill, items };
    });

    res.json(billsWithItems);
  });

  app.post('/api/cashier/pay', (req, res) => {
    const { orderId, tableId, paymentMethod, cashierId, total } = req.body;
    const receiptId = crypto.randomUUID();
    const receiptNumber = `REC-${Date.now()}`;

    const transaction = db.transaction(() => {
      dbPrepare('INSERT INTO receipts (id, receipt_number, order_id, total, payment_method, cashier_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run(receiptId, receiptNumber, orderId, total, paymentMethod, cashierId);
      
      dbPrepare('UPDATE orders SET status = ? WHERE id = ?').run('paid', orderId);
      dbPrepare('UPDATE tables SET status = ?, current_order_id = NULL WHERE id = ?').run('available', tableId);
      dbPrepare("UPDATE bill_requests SET status = 'completed' WHERE order_id = ?").run(orderId);
    });

    transaction();

    broadcast({ type: 'PAYMENT_COMPLETE', orderId, tableId });
    broadcast({ type: 'TABLE_UPDATE', tableId, status: 'available' });

    res.json({ success: true, receiptNumber });
  });

  app.post('/api/menu', (req, res) => {
    const { name, description, price, category, image_url, is_available } = req.body;
    const id = crypto.randomUUID();
    try {
      dbPrepare('INSERT INTO menu_items (id, name, description, price, category, image_url, is_available) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(id, name, description, price, category, image_url, is_available ? 1 : 0);
      res.json({ id, name, description, price, category, image_url, is_available });
    } catch (error) {
      res.status(400).json({ error: 'Failed to create menu item' });
    }
  });

  app.patch('/api/menu/:id', (req, res) => {
    const { name, description, price, category, image_url, is_available } = req.body;
    try {
      dbPrepare('UPDATE menu_items SET name = ?, description = ?, price = ?, category = ?, image_url = ?, is_available = ? WHERE id = ?')
        .run(name, description, price, category, image_url, is_available ? 1 : 0, req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: 'Failed to update menu item' });
    }
  });

  app.delete('/api/menu/:id', (req, res) => {
    try {
      dbPrepare('DELETE FROM menu_items WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: 'Failed to delete menu item' });
    }
  });

  app.get('/api/users', (req, res) => {
    const users = dbPrepare('SELECT id, username, role, salary FROM users').all();
    res.json(users);
  });

  app.post('/api/users', (req, res) => {
    const { username, role, salary } = req.body;
    const id = crypto.randomUUID();
    try {
      dbPrepare('INSERT INTO users (id, username, role, salary) VALUES (?, ?, ?, ?)').run(id, username, role, salary || 0);
      res.json({ id, username, role, salary: salary || 0 });
    } catch (error) {
      res.status(400).json({ error: 'Failed to create user' });
    }
  });

  app.delete('/api/users/:id', (req, res) => {
    try {
      dbPrepare('DELETE FROM users WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: 'Failed to delete user' });
    }
  });

  app.get('/api/users/:role', (req, res) => {
    const users = dbPrepare('SELECT id, username, role, salary FROM users WHERE role = ?').all(req.params.role);
    res.json(users);
  });

  app.get('/api/manager/daily-report', (req, res) => {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    
    const revenue = dbPrepare(`
      SELECT SUM(total) as total 
      FROM receipts 
      WHERE date(generated_at) = date(?)
    `).get(date) as any;

    const orders = dbPrepare(`
      SELECT COUNT(*) as count 
      FROM orders 
      WHERE date(created_at) = date(?)
    `).get(date) as any;

    const hourlyRevenue = dbPrepare(`
      SELECT strftime('%H:00', generated_at) as hour, SUM(total) as revenue
      FROM receipts
      WHERE date(generated_at) = date(?)
      GROUP BY hour
      ORDER BY hour
    `).all(date);

    const topItems = dbPrepare(`
      SELECT m.name, SUM(oi.quantity) as quantity, SUM(oi.quantity * oi.unit_price) as revenue
      FROM order_items oi
      JOIN menu_items m ON oi.menu_item_id = m.id
      JOIN orders o ON oi.order_id = o.id
      WHERE date(o.created_at) = date(?) AND o.status = 'paid'
      GROUP BY m.id
      ORDER BY quantity DESC
      LIMIT 10
    `).all(date);

    const waiterPerformance = dbPrepare(`
      SELECT u.username, COUNT(o.id) as orders_count, SUM(o.total) as total_revenue
      FROM orders o
      JOIN users u ON o.waiter_id = u.id
      WHERE date(o.created_at) = date(?) AND o.status = 'paid'
      GROUP BY u.id
    `).all(date);

    res.json({
      date,
      totalRevenue: revenue.total || 0,
      totalOrders: orders.count || 0,
      hourlyRevenue,
      topItems,
      waiterPerformance
    });
  });

  app.get('/api/manager/stats', (req, res) => {
    const totalRevenue = dbPrepare('SELECT SUM(total) as total FROM receipts').get() as any;
    const totalOrders = dbPrepare('SELECT COUNT(*) as count FROM orders').get() as any;
    const activeTables = dbPrepare("SELECT COUNT(*) as count FROM tables WHERE status != 'available'").get() as any;
    const totalTables = dbPrepare('SELECT COUNT(*) as count FROM tables').get() as any;
    
    const revenueByCategory = dbPrepare(`
      SELECT m.category, SUM(oi.quantity * oi.unit_price) as revenue
      FROM order_items oi
      JOIN menu_items m ON oi.menu_item_id = m.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status = 'paid'
      GROUP BY m.category
    `).all();

    const topItems = dbPrepare(`
      SELECT m.name, m.category, SUM(oi.quantity) as quantity, SUM(oi.quantity * oi.unit_price) as revenue
      FROM order_items oi
      JOIN menu_items m ON oi.menu_item_id = m.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status = 'paid'
      GROUP BY m.id
      ORDER BY quantity DESC
      LIMIT 5
    `).all();

    const totalSalaries = dbPrepare('SELECT SUM(salary) as total FROM users').get() as any;

    res.json({
      totalRevenue: totalRevenue.total || 0,
      totalOrders: totalOrders.count || 0,
      activeTables: activeTables.count || 0,
      totalTables: totalTables.count || 0,
      avgOrderValue: totalOrders.count > 0 ? (totalRevenue.total || 0) / totalOrders.count : 0,
      totalSalaries: totalSalaries.total || 0,
      netProfit: (totalRevenue.total || 0) - (totalSalaries.total || 0),
      revenueByCategory,
      topItems
    });
  });

  app.get('/api/manager/daily-report', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    
    const dailyStats = dbPrepare(`
      SELECT 
        COUNT(*) as totalOrders,
        SUM(total) as totalRevenue,
        AVG(total) as avgOrderValue
      FROM orders 
      WHERE date(created_at) = date('now') AND status = 'paid'
    `).get() as any;

    const hourlyRevenue = dbPrepare(`
      SELECT 
        strftime('%H:00', created_at) as hour,
        SUM(total) as revenue
      FROM orders
      WHERE date(created_at) = date('now') AND status = 'paid'
      GROUP BY hour
      ORDER BY hour ASC
    `).all();

    const topItemsToday = dbPrepare(`
      SELECT m.name, SUM(oi.quantity) as quantity, SUM(oi.quantity * oi.unit_price) as revenue
      FROM order_items oi
      JOIN menu_items m ON oi.menu_item_id = m.id
      JOIN orders o ON oi.order_id = o.id
      WHERE date(o.created_at) = date('now') AND o.status = 'paid'
      GROUP BY m.id
      ORDER BY quantity DESC
      LIMIT 5
    `).all();

    const waiterPerformance = dbPrepare(`
      SELECT u.username, COUNT(o.id) as ordersCount, SUM(o.total) as totalRevenue
      FROM orders o
      JOIN users u ON o.waiter_id = u.id
      WHERE date(o.created_at) = date('now') AND o.status = 'paid'
      GROUP BY u.id
      ORDER BY totalRevenue DESC
    `).all();

    res.json({
      date: today,
      totalRevenue: dailyStats.totalRevenue || 0,
      totalOrders: dailyStats.totalOrders || 0,
      avgOrderValue: dailyStats.avgOrderValue || 0,
      hourlyRevenue,
      topItemsToday,
      waiterPerformance
    });
  });

  app.get('/api/manager/orders', (req, res) => {
    const orders = dbPrepare(`
      SELECT o.*, t.table_number 
      FROM orders o 
      JOIN tables t ON o.table_id = t.id 
      ORDER BY o.created_at DESC
    `).all();
    
    // Fetch items for each order
    const ordersWithItems = orders.map((order: any) => {
      const items = dbPrepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
      return { ...order, items };
    });
    
    res.json(ordersWithItems);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
