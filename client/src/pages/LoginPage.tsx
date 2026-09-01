// Composes the PALE account-access page around the reusable login form.
import { useLocation } from "react-router-dom";
import { Notice } from "../components/ui/Notice";
import type { AuthenticatedUser } from "../features/auth/auth-api";
import { LoginForm } from "../features/auth/components/LoginForm";

interface LoginPageProps {
  onAuthenticated: (user: AuthenticatedUser) => void;
}

export function LoginPage({ onAuthenticated }: LoginPageProps) {
  const location = useLocation();
  const passwordChanged = Boolean(
    typeof location.state === "object" &&
    location.state !== null &&
    "passwordChanged" in location.state &&
    location.state.passwordChanged === true,
  );

  return (
    <div className="min-h-screen bg-[#F4F4F0] text-[#0A0A0A] font-sans selection:bg-black selection:text-[#F4F4F0] archival-grid relative flex flex-col justify-between">
      <header className="w-full border-b border-black bg-[#F4F4F0] relative z-20">
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-3 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center gap-3">
            <span className="font-bold tracking-wider text-black uppercase">
              PALE RECORDS
            </span>
            <span className="text-neutral-400">/</span>
            <span className="text-neutral-600 uppercase hidden sm:inline">
              CLASS RECORD MANAGEMENT SYSTEM
            </span>
          </div>

          <span className="font-semibold uppercase tracking-wider text-neutral-600">
            Account access
          </span>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto w-full px-4 md:px-8 py-8 md:py-14 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-start">
          <div className="lg:col-span-7 flex flex-col space-y-8">
            <div className="border-b-2 border-black pb-8">
              <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-neutral-500 mb-3">
                <span className="w-2.5 h-2.5 bg-black inline-block" />
                <span>CLASS RECORD WORKSPACE</span>
              </div>

              <h1 className="font-display text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter text-black uppercase leading-[0.9] mb-4">
                PALE
                <br />
                <span className="tracking-tight font-extrabold text-neutral-900">
                  RECORDS
                </span>
              </h1>

              <div className="font-mono text-xs md:text-sm font-semibold uppercase tracking-widest text-neutral-700 mt-2">
                CLASS RECORD MANAGEMENT SYSTEM
              </div>

              <p className="mt-4 text-sm md:text-base text-neutral-700 leading-relaxed max-w-2xl">
                A centralized, structured workspace for managing class rosters,
                student enrollments, daily attendance, and academic records.
              </p>
            </div>
            {/* core system modules */}
            <section className="space-y-4" aria-labelledby="system-modules">
              <h2
                id="system-modules"
                className="font-mono text-xs font-bold uppercase tracking-wider text-black">
                CORE SYSTEM MODULES
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="border border-black bg-white/70 p-4 space-y-1.5">
                  <div className="flex items-center justify-between border-b border-neutral-300 pb-1.5 font-mono text-xs">
                    <span className="font-bold text-black uppercase">
                      01 / CLASSES
                    </span>
                    <span className="text-neutral-500">SECTIONS</span>
                  </div>
                  <p className="text-xs text-neutral-600 font-sans leading-relaxed">
                    Class roster administration, section assignments, subject
                    allocations, and schedule management.
                  </p>
                </div>

                <div className="border border-black bg-white/70 p-4 space-y-1.5">
                  <div className="flex items-center justify-between border-b border-neutral-300 pb-1.5 font-mono text-xs">
                    <span className="font-bold text-black uppercase">
                      02 / STUDENTS
                    </span>
                    <span className="text-neutral-500">PROFILES</span>
                  </div>
                  <p className="text-xs text-neutral-600 font-sans leading-relaxed">
                    Student enrollment records, academic profiles, demographic
                    records, and historical performance.
                  </p>
                </div>

                <div className="border border-black bg-white/70 p-4 space-y-1.5">
                  <div className="flex items-center justify-between border-b border-neutral-300 pb-1.5 font-mono text-xs">
                    <span className="font-bold text-black uppercase">
                      03 / ATTENDANCE
                    </span>
                    <span className="text-neutral-500">TRACKING</span>
                  </div>
                  <p className="text-xs text-neutral-600 font-sans leading-relaxed">
                    Daily class attendance logging, excused absence tracking,
                    and attendance rate calculations.
                  </p>
                </div>

                <div className="border border-black bg-white/70 p-4 space-y-1.5">
                  <div className="flex items-center justify-between border-b border-neutral-300 pb-1.5 font-mono text-xs">
                    <span className="font-bold text-black uppercase">
                      04 / RECORDS
                    </span>
                    <span className="text-neutral-500">GRADEBOOKS</span>
                  </div>
                  <p className="text-xs text-neutral-600 font-sans leading-relaxed">
                    Subject grading sheets, evaluation criteria, assessment
                    weighting, and official grade reports.
                  </p>
                </div>
              </div>
            </section>

          </div>

          <div className="lg:col-span-5 flex flex-col space-y-6">
            {passwordChanged ? (
              <Notice variant="success" title="Password changed">
                Your password was changed. Sign in again to continue.
              </Notice>
            ) : null}
            <LoginForm onAuthenticated={onAuthenticated} />

            <div className="bg-[#EAEAE4] border border-black p-4 font-mono text-xs text-neutral-700 space-y-2">
              <div className="flex items-center justify-between border-b border-neutral-400 pb-1.5 font-bold text-black">
                <span>ACCOUNT SUPPORT</span>
                <span>PALE RECORDS</span>
              </div>
              <p className="leading-relaxed">
                Authorized access only. If you require an account or experience
                issues signing in to PALE Records, contact the person responsible
                for account access at your institution.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="w-full border-t border-black bg-[#F4F4F0] mt-12 py-4 px-4 md:px-8 text-xs font-mono">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-neutral-600">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-black">PALE RECORDS</span>
            <span>//</span>
            <span>CLASS RECORD MANAGEMENT SYSTEM</span>
          </div>

          <span className="text-[11px] text-neutral-500">© 2026 PALE RECORDS</span>
        </div>
      </footer>
    </div>
  );
}

export default LoginPage;
