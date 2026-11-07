import styles from "../../../components/shared.module.css";
export default function BatchNotFound() {
  return (
    <main className={styles.standaloneState}>
      <h1>This batch link isn’t available.</h1>
      <p>Ask your campaign contact for an active batch link.</p>
    </main>
  );
}
