import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Layout } from './components/Layout';
import { PublicLayout } from './components/PublicLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './contexts/AuthContext';

// Core pages - loaded immediately
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ChangePassword } from './pages/ChangePassword';
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';

// Public pages - lazy loaded
const LiveryServices = lazy(() => import('./pages/LiveryServices').then(m => ({ default: m.LiveryServices })));
const HolidayLivery = lazy(() => import('./pages/HolidayLivery').then(m => ({ default: m.HolidayLivery })));
const Contact = lazy(() => import('./pages/Contact').then(m => ({ default: m.Contact })));
const PublicBooking = lazy(() => import('./pages/PublicBooking').then(m => ({ default: m.PublicBooking })));

// User pages - lazy loaded
const BookingCalendar = lazy(() => import('./pages/BookingCalendar').then(m => ({ default: m.BookingCalendar })));
const MyBookings = lazy(() => import('./pages/MyBookings').then(m => ({ default: m.MyBookings })));
const MyHorses = lazy(() => import('./pages/MyHorses').then(m => ({ default: m.MyHorses })));
const HorseHealthRecords = lazy(() => import('./pages/HorseHealthRecords').then(m => ({ default: m.HorseHealthRecords })));
const HorseFeed = lazy(() => import('./pages/HorseFeed').then(m => ({ default: m.HorseFeed })));
const HorseEmergencyContacts = lazy(() => import('./pages/HorseEmergencyContacts'));
const HorseDetails = lazy(() => import('./pages/HorseDetails'));
const MyInvoices = lazy(() => import('./pages/MyInvoices'));
const ServiceRequests = lazy(() => import('./pages/ServiceRequests').then(m => ({ default: m.ServiceRequests })));
const Noticeboard = lazy(() => import('./pages/Noticeboard').then(m => ({ default: m.Noticeboard })));
const ProfessionalDirectory = lazy(() => import('./pages/ProfessionalDirectory'));
const YardTasks = lazy(() => import('./pages/YardTasks'));
const FeedDuties = lazy(() => import('./pages/FeedDuties'));
const TurnoutRequests = lazy(() => import('./pages/TurnoutRequests').then(m => ({ default: m.TurnoutRequests })));
const TurnoutBoard = lazy(() => import('./pages/TurnoutBoard'));
const StaffManagement = lazy(() => import('./pages/StaffManagement'));
const MyTimesheet = lazy(() => import('./pages/MyTimesheet'));
const MyRota = lazy(() => import('./pages/MyRota'));
const MyLeave = lazy(() => import('./pages/MyLeave'));
const MyThanks = lazy(() => import('./pages/MyThanks'));
const SendThanks = lazy(() => import('./pages/SendThanks'));
const Clinics = lazy(() => import('./pages/Clinics'));
const Lessons = lazy(() => import('./pages/Lessons'));
const MyRegistrations = lazy(() => import('./pages/MyRegistrations').then(m => ({ default: m.MyRegistrations })));
const SecurityInfo = lazy(() => import('./pages/SecurityInfo').then(m => ({ default: m.SecurityInfo })));
const MyAccount = lazy(() => import('./pages/MyAccount'));
const MyContracts = lazy(() => import('./pages/MyContracts'));
const SigningComplete = lazy(() => import('./pages/SigningComplete'));
const MyProfile = lazy(() => import('./pages/MyProfile'));

