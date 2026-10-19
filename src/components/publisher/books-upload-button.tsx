"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { UploadWizard } from "@/components/publisher/upload-wizard";

export function BooksUploadButton({
  publisherName,
  label = "Upload book",
  size = "default",
}: {
  publisherName: string;
  label?: string;
  size?: "default" | "sm";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [wizardKey, setWizardKey] = useState(0);

  useEffect(() => {
    if (searchParams.get("upload") === "1") {
      setOpen(true);
    }
  }, [searchParams]);

  const openModal = () => {
    setWizardKey((k) => k + 1);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    if (searchParams.get("upload") === "1") {
      router.replace("/publisher/books");
    }
  };

  return (
    <>
      <Button
        type="button"
        size={size}
        onClick={openModal}
        data-testid="books-upload-open"
      >
        <Plus className="h-4 w-4" />
        {label}
      </Button>

      <Modal
        open={open}
        onClose={close}
        title="Upload book"
        subtitle="Guided wizard — file, metadata, cover, then publish"
        size="xl"
        className="h-[min(90vh,860px)]"
      >
        <div className="px-5 py-5">
          <UploadWizard
            key={wizardKey}
            publisherName={publisherName}
            onFinished={() => {
              close();
              router.refresh();
            }}
          />
        </div>
      </Modal>
    </>
  );
}
