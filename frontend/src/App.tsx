import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { PublicLayout } from './components/PublicLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ChangePassword } from './pages/ChangePassword';
import { Home } from './pages/Home';
import { LiveryServices } from './pages/LiveryServices';
import { HolidayLivery } from './pages/HolidayLivery';
import { Contact } from './pages/Contact';
import { PublicBooking } from './pages/PublicBooking';
import { BookingCalendar } from './pages/BookingCalendar';
import { MyBookings } from './pages/MyBookings';
import { MyHorses } from './pages/MyHorses';
import { HorseHealthRecords } from './pages/HorseHealthRecords';
import { HorseFeed } from './pages/HorseFeed';
import HorseEmergencyContacts from './pages/HorseEmergencyContacts';
import MyInvoices from './pages/MyInvoices';
import { ServiceRequests } from './pages/ServiceRequests';
import { Noticeboard } from './pages/Noticeboard';
import ProfessionalDirectory from './pages/ProfessionalDirectory';
import YardTasks from './pages/YardTasks';
import FeedDuties from './pages/FeedDuties';
import { TurnoutRequests } from './pages/TurnoutRequests';
import TurnoutBoard from './pages/TurnoutBoard';
import StaffManagement from './pages/StaffManagement';
import MyTimesheet from './pages/MyTimesheet';
import MyRota from './pages/MyRota';
import Clinics from './pages/Clinics';
import Lessons from './pages/Lessons';
import { MyRegistrations } from './pages/MyRegistrations';
import { SecurityInfo } from './pages/SecurityInfo';
import { AdminUsers } from './pages/admin/Users';
import { AdminArenas } from './pages/admin/Arenas';
import { AdminBookings } from './pages/admin/Bookings';
import { AdminSettings } from './pages/admin/Settings';
import { AdminServices } from './pages/admin/Services';
import { AdminServiceRequests } from './pages/admin/ServiceRequests';
import { AdminLiveryPackages } from './pages/admin/LiveryPackages';
import { AdminStables } from './pages/admin/Stables';
import { AdminCompliance } from './pages/admin/Compliance';
import { AdminArenaUsageReport } from './pages/admin/ArenaUsageReport';
import AdminBilling from './pages/admin/Billing';
import AdminInvoices from './pages/admin/Invoices';
import AdminFields from './pages/admin/Fields';
import AdminCarePlans from './pages/admin/CarePlans';
import { AdminBackups } from './pages/admin/Backups';
import { AdminCoaches } from './pages/admin/Coaches';
import { AdminEventTriage } from './pages/admin/EventTriage';
import { AdminLessonTriage } from './pages/admin/LessonTriage';
import { AdminRuggingGuide } from './pages/admin/RuggingGuide';
import { AdminSecurity } from './pages/admin/Security';
import AdminHolidayLiveryRequests from './pages/admin/HolidayLiveryRequests';
import AdminRequests from './pages/admin/Requests';
import MyAccount from './pages/MyAccount';
import { NotFound } from './pages/NotFound';

// Redirect staff to their default page (My Tasks) instead of BookingCalendar
function DefaultBookingPage() {
  const { user } = useAuth();
  const isYardStaff = user?.is_yard_staff && user?.role !== 'admin';

  if (isYardStaff) {
    return <Navigate to="/book/tasks" replace />;
  }

  return <BookingCalendar />;
}

function App() {
  return (
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
        <Route path="my-horses/:horseId/health" element={<ProtectedRoute requireLivery><HorseHealthRecords /></ProtectedRoute>} />
        <Route path="my-horses/:horseId/feed" element={<ProtectedRoute requireLivery><HorseFeed /></ProtectedRoute>} />
        <Route path="my-horses/:horseId/emergency-contacts" element={<ProtectedRoute requireLivery><HorseEmergencyContacts /></ProtectedRoute>} />
        <Route path="my-invoices" element={<ProtectedRoute requireLivery><MyInvoices /></ProtectedRoute>} />
        <Route path="services" element={<ProtectedRoute requireLivery><ServiceRequests /></ProtectedRoute>} />
        <Route path="turnout" element={<ProtectedRoute requireLivery><TurnoutRequests /></ProtectedRoute>} />
        <Route path="my-account" element={<ProtectedRoute requireLivery><MyAccount /></ProtectedRoute>} />

        {/* Staff-only routes */}
        <Route path="my-rota" element={<ProtectedRoute requireStaff><MyRota /></ProtectedRoute>} />
        <Route path="my-timesheet" element={<ProtectedRoute requireStaff><MyTimesheet /></ProtectedRoute>} />

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
          {/* Livery Section */}
          <Route path="livery-packages" element={<ProtectedRoute requireAdmin><AdminLiveryPackages /></ProtectedRoute>} />
          <Route path="holiday-livery" element={<ProtectedRoute requireAdmin><AdminHolidayLiveryRequests /></ProtectedRoute>} />
          <Route path="feed-schedule" element={<ProtectedRoute requireAdmin><FeedDuties /></ProtectedRoute>} />
          <Route path="services" element={<ProtectedRoute requireAdmin><AdminServices /></ProtectedRoute>} />
          <Route path="service-requests" element={<ProtectedRoute requireAdmin><AdminServiceRequests /></ProtectedRoute>} />
          <Route path="billing" element={<ProtectedRoute requireAdmin><AdminBilling /></ProtectedRoute>} />
          <Route path="invoices" element={<ProtectedRoute requireAdmin><AdminInvoices /></ProtectedRoute>} />
          {/* Venue Section Continued */}
          <Route path="fields" element={<ProtectedRoute requireAdmin><AdminFields /></ProtectedRoute>} />
          {/* Care Plans Section */}
          <Route path="care-plans" element={<ProtectedRoute requireAdmin><AdminCarePlans /></ProtectedRoute>} />
          {/* Events & Coaching Section */}
          <Route path="events" element={<ProtectedRoute requireAdmin><AdminEventTriage /></ProtectedRoute>} />
          <Route path="lessons" element={<ProtectedRoute requireAdmin><AdminLessonTriage /></ProtectedRoute>} />
          <Route path="coaches" element={<ProtectedRoute requireAdmin><AdminCoaches /></ProtectedRoute>} />
          {/* System Section */}
          <Route path="compliance" element={<ProtectedRoute requireAdmin><AdminCompliance /></ProtectedRoute>} />
          <Route path="backups" element={<ProtectedRoute requireAdmin><AdminBackups /></ProtectedRoute>} />
          <Route path="rugging-guide" element={<ProtectedRoute requireAdmin><AdminRuggingGuide /></ProtectedRoute>} />
          <Route path="security" element={<ProtectedRoute requireAdmin><AdminSecurity /></ProtectedRoute>} />
          {/* Legacy route for task triage */}
          <Route path="task-triage" element={<Navigate to="/book/admin/tasks" replace />} />
        </Route>
      </Route>

      {/* 404 catch-all route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
