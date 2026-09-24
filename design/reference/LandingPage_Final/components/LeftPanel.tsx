import { ShieldCheckIcon, DocumentIcon, PadlockIcon } from "./icons";

const NAVY = "#0a1f3d";
const NAVY_DEEP = "#06152b";
const GOLD = "#c9a45c";

function Benefit({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-3 px-1">
      <div
        className="flex items-center justify-center rounded-full"
        style={{
          width: 58,
          height: 58,
          border: `1.5px solid ${GOLD}`,
          color: GOLD,
          background: "rgba(201,164,92,0.06)",
        }}
      >
        {icon}
      </div>
      <div>
        <div className="font-serif text-base tracking-wide" style={{ color: GOLD }}>
          {title}
        </div>
        <div
          className="text-xs leading-relaxed mt-1"
          style={{ color: "rgba(255,255,255,0.72)" }}
        >
          {desc}
        </div>
      </div>
    </div>
  );
}

export default function LeftPanel() {
  return (
    <div
      className="relative w-full lg:w-[40%] overflow-hidden flex flex-col"
      style={{
        background: `radial-gradient(120% 80% at 20% 10%, ${NAVY} 0%, ${NAVY_DEEP} 70%, #04101f 100%)`,
        color: "#fff",
      }}
    >
      {/* flowing contour artwork */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        preserveAspectRatio="none"
        viewBox="0 0 400 600"
        fill="none"
        aria-hidden="true"
      >
        <g stroke="rgba(201,164,92,0.10)" strokeWidth="1">
          <path d="M-50 120 C 120 80, 280 160, 460 100" />
          <path d="M-50 170 C 120 130, 280 210, 460 150" />
          <path d="M-50 220 C 120 180, 280 260, 460 200" />
        </g>
        <g stroke="rgba(255,255,255,0.05)" strokeWidth="1">
          <path d="M-50 420 C 140 380, 260 470, 460 410" />
          <path d="M-50 470 C 140 430, 260 520, 460 460" />
          <path d="M-50 520 C 140 480, 260 570, 460 510" />
        </g>
      </svg>

      {/* curved right boundary with gold edge (desktop) */}
      <svg
        className="hidden lg:block absolute top-0 right-0 h-full pointer-events-none"
        style={{ width: 130, overflow: "visible" }}
        preserveAspectRatio="none"
        viewBox="0 0 130 1000"
        aria-hidden="true"
      >
        <path d="M0,0 C 70,220 70,780 0,1000 L 0,1000 L 0,0 Z" fill={NAVY_DEEP} />
        <path
          d="M0,0 C 70,220 70,780 0,1000"
          fill="none"
          stroke={GOLD}
          strokeWidth="2"
        />
      </svg>

      <div className="relative z-10 flex flex-col h-full px-8 py-10 sm:px-12 sm:py-14 lg:px-14 lg:py-16">
        {/* Logo lockup */}
        <div className="flex items-center gap-4">
          <div
            className="font-serif leading-none"
            style={{ color: GOLD, fontSize: 52, letterSpacing: "0.02em" }}
          >
            ASG
          </div>
          <div
            style={{
              width: 1,
              height: 46,
              background: `linear-gradient(${GOLD}, transparent)`,
            }}
          />
          <div className="flex flex-col gap-1">
            {["AMPLIFY", "SOLUTIONS", "GROUP"].map((w) => (
              <span
                key={w}
                className="text-white uppercase"
                style={{ fontSize: 12.5, letterSpacing: "0.28em", fontWeight: 500 }}
              >
                {w}
              </span>
            ))}
          </div>
        </div>

        {/* gold divider */}
        <div
          className="mt-8 h-px w-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${GOLD} 30%, ${GOLD} 70%, transparent)`,
          }}
        />

        {/* Heading */}
        <div className="mt-12 lg:mt-16 text-center lg:text-left">
          <h1
            className="font-serif text-white leading-tight"
            style={{ fontSize: 40, fontWeight: 500 }}
          >
            Sales Appointment
            <br />
            Capture
          </h1>
          <p className="font-serif italic mt-4" style={{ color: GOLD, fontSize: 19 }}>
            Professional. Compliant. Complete.
          </p>
          <p
            className="mt-6 max-w-md mx-auto lg:mx-0 leading-relaxed"
            style={{ color: "rgba(255,255,255,0.78)", fontSize: 15 }}
          >
            Capture every detail, generate compliant documents, and deliver
            premium client experiences.
          </p>
        </div>

        {/* Benefits */}
        <div className="mt-auto pt-12 lg:pt-16">
          <div className="grid grid-cols-3 gap-3 sm:gap-5">
            <Benefit
              icon={<ShieldCheckIcon size={26} />}
              title="Compliant"
              desc="Built for Australian standards"
            />
            <Benefit
              icon={<DocumentIcon size={26} />}
              title="Complete"
              desc="All documents in one place"
            />
            <Benefit
              icon={<PadlockIcon size={26} />}
              title="Secure"
              desc="Your data is always protected"
            />
          </div>
        </div>
      </div>
    </div>
  );
}