// Admin pages - lazy loaded
const AdminUsers = lazy(() => import('./pages/admin/Users').then(m => ({ default: m.AdminUsers })));
const AdminArenas = lazy(() => import('./pages/admin/Arenas').then(m => ({ default: m.AdminArenas })));
const AdminBookings = lazy(() => import('./pages/admin/Bookings').then(m => ({ default: m.AdminBookings })));
const AdminSettings = lazy(() => import('./pages/admin/Settings').then(m => ({ default: m.AdminSettings })));
const AdminServices = lazy(() => import('./pages/admin/Services').then(m => ({ default: m.AdminServices })));
const AdminServiceRequests = lazy(() => import('./pages/admin/ServiceRequests').then(m => ({ default: m.AdminServiceRequests })));
const AdminLiveryPackages = lazy(() => import('./pages/admin/LiveryPackages').then(m => ({ default: m.AdminLiveryPackages })));
const AdminStables = lazy(() => import('./pages/admin/Stables').then(m => ({ default: m.AdminStables })));
const AdminCompliance = lazy(() => import('./pages/admin/Compliance').then(m => ({ default: m.AdminCompliance })));
const AdminArenaUsageReport = lazy(() => import('./pages/admin/ArenaUsageReport').then(m => ({ default: m.AdminArenaUsageReport })));
const AdminBilling = lazy(() => import('./pages/admin/Billing'));
const FinancialReports = lazy(() => import('./pages/admin/FinancialReports'));
const AdminInvoices = lazy(() => import('./pages/admin/Invoices'));
const AdminFields = lazy(() => import('./pages/admin/Fields'));
const AdminLandManagement = lazy(() => import('./pages/admin/LandManagement'));
const AdminCarePlans = lazy(() => import('./pages/admin/CarePlans'));
const AdminBackups = lazy(() => import('./pages/admin/Backups').then(m => ({ default: m.AdminBackups })));
const AdminCoaches = lazy(() => import('./pages/admin/Coaches').then(m => ({ default: m.AdminCoaches })));
const AdminEventTriage = lazy(() => import('./pages/admin/EventTriage').then(m => ({ default: m.AdminEventTriage })));
const AdminLessonTriage = lazy(() => import('./pages/admin/LessonTriage').then(m => ({ default: m.AdminLessonTriage })));
const AdminSecurity = lazy(() => import('./pages/admin/Security').then(m => ({ default: m.AdminSecurity })));
const AdminHolidayLiveryRequests = lazy(() => import('./pages/admin/HolidayLiveryRequests'));
const AdminRequests = lazy(() => import('./pages/admin/Requests'));
const AdminWorming = lazy(() => import('./pages/admin/Worming').then(m => ({ default: m.AdminWorming })));
const AdminContractTemplates = lazy(() => import('./pages/admin/ContractTemplates').then(m => ({ default: m.AdminContractTemplates })));
const AdminContractSignatures = lazy(() => import('./pages/admin/ContractSignatures').then(m => ({ default: m.AdminContractSignatures })));
const AdminStaffProfiles = lazy(() => import('./pages/admin/StaffProfiles').then(m => ({ default: m.AdminStaffProfiles })));
const AdminLeaveOverview = lazy(() => import('./pages/admin/LeaveOverview'));
const AdminRiskAssessments = lazy(() => import('./pages/admin/RiskAssessments').then(m => ({ default: m.AdminRiskAssessments })));
const MyRiskAssessments = lazy(() => import('./pages/MyRiskAssessments').then(m => ({ default: m.MyRiskAssessments })));

// Loading fallback component
const PageLoader = () => (
  <div className="ds-loading" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
    Loading...
  </div>
);

