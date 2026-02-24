import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'restaurant_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

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
  app.get('/api/tables', async (req, res) => {
    const [tables] = await pool.query('SELECT * FROM tables');
    res.json(tables);
  });

  app.get('/api/menu', async (req, res) => {
    const [menu] = await pool.query('SELECT * FROM menu_items');
    res.json(menu);
  });

  app.post('/api/orders', async (req, res) => {
    const { tableId, waiterId, items, kitchenNotes } = req.body;
    const orderId = crypto.randomUUID();
    
    const subtotal = items.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);
    const tax = subtotal * 0.15;
    const serviceCharge = subtotal * 0.10;
    const total = subtotal + tax + serviceCharge;

    await pool.query(
      'INSERT INTO orders (id, table_id, waiter_id, status, subtotal, tax, service_charge, total, kitchen_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [orderId, tableId, waiterId, 'pending', subtotal, tax, serviceCharge, total, kitchenNotes]
    );

    for (const item of items) {
      await pool.query(
        'INSERT INTO order_items (id, order_id, menu_item_id, quantity, unit_price, status) VALUES (?, ?, ?, ?, ?, ?)',
        [crypto.randomUUID(), orderId, item.id, item.quantity, item.price, 'pending']
      );
    }

    await pool.query('UPDATE tables SET status = ?, current_order_id = ? WHERE id = ?', ['occupied', orderId, tableId]);
    
    const [newOrder] = await pool.query('SELECT o.*, t.table_number FROM orders o JOIN tables t ON o.table_id = t.id WHERE o.id = ?', [orderId]);
    broadcast({ type: 'ORDER_NEW', order: newOrder[0] });
    broadcast({ type: 'TABLE_UPDATE', tableId, status: 'occupied' });
    
    res.json({ success: true, orderId });
  });

  app.get('/api/orders/kitchen', async (req, res) => {
    const [orders] = await pool.query(`
      SELECT o.*, t.table_number 
      FROM orders o 
      JOIN tables t ON o.table_id = t.id 
      WHERE o.status IN ('pending', 'preparing', 'ready')
      ORDER BY o.created_at ASC
    `);

    const ordersWithItems = await Promise.all((orders as any[]).map(async (order: any) => {
      const [items] = await pool.query(`
        SELECT oi.*, mi.name as menu_item_name 
        FROM order_items oi 
        JOIN menu_items mi ON oi.menu_item_id = mi.id 
        WHERE oi.order_id = ?
      `, [order.id]);
      return { ...order, items };
    }));

    res.json(ordersWithItems);
  });

  app.get('/api/orders/ready', async (req, res) => {
    const [orders] = await pool.query(`
      SELECT o.*, t.table_number 
      FROM orders o 
      JOIN tables t ON o.table_id = t.id 
      WHERE o.status = 'ready'
      ORDER BY o.ready_at ASC
    `);
    res.json(orders);
  });

  app.patch('/api/orders/:id/status', async (req, res) => {
    const { status } = req.body;
    const orderId = req.params.id;
    
    if (status === 'ready') {
      await pool.query('UPDATE orders SET status = ?, ready_at = ? WHERE id = ?', [status, new Date(), orderId]);
    } else if (status === 'served') {
      await pool.query('UPDATE orders SET status = ?, completed_at = ? WHERE id = ?', [status, new Date(), orderId]);
    } else {
      await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
    }
    
    broadcast({ type: 'ORDER_STATUS_UPDATE', orderId, status });
    res.json({ success: true });
  });

  app.post('/api/orders/:id/bill-request', async (req, res) => {
    const orderId = req.params.id;
    const { tableId, waiterId } = req.body;
    const requestId = crypto.randomUUID();

    await pool.query('INSERT INTO bill_requests (id, table_id, order_id, waiter_id) VALUES (?, ?, ?, ?)', [requestId, tableId, orderId, waiterId]);
    await pool.query('UPDATE tables SET status = ? WHERE id = ?', ['billing', tableId]);
    
    const [bill] = await pool.query('SELECT br.*, t.table_number FROM bill_requests br JOIN tables t ON br.table_id = t.id WHERE br.id = ?', [requestId]);
    broadcast({ type: 'BILL_REQUEST', bill: bill[0] });
    broadcast({ type: 'TABLE_UPDATE', tableId, status: 'billing' });
    
    res.json({ success: true });
  });

  app.get('/api/cashier/bills', async (req, res) => {
    const [bills] = await pool.query(`
      SELECT br.*, t.table_number, o.total, o.subtotal, o.tax, o.service_charge
      FROM bill_requests br
      JOIN tables t ON br.table_id = t.id
      JOIN orders o ON br.order_id = o.id
      WHERE br.status = 'pending'
    `);

    const billsWithItems = await Promise.all((bills as any[]).map(async (bill: any) => {
      const [items] = await pool.query(`
        SELECT oi.*, mi.name as menu_item_name 
        FROM order_items oi 
        JOIN menu_items mi ON oi.menu_item_id = mi.id 
        WHERE oi.order_id = ?
      `, [bill.order_id]);
      return { ...bill, items };
    }));

    res.json(billsWithItems);
  });

  app.post('/api/cashier/pay', async (req, res) => {
    const { orderId, tableId, paymentMethod, cashierId, total } = req.body;
    const receiptId = crypto.randomUUID();
    const receiptNumber = `REC-${Date.now()}`;

    await pool.query('INSERT INTO receipts (id, receipt_number, order_id, total, payment_method, cashier_id) VALUES (?, ?, ?, ?, ?, ?)', [receiptId, receiptNumber, orderId, total, paymentMethod, cashierId]);
    await pool.query('UPDATE orders SET status = ? WHERE id = ?', ['paid', orderId]);
    await pool.query('UPDATE tables SET status = ?, current_order_id = NULL WHERE id = ?', ['available', tableId]);
    await pool.query("UPDATE bill_requests SET status = 'completed' WHERE order_id = ?", [orderId]);

    broadcast({ type: 'PAYMENT_COMPLETE', orderId, tableId });
    broadcast({ type: 'TABLE_UPDATE', tableId, status: 'available' });

    res.json({ success: true, receiptNumber });
  });

  app.post('/api/menu', async (req, res) => {
    const { name, description, price, category, image_url, is_available } = req.body;
    const id = crypto.randomUUID();
    try {
      await pool.query('INSERT INTO menu_items (id, name, description, price, category, image_url, is_available) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, name, description, price, category, image_url, is_available ? 1 : 0]);
      res.json({ id, name, description, price, category, image_url, is_available });
    } catch (error) {
      res.status(400).json({ error: 'Failed to create menu item' });
    }
  });

  app.patch('/api/menu/:id', async (req, res) => {
    const { name, description, price, category, image_url, is_available } = req.body;
    try {
      await pool.query('UPDATE menu_items SET name = ?, description = ?, price = ?, category = ?, image_url = ?, is_available = ? WHERE id = ?', [name, description, price, category, image_url, is_available ? 1 : 0, req.params.id]);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: 'Failed to update menu item' });
    }
  });

  app.delete('/api/menu/:id', async (req, res) => {
    try {
      await pool.query('DELETE FROM menu_items WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: 'Failed to delete menu item' });
    }
  });

  app.get('/api/users', async (req, res) => {
    const [users] = await pool.query('SELECT id, username, role, salary FROM users');
    res.json(users);
  });

  app.post('/api/users', async (req, res) => {
    const { username, role, salary } = req.body;
    const id = crypto.randomUUID();
    try {
      await pool.query('INSERT INTO users (id, username, role, salary) VALUES (?, ?, ?, ?)', [id, username, role, salary || 0]);
      res.json({ id, username, role, salary: salary || 0 });
    } catch (error) {
      res.status(400).json({ error: 'Failed to create user' });
    }
  });

  app.delete('/api/users/:id', async (req, res) => {
    try {
      await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: 'Failed to delete user' });
    }
  });

  app.get('/api/users/:role', async (req, res) => {
    const [users] = await pool.query('SELECT id, username, role, salary FROM users WHERE role = ?', [req.params.role]);
    res.json(users);
  });

  app.get('/api/manager/daily-report', async (req, res) => {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    
    const [revenue] = await pool.query(`
      SELECT SUM(total) as total 
      FROM receipts 
      WHERE DATE(generated_at) = ?
    `, [date]);

    const [orders] = await pool.query(`
      SELECT COUNT(*) as count 
      FROM orders 
      WHERE DATE(created_at) = ?
    `, [date]);

    const [hourlyRevenue] = await pool.query(`
      SELECT DATE_FORMAT(generated_at, '%H:00') as hour, SUM(total) as revenue
      FROM receipts
      WHERE DATE(generated_at) = ?
      GROUP BY hour
      ORDER BY hour
    `, [date]);

    const [topItems] = await pool.query(`
      SELECT m.name, SUM(oi.quantity) as quantity, SUM(oi.quantity * oi.unit_price) as revenue
      FROM order_items oi
      JOIN menu_items m ON oi.menu_item_id = m.id
      JOIN orders o ON oi.order_id = o.id
      WHERE DATE(o.created_at) = ? AND o.status = 'paid'
      GROUP BY m.id
      ORDER BY quantity DESC
      LIMIT 10
    `, [date]);

    const [waiterPerformance] = await pool.query(`
      SELECT u.username, COUNT(o.id) as orders_count, SUM(o.total) as total_revenue
      FROM orders o
      JOIN users u ON o.waiter_id = u.id
      WHERE DATE(o.created_at) = ? AND o.status = 'paid'
      GROUP BY u.id
    `, [date]);

    res.json({
      date,
      totalRevenue: (revenue as any)[0]?.total || 0,
      totalOrders: (orders as any)[0]?.count || 0,
      hourlyRevenue,
      topItems,
      waiterPerformance
    });
  });

  app.get('/api/manager/stats', async (req, res) => {
    const [totalRevenue] = await pool.query('SELECT SUM(total) as total FROM receipts');
    const [totalOrders] = await pool.query('SELECT COUNT(*) as count FROM orders');
    const [activeTables] = await pool.query("SELECT COUNT(*) as count FROM tables WHERE status != 'available'");
    const [totalTables] = await pool.query('SELECT COUNT(*) as count FROM tables');
    
    const [revenueByCategory] = await pool.query(`
      SELECT m.category, SUM(oi.quantity * oi.unit_price) as revenue
      FROM order_items oi
      JOIN menu_items m ON oi.menu_item_id = m.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status = 'paid'
      GROUP BY m.category
    `);

    const [topItems] = await pool.query(`
      SELECT m.name, m.category, SUM(oi.quantity) as quantity, SUM(oi.quantity * oi.unit_price) as revenue
      FROM order_items oi
      JOIN menu_items m ON oi.menu_item_id = m.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status = 'paid'
      GROUP BY m.id
      ORDER BY quantity DESC
      LIMIT 5
    `);

    const [totalSalaries] = await pool.query('SELECT SUM(salary) as total FROM users');

    const revTotal = (totalRevenue as any)[0]?.total || 0;
    const ordCount = (totalOrders as any)[0]?.count || 0;

    res.json({
      totalRevenue: revTotal,
      totalOrders: ordCount,
      activeTables: (activeTables as any)[0]?.count || 0,
      totalTables: (totalTables as any)[0]?.count || 0,
      avgOrderValue: ordCount > 0 ? revTotal / ordCount : 0,
      totalSalaries: (totalSalaries as any)[0]?.total || 0,
      netProfit: revTotal - ((totalSalaries as any)[0]?.total || 0),
      revenueByCategory,
      topItems
    });
  });

  app.get('/api/manager/daily-report', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    
    const [dailyStats] = await pool.query(`
      SELECT 
        COUNT(*) as totalOrders,
        SUM(total) as totalRevenue,
        AVG(total) as avgOrderValue
      FROM orders 
      WHERE DATE(created_at) = CURDATE() AND status = 'paid'
    `);

    const [hourlyRevenue] = await pool.query(`
      SELECT 
        DATE_FORMAT(created_at, '%H:00') as hour,
        SUM(total) as revenue
      FROM orders
      WHERE DATE(created_at) = CURDATE() AND status = 'paid'
      GROUP BY hour
      ORDER BY hour ASC
    `);

    const [topItemsToday] = await pool.query(`
      SELECT m.name, SUM(oi.quantity) as quantity, SUM(oi.quantity * oi.unit_price) as revenue
      FROM order_items oi
      JOIN menu_items m ON oi.menu_item_id = m.id
      JOIN orders o ON oi.order_id = o.id
      WHERE DATE(o.created_at) = CURDATE() AND o.status = 'paid'
      GROUP BY m.id
      ORDER BY quantity DESC
      LIMIT 5
    `);

    const [waiterPerformance] = await pool.query(`
      SELECT u.username, COUNT(o.id) as ordersCount, SUM(o.total) as totalRevenue
      FROM orders o
      JOIN users u ON o.waiter_id = u.id
      WHERE DATE(o.created_at) = CURDATE() AND o.status = 'paid'
      GROUP BY u.id
      ORDER BY totalRevenue DESC
    `);

    const stats = (dailyStats as any)[0] || {};
    res.json({
      date: today,
      totalRevenue: stats.totalRevenue || 0,
      totalOrders: stats.totalOrders || 0,
      avgOrderValue: stats.avgOrderValue || 0,
      hourlyRevenue,
      topItemsToday,
      waiterPerformance
    });
  });

  app.get('/api/manager/orders', async (req, res) => {
    const [orders] = await pool.query(`
      SELECT o.*, t.table_number 
      FROM orders o 
      JOIN tables t ON o.table_id = t.id 
      ORDER BY o.created_at DESC
    `);
    
    const ordersWithItems = await Promise.all((orders as any[]).map(async (order: any) => {
      const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
      return { ...order, items };
    }));
    
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

