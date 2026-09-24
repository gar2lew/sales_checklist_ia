import { useState } from "react";
import LeftPanel from "./components/LeftPanel";
import RightPanel from "./components/RightPanel";

export default function App() {
  const [staff, setStaff] = useState<string>("");
  const [client1, setClient1] = useState<string>("");
  const [client2, setClient2] = useState<string>("");

  const canStart = staff.trim().length > 0 && client1.trim().length > 0;

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-3 sm:p-6 lg:p-8 bg-stone-200">
      <div
        className="relative w-full max-w-[1400px] rounded-3xl overflow-hidden bg-white"
        style={{
          border: "3px solid #b8924a",
          boxShadow:
            "0 30px 80px -20px rgba(10,31,61,0.45), 0 8px 24px -8px rgba(10,31,61,0.25), inset 0 0 0 1px rgba(184,146,74,0.25)",
        }}
      >
        <div className="flex flex-col lg:flex-row">
          <LeftPanel />
          <RightPanel
            staff={staff}
            setStaff={setStaff}
            client1={client1}
            setClient1={setClient1}
            client2={client2}
            setClient2={setClient2}
            canStart={canStart}
          />
        </div>
      </div>
    </div>
  );
}