// Redirect users to their role-appropriate default page
function DefaultBookingPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isStaff = user?.role === 'staff' || (user?.is_yard_staff && user?.role !== 'admin');
  const isLivery = user?.role === 'livery';

  if (isAdmin) {
    return <Navigate to="/book/tasks" replace />;
  }

  if (isStaff) {
    return <Navigate to="/book/tasks" replace />;
  }

  if (isLivery) {
    return <Navigate to="/book/my-horses" replace />;
  }

  return <BookingCalendar />;
}

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
    <Routes>
      {/* Auth routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/change-password"
        element={
          <ProtectedRoute allowPasswordChange>
            <ChangePassword />
          </ProtectedRoute>
        }
      />

      {/* Public content pages */}
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="livery" element={<LiveryServices />} />
        <Route path="holiday-livery" element={<HolidayLivery />} />
        <Route path="contact" element={<Contact />} />
        <Route path="public-booking" element={<PublicBooking />} />
        <Route path="clinics" element={<Clinics />} />
        <Route path="lessons" element={<Lessons />} />
      </Route>

      {/* Protected booking/management routes */}
      <Route
        path="/book"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DefaultBookingPage />} />
        <Route path="my-bookings" element={<MyBookings />} />

        {/* Livery-only routes - staff without livery role cannot access */}
        <Route path="my-horses" element={<ProtectedRoute requireLivery><MyHorses /></ProtectedRoute>} />
        <Route path="my-horses/:horseId" element={<ProtectedRoute requireLivery><HorseDetails /></ProtectedRoute>} />
        <Route path="my-horses/:horseId/health" element={<ProtectedRoute requireLivery><HorseHealthRecords /></ProtectedRoute>} />
        <Route path="my-horses/:horseId/feed" element={<ProtectedRoute requireLivery><HorseFeed /></ProtectedRoute>} />
        <Route path="my-horses/:horseId/emergency-contacts" element={<ProtectedRoute requireLivery><HorseEmergencyContacts /></ProtectedRoute>} />
        <Route path="my-invoices" element={<ProtectedRoute requireLivery><MyInvoices /></ProtectedRoute>} />
        <Route path="services" element={<ProtectedRoute requireLivery><ServiceRequests /></ProtectedRoute>} />
        <Route path="turnout" element={<ProtectedRoute requireLivery><TurnoutRequests /></ProtectedRoute>} />
        <Route path="my-account" element={<ProtectedRoute requireLivery><MyAccount /></ProtectedRoute>} />
        <Route path="my-contracts" element={<ProtectedRoute><MyContracts /></ProtectedRoute>} />
        <Route path="signing-complete" element={<ProtectedRoute><SigningComplete /></ProtectedRoute>} />
        <Route path="my-profile" element={<ProtectedRoute><MyProfile /></ProtectedRoute>} />
        <Route path="risk-assessments" element={<ProtectedRoute><MyRiskAssessments /></ProtectedRoute>} />

        {/* Staff-only routes */}
        <Route path="my-rota" element={<ProtectedRoute requireStaff><MyRota /></ProtectedRoute>} />
        <Route path="my-timesheet" element={<ProtectedRoute requireStaff><MyTimesheet /></ProtectedRoute>} />
        <Route path="my-leave" element={<ProtectedRoute requireStaff><MyLeave /></ProtectedRoute>} />
        <Route path="my-thanks" element={<ProtectedRoute requireStaff><MyThanks /></ProtectedRoute>} />

        {/* Livery-only routes for appreciation */}
        <Route path="send-thanks" element={<ProtectedRoute requireLivery><SendThanks /></ProtectedRoute>} />

        {/* General protected routes */}
        <Route path="professionals" element={<ProfessionalDirectory />} />
        <Route path="tasks" element={<YardTasks />} />
        <Route path="feed-duties" element={<FeedDuties />} />
        <Route path="turnout-board" element={<TurnoutBoard />} />
        <Route path="clinics" element={<Clinics />} />
        <Route path="lessons" element={<Lessons />} />
        <Route path="my-registrations" element={<MyRegistrations />} />
        <Route path="noticeboard" element={<Noticeboard />} />
        {/* Security info only for livery and admin */}
        <Route path="security" element={<ProtectedRoute requireLivery><SecurityInfo /></ProtectedRoute>} />

        {/* Admin routes - nested under /book but using main Layout */}
        <Route path="admin">
          <Route index element={<ProtectedRoute requireAdmin><Navigate to="settings" replace /></ProtectedRoute>} />
          {/* Settings Section */}
          <Route path="settings" element={<ProtectedRoute requireAdmin><AdminSettings /></ProtectedRoute>} />
          <Route path="requests" element={<ProtectedRoute requireAdmin><AdminRequests /></ProtectedRoute>} />
          <Route path="users" element={<ProtectedRoute requireAdmin><AdminUsers /></ProtectedRoute>} />
          {/* Venue Section */}
          <Route path="arenas" element={<ProtectedRoute requireAdmin><AdminArenas /></ProtectedRoute>} />
          <Route path="stables" element={<ProtectedRoute requireAdmin><AdminStables /></ProtectedRoute>} />
          <Route path="bookings" element={<ProtectedRoute requireAdmin><AdminBookings /></ProtectedRoute>} />
          <Route path="arena-usage" element={<ProtectedRoute requireAdmin><AdminArenaUsageReport /></ProtectedRoute>} />
          <Route path="tasks" element={<ProtectedRoute requireAdmin><YardTasks /></ProtectedRoute>} />
          <Route path="noticeboard" element={<ProtectedRoute requireAdmin><Noticeboard /></ProtectedRoute>} />
          <Route path="staff" element={<ProtectedRoute requireAdmin><StaffManagement /></ProtectedRoute>} />
          <Route path="leave-overview" element={<ProtectedRoute requireAdmin><AdminLeaveOverview /></ProtectedRoute>} />
          {/* Livery Section */}
          <Route path="livery-packages" element={<ProtectedRoute requireAdmin><AdminLiveryPackages /></ProtectedRoute>} />
          <Route path="holiday-livery" element={<ProtectedRoute requireAdmin><AdminHolidayLiveryRequests /></ProtectedRoute>} />
          <Route path="feed-schedule" element={<ProtectedRoute requireAdmin><FeedDuties /></ProtectedRoute>} />
          <Route path="worming" element={<ProtectedRoute requireAdmin><AdminWorming /></ProtectedRoute>} />
          <Route path="services" element={<ProtectedRoute requireAdmin><AdminServices /></ProtectedRoute>} />
          <Route path="service-requests" element={<ProtectedRoute requireAdmin><AdminServiceRequests /></ProtectedRoute>} />
          <Route path="billing" element={<ProtectedRoute requireAdmin><AdminBilling /></ProtectedRoute>} />
          <Route path="invoices" element={<ProtectedRoute requireAdmin><AdminInvoices /></ProtectedRoute>} />
          <Route path="reports" element={<ProtectedRoute requireAdmin><FinancialReports /></ProtectedRoute>} />
          {/* Venue Section Continued */}
          <Route path="fields" element={<ProtectedRoute requireAdmin><AdminFields /></ProtectedRoute>} />
          <Route path="land-management" element={<ProtectedRoute requireAdmin><AdminLandManagement /></ProtectedRoute>} />
          {/* Care Plans Section */}
          <Route path="care-plans" element={<ProtectedRoute requireAdmin><AdminCarePlans /></ProtectedRoute>} />
          {/* Events & Coaching Section */}
          <Route path="events" element={<ProtectedRoute requireAdmin><AdminEventTriage /></ProtectedRoute>} />
          <Route path="lessons" element={<ProtectedRoute requireAdmin><AdminLessonTriage /></ProtectedRoute>} />
          <Route path="coaches" element={<ProtectedRoute requireAdmin><AdminCoaches /></ProtectedRoute>} />
          {/* Contracts Section */}
          <Route path="contracts" element={<ProtectedRoute requireAdmin><AdminContractTemplates /></ProtectedRoute>} />
          <Route path="contract-signatures" element={<ProtectedRoute requireAdmin><AdminContractSignatures /></ProtectedRoute>} />
          {/* Staff Section */}
          <Route path="staff-profiles" element={<ProtectedRoute requireAdmin><AdminStaffProfiles /></ProtectedRoute>} />
          <Route path="risk-assessments" element={<ProtectedRoute requireAdmin><AdminRiskAssessments /></ProtectedRoute>} />
          {/* System Section */}
          <Route path="compliance" element={<ProtectedRoute requireAdmin><AdminCompliance /></ProtectedRoute>} />
          <Route path="backups" element={<ProtectedRoute requireAdmin><AdminBackups /></ProtectedRoute>} />
          <Route path="security" element={<ProtectedRoute requireAdmin><AdminSecurity /></ProtectedRoute>} />
          {/* Legacy route for task triage */}
          <Route path="task-triage" element={<Navigate to="/book/admin/tasks" replace />} />
        </Route>
      </Route>

      {/* 404 catch-all route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  );
}

export default App;
