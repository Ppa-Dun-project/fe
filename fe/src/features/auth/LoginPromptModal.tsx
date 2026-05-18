import { useState } from "react";
import Modal from "../../components/ui/Modal";
import { useGoogleSignIn } from "../../lib/googleAuth";

type Props = {
  open: boolean;
  onClose: () => void;
  onAuthSuccess?: () => void;
};

// Modal shown when an unauthenticated user attempts a protected action (e.g. Start Your Draft).
// On successful Google sign-in, the onAuthSuccess callback fires and then the modal closes.
export default function LoginPromptModal({ open, onClose, onAuthSuccess }: Props) {
  const [authError, setAuthError] = useState<string | null>(null);

  const buttonRef = useGoogleSignIn(
    () => {
      setAuthError(null);
      onAuthSuccess?.();
      onClose();
    },
    (msg) => setAuthError(msg),
  );

  return (
    <Modal open={open} title="Sign in to continue" onClose={onClose}>
      <div className="flex flex-col items-center gap-4">
        <p className="text-center text-sm text-white/70">
          Sign in with Google to start and save your draft.
        </p>
        <div ref={buttonRef} className="w-full max-w-xs" />
        {authError && (
          <div className="w-full max-w-xs rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
            {authError}
          </div>
        )}
      </div>
    </Modal>
  );
}
