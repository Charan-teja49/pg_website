import { createBrowserRouter } from "react-router";
import PublicRoomView from "./pages/PublicRoomView";
import StudentLogin from "./pages/StudentLogin";
import AdminLogin from "./pages/AdminLogin";
import ForgotPasswordStudent from "./pages/ForgotPasswordStudent";
import ForgotPasswordAdmin from "./pages/ForgotPasswordAdmin";
import StudentLayout from "./layouts/StudentLayout";
import AdminLayout from "./layouts/AdminLayout";
import StudentDashboard from "./pages/student/Dashboard";
import StudentComplaints from "./pages/student/Complaints";
import StudentPayments from "./pages/student/PaymentsEnhanced";
import StudentRentDetails from "./pages/student/RentDetails";
import StudentRoomChange from "./pages/student/RoomChange";
import StudentFoodMenu from "./pages/student/FoodMenu";
import StudentTransactionHistory from "./pages/student/TransactionHistory";
import StudentVisitorRequests from "./pages/student/VisitorRequests";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminStudents from "./pages/admin/StudentsEnhanced";
import AdminRooms from "./pages/admin/RoomsEnhanced";
import AdminPayments from "./pages/admin/PaymentsEnhanced";
import AdminComplaints from "./pages/admin/Complaints";
import AdminAnnouncements from "./pages/admin/Announcements";
import AdminFoodMenu from "./pages/admin/FoodMenu";
import AdminRoomRequests from "./pages/admin/RoomRequests";
import AdminMaintenance from "./pages/admin/Maintenance";
import AdminAnalytics from "./pages/admin/Analytics";
import AdminSettings from "./pages/admin/Settings";
import AdminVisitors from "./pages/admin/Visitors";
import AdminStaff from "./pages/admin/Staff";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: PublicRoomView,
  },
  {
    path: "/student/login",
    Component: StudentLogin,
  },
  {
    path: "/student/forgot-password",
    Component: ForgotPasswordStudent,
  },
  {
    path: "/admin/login",
    Component: AdminLogin,
  },
  {
    path: "/admin/forgot-password",
    Component: ForgotPasswordAdmin,
  },
  {
    path: "/student",
    Component: StudentLayout,
    children: [
      { index: true, Component: StudentDashboard },
      { path: "complaints", Component: StudentComplaints },
      { path: "payments", Component: StudentPayments },
      { path: "transactions", Component: StudentTransactionHistory },
      { path: "rent-details", Component: StudentRentDetails },
      { path: "room-change", Component: StudentRoomChange },
      { path: "food-menu", Component: StudentFoodMenu },
      { path: "visitors", Component: StudentVisitorRequests },
    ],
  },
  {
    path: "/admin",
    Component: AdminLayout,
    children: [
      { index: true, Component: AdminDashboard },
      { path: "students", Component: AdminStudents },
      { path: "rooms", Component: AdminRooms },
      { path: "payments", Component: AdminPayments },
      { path: "complaints", Component: AdminComplaints },
      { path: "announcements", Component: AdminAnnouncements },
      { path: "food-menu", Component: AdminFoodMenu },
      { path: "room-requests", Component: AdminRoomRequests },
      { path: "maintenance", Component: AdminMaintenance },
      { path: "visitors", Component: AdminVisitors },
      { path: "analytics", Component: AdminAnalytics },
      { path: "settings", Component: AdminSettings },
      { path: "staff", Component: AdminStaff },
    ],
  },
]);
