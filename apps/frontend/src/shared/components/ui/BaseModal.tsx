import { Dialog, Transition } from "@headlessui/react";
import { Fragment, PropsWithChildren, ReactNode } from "react";

type BaseModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  footer?: ReactNode;
  maxWidth?: string;
};

export default function BaseModal({
  open,
  onClose,
  title,
  footer,
  maxWidth = "max-w-2xl",
  children,
}: PropsWithChildren<BaseModalProps>) {
  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="fixed inset-0 z-[9999] overflow-y-auto" onClose={onClose}>
        <div className="min-h-screen px-4 text-center">
          <Dialog.Overlay className="fixed inset-0 backdrop-blur-lg bg-ui-text bg-opacity-60" />
          <span className="inline-block h-screen align-middle" aria-hidden="true">
            &#8203;
          </span>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <div
              className={`inline-block w-full ${maxWidth} p-6 my-8 text-left align-middle transition-all transform bg-ui-surface shadow-xl`}
            >
              {title && (
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title as="h3" className="text-lg font-semibold text-ui-text">
                    {title}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="text-ui-text-mute hover:text-ui-text-soft text-xl font-bold"
                  >
                    ✕
                  </button>
                </div>
              )}
              {children}
              {footer && <div className="mt-4">{footer}</div>}
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
