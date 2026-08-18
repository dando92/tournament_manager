import { PropsWithChildren } from "react";
import BaseModal from "@/shared/components/ui/BaseModal";
import { btnPrimary } from "@/styles/buttonStyles";

type OkModalProps = {
  title: string;
  okText?: string;
  onClose: () => void;
  onOk: () => void;
  open: boolean;
};

export default function OkModal({
  title,
  okText = "OK",
  onClose,
  onOk,
  open,
  children,
}: PropsWithChildren<OkModalProps>) {
  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title={title || undefined}
      footer={
        <div className="flex flex-row-reverse">
          <button type="button" className={btnPrimary} onClick={onOk}>
            {okText}
          </button>
        </div>
      }
    >
      <div className="text-sm text-gray-500">{children}</div>
    </BaseModal>
  );
}
