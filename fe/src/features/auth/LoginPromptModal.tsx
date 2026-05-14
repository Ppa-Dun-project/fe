import { useState } from "react";
import Modal from "../../components/ui/Modal";
import { useGoogleSignIn } from "../../lib/googleAuth";

type Props = {
  open: boolean;
  onClose: () => void;
  onAuthSuccess?: () => void;
};

// 비로그인 유저가 보호된 액션(예: Start Your Draft)을 시도했을 때 띄우는 모달.
// 구글 로그인 성공 시 onAuthSuccess 콜백 실행 후 모달을 닫는다.
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
