import LockScreen from "./components/LockScreen";
import { useAuth } from "./hooks/useAuth";
import DrivePage from "./pages/DrivePage";

export default function App() {
  const auth = useAuth();

  if (!auth.unlocked) {
    return <LockScreen error={auth.error} loading={auth.loading} onUnlock={auth.unlock} />;
  }

  return <DrivePage onLock={auth.lock} />;
}

