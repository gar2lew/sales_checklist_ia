import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon, CheckIcon } from "./icons";

const STAFF = ["Blake", "Joe", "Natalie", "Mike", "Josh", "Sam"];

const NAVY = "#0a1f3d";
const GOLD = "#b8924a";

export default function StaffDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (open && listRef.current) {
      const el = listRef.current.querySelector<HTMLElement>(
        `[data-idx="${active}"]`
      );
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [active, open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
        setActive(value ? STAFF.indexOf(value) : 0);
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => (a + 1) % STAFF.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => (a - 1 + STAFF.length) % STAFF.length);
        break;
      case "Enter":
        e.preventDefault();
        if (active >= 0) {
          onChange(STAFF[active]);
          setOpen(false);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <label
        htmlFor="staff-trigger"
        className="block text-sm font-medium mb-2"
        style={{ color: NAVY }}
      >
        Staff Member
      </label>
      <button
        id="staff-trigger"
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="staff-listbox"
        onClick={() => {
          setOpen((o) => !o);
          setActive(value ? STAFF.indexOf(value) : 0);
        }}
        onKeyDown={onKeyDown}
        className="w-full flex items-center justify-between text-left transition-colors"
        style={{
          height: 55,
          borderRadius: 13,
          border: `1.5px solid ${open ? GOLD : "#d6cfc1"}`,
          background: "#fff",
          padding: "0 16px",
          boxShadow: open
            ? "0 0 0 3px rgba(184,146,74,0.15)"
            : "0 1px 2px rgba(10,31,61,0.05)",
          color: value ? NAVY : "#9a9384",
          fontSize: 15,
        }}
      >
        <span>{value ? value : "Select your name"}</span>
        <ChevronDownIcon
          size={18}
          style={{
            color: GOLD,
            transition: "transform 0.2s",
            transform: open ? "rotate(180deg)" : "none",
          }}
        />
      </button>

      {open && (
        <ul
          id="staff-listbox"
          ref={listRef}
          role="listbox"
          className="absolute z-30 left-0 right-0 mt-2 py-2 overflow-auto"
          style={{
            maxHeight: 260,
            background: "#fff",
            borderRadius: 13,
            border: "1px solid #ece6d8",
            boxShadow:
              "0 18px 40px -12px rgba(10,31,61,0.28), 0 4px 12px -4px rgba(10,31,61,0.12)",
          }}
        >
          {STAFF.map((name, i) => {
            const selected = name === value;
            const hovered = i === active;
            return (
              <li
                key={name}
                role="option"
                aria-selected={selected}
                data-idx={i}
                onMouseEnter={() => setActive(i)}
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                }}
                className="flex items-center justify-between cursor-pointer transition-colors"
                style={{
                  padding: "11px 16px",
                  color: NAVY,
                  fontSize: 15,
                  background: selected
                    ? "rgba(201,164,92,0.12)"
                    : hovered
                    ? "rgba(201,164,92,0.07)"
                    : "transparent",
                }}
              >
                <span>{name}</span>
                {selected && <CheckIcon size={16} style={{ color: GOLD }} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}