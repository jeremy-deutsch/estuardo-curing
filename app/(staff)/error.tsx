"use client";
import styles from "../../components/shared.module.css";

export default function ErrorPage({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <div className={styles.emptyState}>
      <h2>We couldn’t load this page.</h2>
      <p>
        Please try again. If the problem persists, contact your administrator.
      </p>
      <button className={styles.button} onClick={retry}>
        Try again
      </button>
    </div>
  );
}
