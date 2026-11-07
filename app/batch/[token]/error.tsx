"use client";
import styles from "../../../components/shared.module.css";

export default function BatchError({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <main className={styles.standaloneState}>
      <h1>We couldn’t load this batch.</h1>
      <p>Please try again in a moment.</p>
      <button className={styles.button} onClick={retry}>
        Try again
      </button>
    </main>
  );
}
