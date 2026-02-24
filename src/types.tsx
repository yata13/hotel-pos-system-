export type TableStatus = 'available' | 'occupied' | 'reserved' | 'billing' | 'cleaning';
export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'paid';

export interface Table {
  id: string;
  table_number: string;
  capacity: number;
  section: string;
  status: TableStatus;
  current_order_id?: string;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url: string;
  is_available: boolean;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  menu_item_name: string;
  quantity: number;
  unit_price: number;
  status: string;
}

export interface Order {
  id: string;
  table_id: string;
  table_number?: string;
  waiter_id: string;
  status: OrderStatus;
  subtotal: number;
  tax: number;
  service_charge: number;
  total: number;
  kitchen_notes?: string;
  created_at: string;
  ready_at?: string;
  items?: OrderItem[];
}

export interface BillRequest {
  id: string;
  table_id: string;
  table_number: string;
  order_id: string;
  waiter_id: string;
  total: number;
  subtotal: number;
  tax: number;
  service_charge: number;
  items: OrderItem[];
}

export type UserRole = 'waiter' | 'chef' | 'cashier' | 'manager';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  salary: number;
}
