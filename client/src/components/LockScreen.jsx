import { useState } from "react";
import { motion } from "framer-motion";
import { KeyRound, Wifi } from "lucide-react";

export default function LockScreen({ loading, error, onUnlock }) {
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setLocalError("");

    try {
      await onUnlock(pin);
    } catch {
      setLocalError("That PIN did not unlock the drive.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <motion.form
        animate={{ opacity: 1, y: 0 }}
        className="glass w-full max-w-md rounded-[2rem] p-6"
        initial={{ opacity: 0, y: 18 }}
        onSubmit={handleSubmit}
      >
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img alt="PocketLAN" className="h-12 w-12 rounded-3xl border border-white/15 object-cover shadow-glow" src="/logo.png" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">PocketLAN</h1>
              <p className="text-sm text-slate-400">Your private Wi-Fi file explorer</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100">
            <Wifi className="h-3.5 w-3.5" />
            Local
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="skeleton h-12" />
            <div className="skeleton h-12" />
          </div>
        ) : (
          <>
            <label className="mb-2 block text-sm font-medium text-slate-300" htmlFor="pin">
              PIN or password
            </label>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  autoFocus
                  className="field w-full pl-11"
                  id="pin"
                  onChange={(event) => setPin(event.target.value)}
                  placeholder="Enter local PIN"
                  type="password"
                  value={pin}
                />
              </div>
              <button className="primary-button" disabled={submitting || !pin} type="submit">
                Unlock
              </button>
            </div>

            {(localError || error) && (
              <p className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                {localError || error}
              </p>
            )}
          </>
        )}
      </motion.form>
    </main>
  );
}
