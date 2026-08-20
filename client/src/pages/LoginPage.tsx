import React, { useState } from "react";
import {
  Button,
  Input,
  Checkbox,
  Status,
  Divider,
  Metadata,
  Panel,
  Notice,
} from "../components/ui";

export const LoginPage: React.FC = () => {
  // Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  // UI / Validation State
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState(false);

  // Validate and submit login
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setAuthError(null);

    const newErrors: Record<string, string> = {};

    if (!email.trim()) {
      newErrors.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!password) {
      newErrors.password = "Password is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);

    // Simulate authentication
    setTimeout(() => {
      setIsLoading(false);
      // Example validation logic
      if (email.toLowerCase() === "error@institution.edu") {
        setAuthError(
          "Invalid credentials. Please check your email and password.",
        );
      } else {
        setAuthSuccess(true);
      }
    }, 900);
  };

  const handleDemoFill = () => {
    setEmail("faculty@institution.edu");
    setPassword("password123");
    setErrors({});
    setAuthError(null);
  };

  return (
    <div className="min-h-screen bg-[#F4F4F0] text-[#0A0A0A] font-sans selection:bg-black selection:text-[#F4F4F0] archival-grid relative flex flex-col justify-between">
      {/* =========================================================================
          TOP MASTHEAD & SYSTEM BAR
          ========================================================================= */}
      <header className="w-full border-b border-black bg-[#F4F4F0] relative z-20">
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-3 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
          {/* Product Identification & Academic Context */}
          <div className="flex items-center gap-3">
            <span className="font-bold tracking-wider text-black uppercase">
              PALE RECORDS
            </span>
            <span className="text-neutral-400">/</span>
            <span className="text-neutral-600 uppercase hidden sm:inline">
              CLASS RECORD MANAGEMENT SYSTEM
            </span>
          </div>

          {/* System Status Indicator */}
          <div className="flex items-center gap-4 ml-auto">
            <button
              type="button"
              onClick={handleDemoFill}
              className="text-[11px] font-mono text-neutral-500 hover:text-black underline cursor-pointer">
              [DEMO CREDENTIALS]
            </button>
            <span className="text-neutral-300">|</span>
            <Status variant="active" size="sm" label="SYSTEM ONLINE" />
          </div>
        </div>
      </header>

      {/* =========================================================================
          MAIN TWO-COLUMN EDITORIAL GRID
          ========================================================================= */}
      <main className="max-w-[1600px] mx-auto w-full px-4 md:px-8 py-8 md:py-14 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-start">
          {/* =====================================================================
              LEFT COLUMN: Product Identity, Class Record Concepts & System Context
              ===================================================================== */}
          <div className="lg:col-span-7 flex flex-col space-y-8">
            {/* Large Editorial Product Header */}
            <div className="border-b-2 border-black pb-8">
              <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-neutral-500 mb-3">
                <span className="w-2.5 h-2.5 bg-black inline-block" />
                <span>ACADEMIC RECORDS DIVISION</span>
              </div>

              {/* Oversized Brand Typography */}
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
                A centralized, structured platform for faculty and academic
                administrators to manage class rosters, student enrollments,
                daily attendance tracking, subject gradebooks, and official
                academic records.
              </p>
            </div>

            {/* Structured Class-Record Concept Modules */}
            <div className="space-y-4">
              <div className="font-mono text-xs font-bold uppercase tracking-wider text-black">
                CORE SYSTEM MODULES
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 01 / CLASSES */}
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

                {/* 02 / STUDENTS */}
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

                {/* 03 / ATTENDANCE */}
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

                {/* 04 / RECORDS */}
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
            </div>

            {/* Academic Session Metadata */}
            <Metadata.Group code="SYS" title="CURRENT ACADEMIC SESSION">
              <Metadata.Field label="ACADEMIC YEAR" value="2026–2027" />
              <Metadata.Field label="TERM" value="SEMESTER 1" />
              <Metadata.Field
                label="PORTAL ACCESS"
                value="ADMIN"
                highlight
              />
              <Metadata.Field
                label="SYSTEM STATUS"
                value="OPERATIONAL"
                status={<Status variant="active" size="sm" label="ACTIVE" />}
              />
            </Metadata.Group>
          </div>

          {/* =====================================================================
              RIGHT COLUMN: Account Access / Authentication Panel
              ===================================================================== */}
          <div className="lg:col-span-5 flex flex-col space-y-6">
            {/* Clean Structured Login Panel */}
            <Panel
              sectionNumber="01"
              header="ACCOUNT ACCESS"
              footer={
                <div className="flex items-center justify-between text-xs font-mono text-neutral-500">
                  <span>FACULTY & STAFF PORTAL</span>
                  <span>PALE RECORDS</span>
                </div>
              }
              className="bg-white">
              <div className="space-y-6">
                {/* Panel Introduction */}
                <div>
                  <h2 className="font-mono text-base font-bold uppercase tracking-wider text-black">
                    Sign in to continue
                  </h2>
                  <p className="text-xs text-neutral-600 mt-1">
                    Sign in to continue to PALE Records.
                  </p>
                </div>

                {/* Error Banner */}
                {authError && (
                  <Notice
                    variant="error"
                    code="ERR"
                    onDismiss={() => setAuthError(null)}>
                    {authError}
                  </Notice>
                )}

                {/* Success Banner */}
                {authSuccess ? (
                  <div className="py-6 space-y-5 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-black text-white font-mono text-xl font-bold border border-black">
                      ✓
                    </div>
                    <div>
                      <h3 className="font-mono text-lg font-bold uppercase tracking-wide text-black">
                        Sign In Successful
                      </h3>
                      <p className="font-mono text-xs text-neutral-600 mt-1">
                        Redirecting to class records overview...
                      </p>
                    </div>
                    <div className="bg-[#F4F4F0] border border-black p-3 text-left font-mono text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-neutral-500">ACCOUNT:</span>
                        <span className="font-bold">{email}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">SESSION:</span>
                        <span className="font-bold">ACTIVE</span>
                      </div>
                    </div>
                    <Button
                      variant="primary"
                      fullWidth
                      onClick={() =>
                        alert("Proceeding to PALE Records Dashboard...")
                      }>
                      CONTINUE TO DASHBOARD →
                    </Button>
                  </div>
                ) : (
                  /* Standard Login Form */
                  <form
                    onSubmit={handleSubmit}
                    className="space-y-5"
                    noValidate>
                    {/* Email Field */}
                    <div>
                      <Input
                        label="EMAIL ADDRESS"
                        required
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@institution.edu"
                        error={errors.email}
                        isMonospace
                        autoComplete="email"
                      />
                    </div>

                    {/* Password Field */}
                    <div>
                      <Input
                        label="PASSWORD"
                        required
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        error={errors.password}
                        isMonospace
                        allowPasswordToggle
                        autoComplete="current-password"
                      />
                    </div>

                    {/* Controls: Remember Me & Forgot Password */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <Checkbox
                        id="remember-me"
                        checked={rememberMe}
                        onChange={(checked) => setRememberMe(checked)}
                        label="Remember me"
                        size="sm"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          alert(
                            "Password reset instructions will be sent to your institutional email.",
                          )
                        }
                        className="text-xs font-mono text-neutral-600 hover:text-black underline cursor-pointer select-none">
                        Forgot password?
                      </button>
                    </div>

                    <Divider variant="hairline" spacing="sm" />

                    {/* Primary Sign In Button */}
                    <div>
                      <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        fullWidth
                        isLoading={isLoading}>
                        SIGN IN →
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </Panel>

            {/* Institutional Information Card */}
            <div className="bg-[#EAEAE4] border border-black p-4 font-mono text-xs text-neutral-700 space-y-2">
              <div className="flex items-center justify-between border-b border-neutral-400 pb-1.5 font-bold text-black">
                <span>FACULTY SUPPORT & ACCESS</span>
                <span>PALE RECORDS</span>
              </div>
              <p className="leading-relaxed">
                Authorized access only. If you require an account or experience
                issues signing in to PALE Records, please contact your academic
                registrar or departmental administrator.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* =========================================================================
          FOOTER
          ========================================================================= */}
      <footer className="w-full border-t border-black bg-[#F4F4F0] mt-12 py-4 px-4 md:px-8 text-xs font-mono">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-neutral-600">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-black">PALE RECORDS</span>
            <span>//</span>
            <span>CLASS RECORD MANAGEMENT SYSTEM</span>
          </div>

          <div className="flex items-center gap-4 text-neutral-500 text-[11px]">
            <span>ACADEMIC YEAR 2026–2027</span>
            <span>|</span>
            <span>© 2026 PALE RECORDS</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LoginPage;
