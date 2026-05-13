import { BrowserRouter, Routes, Route } from "react-router-dom";

function Placeholder({ name }: { name: string }) {
  return <div className="p-8 text-lg">{name} — coming soon</div>;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Placeholder name="Dashboard" />} />
        <Route path="/import" element={<Placeholder name="Import" />} />
        <Route path="/review" element={<Placeholder name="Review" />} />
        <Route path="/forecast" element={<Placeholder name="Forecast" />} />
        <Route path="/login" element={<Placeholder name="Login" />} />
      </Routes>
    </BrowserRouter>
  );
}
