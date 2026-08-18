import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { KeyProvider } from "./context/KeyContext";
import Layout from "./components/Layout";
import AddRecordPage from "./pages/AddRecordPage";
import ViewRecordsPage from "./pages/ViewRecordsPage";

export default function App() {
  return (
    <KeyProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<AddRecordPage />} />
            <Route path="records" element={<ViewRecordsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </KeyProvider>
  );
}
