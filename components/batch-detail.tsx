"use client";
import ui from "./shared.module.css";
import styles from "./batch-detail.module.css";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Batch, PublicBatch } from "@/lib/types";
import { Icon } from "./icon";
import { PublicBatchView } from "./public-batch";
import { DeleteBatchButton } from "./delete-batch-button";
export function BatchDetail({
  batch,
  content,
}: {
  batch: Batch;
  content: PublicBatch;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  async function copy() {
    if (!batch) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/batch/${batch.public_token}`,
      );
      setCopied(true);
    } catch {
      setCopyError("Copy the address from the volunteer page.");
    }
  }
  return (
    <>
      <div className={styles.detailNav}>
        <Link className={ui.textButton} href="/batches">
          <Icon name="back" />
          All batches
        </Link>
        {batch && (
          <div className={`${ui.rowActions} ${styles.rowActions}`}>
            <DeleteBatchButton batch={batch} redirectToList />
            <button
              className={`${ui.button} ${styles.button} ${ui.small}`}
              disabled={!batch.active}
              onClick={() => void copy()}
            >
              <Icon name={copied ? "check" : "copy"} />
              {copied ? "Copied" : "Copy volunteer link"}
            </button>
            {batch.active && (
              <Link
                className={`${ui.button} ${styles.button} ${ui.small}`}
                href={`/batch/${batch.public_token}`}
                target="_blank"
                rel="noreferrer"
              >
                Volunteer view
                <Icon name="external" />
              </Link>
            )}
          </div>
        )}
      </div>
      {copyError && (
        <div className={`${ui.alert} ${ui.error}`} role="alert">
          {copyError}
          <button className={ui.textButton} onClick={() => router.refresh()}>
            Try again
          </button>
        </div>
      )}
      <PublicBatchView
        key={`${batch.id}-${batch.active}`}
        token={batch.public_token}
        batch={content}
        readOnly={!batch.active}
        embedded
      />
    </>
  );
}
