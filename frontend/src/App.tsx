import { Routes, Route, Navigate } from 'react-router-dom'
import { getToken } from './services/api'
import Layout from './components/Layout'
import PageLoader from './components/PageLoader'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import Products from './pages/Products'
import Quotations from './pages/Quotations'
import Invoices from './pages/Invoices'
import Payments from './pages/Payments'
import AMC from './pages/AMC'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import CreateQuotation from './pages/CreateQuotation'
import CreateInvoice from './pages/CreateInvoice'
import ViewInvoice from './pages/ViewInvoice'
import ViewQuotation from './pages/ViewQuotation'
import EditCustomer from './pages/EditCustomer'
import CustomerLedger from './pages/CustomerLedger'
import EditProduct from './pages/EditProduct'
import RecordPayment from './pages/RecordPayment'
import EditAMC from './pages/EditAMC'
import EditInvoice from './pages/EditInvoice'
import ViewAMC from './pages/ViewAMC'
import ViewPayment from './pages/ViewPayment'
import PriorityOrders from './pages/PriorityOrders'
import ViewOrder from './pages/ViewOrder'
import SystemDiagnostics from './pages/SystemDiagnostics'
import FranchiseManagement from './pages/FranchiseManagement'
import ApprovalsDashboard from './pages/ApprovalsDashboard'

function AuthGuard({ children }: { children: React.ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <>
      <PageLoader />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<AuthGuard><Layout /></AuthGuard>}>
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/new" element={<EditCustomer />} />
          <Route path="customers/:id/edit" element={<EditCustomer />} />
          <Route path="customers/:id/ledger" element={<CustomerLedger />} />
          <Route path="products" element={<Products />} />
          <Route path="products/new" element={<EditProduct />} />
          <Route path="products/:id/edit" element={<EditProduct />} />
          <Route path="quotations" element={<Quotations />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="invoices/new" element={<CreateInvoice />} />
          <Route path="invoices/:id" element={<ViewInvoice />} />
          <Route path="view-invoice/:id" element={<ViewInvoice />} />
          <Route path="invoices/:id/edit" element={<EditInvoice />} />
          <Route path="priority-orders" element={<PriorityOrders />} />
          <Route path="orders/:id" element={<ViewOrder />} />
          <Route path="payments" element={<Payments />} />
          <Route path="payments/new" element={<RecordPayment />} />
          <Route path="view-payment/:id" element={<ViewPayment />} />
          <Route path="amc" element={<AMC />} />
          <Route path="amc/new" element={<EditAMC />} />
          <Route path="amc/:id" element={<ViewAMC />} />
          <Route path="amc/:id/edit" element={<EditAMC />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
          <Route path="system-diagnostics" element={<SystemDiagnostics />} />
          <Route path="create-quotation" element={<CreateQuotation />} />
          <Route path="quotation/edit/:id" element={<CreateQuotation />} />
          <Route path="create-invoice" element={<CreateInvoice />} />
          <Route path="view-quotation/:id" element={<ViewQuotation />} />
          {/* ── Multi-Tenant Administration Routes ── */}
          <Route path="administration/franchises" element={<FranchiseManagement />} />
          <Route path="approvals" element={<ApprovalsDashboard />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
