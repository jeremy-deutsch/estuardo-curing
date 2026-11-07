import styles from "../../components/shared.module.css";
export default function Loading() {
  return (
    <div className={styles.emptyState} role="status">
      <span className={styles.spinner} />
      <p>Loading your workspace…</p>
    </div>
  );
}
