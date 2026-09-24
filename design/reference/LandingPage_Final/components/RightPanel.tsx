import { useState } from "react";
import StaffDropdown from "./StaffDropdown";
import {
  ShieldCheckIcon,
  UserIcon,
  ArrowRightIcon,
  LockSmallIcon,
} from "./icons";

const NAVY = "#0a1f3d";
const NAVY_SOFT = "#3a4a63";
const GOLD = "#b8924a";
const GOLD_DEEP = "#8a6a2f";
const IVORY = "#f5f0e6";

type Props = {
  staff: string;
  setStaff: (v: string) => void;
  client1: string;
  setClient1: (v: string) => void;
  client2: string;
  setClient2: (v: string) => void;
  canStart: boolean;
};

function NameInput({
  id,
  label,
  placeholder,
  value,
  onChange,
  optional,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  optional?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium mb-2"
        style={{ color: NAVY }}
      >
        {label}
        {optional && (
          <span className="ml-1 text-xs" style={{ color: "#9a9384" }}>
            (optional)
          </span>
        )}
      </label>
      <div
        className="flex items-center transition-all"
        style={{
          height: 55,
          borderRadius: 13,
          border: `1.5px solid ${focused ? GOLD : "#d6cfc1"}`,
          background: "#fff",
          boxShadow: focused
            ? "0 0 0 3px rgba(184,146,74,0.15)"
            : "0 1px 2px rgba(10,31,61,0.05)",
        }}
      >
        <span
          className="flex items-center justify-center shrink-0"
          style={{ width: 50, color: GOLD }}
        >
          <UserIcon size={19} />
        </span>
        <input
          id={id}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="flex-1 h-full bg-transparent outline-none min-w-0"
          style={{
            color: NAVY,
            fontSize: 15,
            paddingRight: 16,
            opacity: optional && !value ? 0.85 : 1,
          }}
        />
      </div>
    </div>
  );
}

export default function RightPanel({
  staff,
  setStaff,
  client1,
  setClient1,
  client2,
  setClient2,
  canStart,
}: Props) {
  return (
    <div
      className="relative w-full lg:w-[60%] flex flex-col"
      style={{
        background: `linear-gradient(180deg, ${IVORY} 0%, #efe9dc 100%)`,
        padding: "32px 28px 24px",
      }}
    >
      {/* Security badge */}
      <div className="flex justify-end mb-2">
        <div
          className="flex items-center gap-3"
          style={{
            background: "#fff",
            borderRadius: 14,
            padding: "12px 16px",
            border: "1px solid #ece6d8",
            boxShadow:
              "0 10px 30px -12px rgba(10,31,61,0.18), 0 2px 6px -2px rgba(10,31,61,0.08)",
            maxWidth: 320,
          }}
        >
          <span style={{ color: GOLD }}>
            <ShieldCheckIcon size={26} />
          </span>
          <div>
            <div
              className="font-semibold"
              style={{ color: GOLD_DEEP, fontSize: 13.5, letterSpacing: "0.01em" }}
            >
              Secure &amp; Professional
            </div>
            <div style={{ color: NAVY_SOFT, fontSize: 12, marginTop: 2 }}>
              Your information is encrypted and protected
            </div>
          </div>
        </div>
      </div>

      {/* Form card */}
      <div className="flex-1 flex flex-col items-center justify-center px-2 sm:px-6 py-6">
        <div className="w-full max-w-md mx-auto text-center">
          <span
            className="uppercase font-semibold"
            style={{ color: GOLD_DEEP, fontSize: 13, letterSpacing: "0.32em" }}
          >
            Welcome
          </span>
          <h2
            className="font-serif mt-3"
            style={{ color: NAVY, fontSize: 40, fontWeight: 600, lineHeight: 1.1 }}
          >
            Start New Appointment
          </h2>

          {/* divider with lock */}
          <div className="flex items-center justify-center gap-3 mt-5">
            <span
              className="block"
              style={{
                height: 1,
                width: 90,
                background: `linear-gradient(90deg, transparent, ${GOLD})`,
              }}
            />
            <span style={{ color: GOLD }}>
              <LockSmallIcon size={18} />
            </span>
            <span
              className="block"
              style={{
                height: 1,
                width: 90,
                background: `linear-gradient(90deg, ${GOLD}, transparent)`,
              }}
            />
          </div>

          <p
            className="mt-5 leading-relaxed"
            style={{ color: NAVY_SOFT, fontSize: 14.5 }}
          >
            Select your name to auto-fill staff details,
            <br />
            then enter client names to begin.
          </p>

          {/* Form fields */}
          <div className="mt-8 space-y-5 text-left">
            <StaffDropdown value={staff} onChange={setStaff} />
            <NameInput
              id="client1"
              label="Client 1 Name"
              placeholder="Enter client 1 name"
              value={client1}
              onChange={setClient1}
            />
            <NameInput
              id="client2"
              label="Client 2 Name"
              placeholder="Enter client 2 name"
              value={client2}
              onChange={setClient2}
              optional
            />
          </div>

          {/* Start button */}
          <button
            type="button"
            disabled={!canStart}
            className="w-full flex items-center justify-center gap-2 mt-7 transition-all active:translate-y-0.5"
            style={{
              height: 56,
              borderRadius: 13,
              cursor: canStart ? "pointer" : "not-allowed",
              background: canStart
                ? "linear-gradient(135deg, #8a6a2f 0%, #d4af6a 50%, #a8843d 100%)"
                : "#e7dfce",
              color: canStart ? NAVY : "#9a9384",
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: "0.02em",
              border: canStart
                ? "1px solid rgba(255,255,255,0.25)"
                : "1px solid #dcd3bf",
              boxShadow: canStart
                ? "0 14px 30px -10px rgba(138,106,47,0.55), 0 4px 10px -4px rgba(10,31,61,0.2), inset 0 1px 0 rgba(255,255,255,0.35)"
                : "none",
            }}
            onMouseEnter={(e) => {
              if (canStart)
                (e.currentTarget as HTMLElement).style.transform =
                  "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
            }}
          >
            <ArrowRightIcon size={20} />
            Start Appointment
          </button>

          {/* What happens next */}
          <div
            className="mt-7 text-left"
            style={{
              background: "rgba(255,255,255,0.6)",
              borderRadius: 14,
              border: "1px solid #ece6d8",
              padding: "16px 18px",
            }}
          >
            <div
              className="font-semibold mb-2"
              style={{ color: NAVY, fontSize: 14 }}
            >
              What happens next?
            </div>
            <ol className="space-y-1.5" style={{ color: NAVY_SOFT, fontSize: 13 }}>
              <li>1. Staff details are confirmed and time-stamped.</li>
              <li>2. Client records are created and linked to this session.</li>
              <li>3. Compliant documents are generated for review.</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        className="mt-4 pt-4 text-center"
        style={{ borderTop: "1px solid #e3dcc9", color: "#8a8470", fontSize: 12 }}
      >
        <div>Sales Appointment Capture v1.8.0</div>
        <div className="mt-1">
          © 2026 Amplify Solutions Group. All rights reserved.
        </div>
      </div>
    </div>
  );
}