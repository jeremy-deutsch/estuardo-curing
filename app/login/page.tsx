import ui from "../../components/shared.module.css";
import styles from "./login.module.css";
import { LoginForm } from "./login-form";
export default function Login() {
  return (
    <main className={styles.loginPage}>
      <section className={styles.loginStory}>
        <div className={styles.loginMessage}>
          <h1>Ballot curing</h1>
          <p>
            Manage voter lists, assign volunteer batches, and track curing
            status.
          </p>
          <div className={styles.loginArt} aria-hidden="true">
            <div className={styles.ballotPaper}>
              <span /> <span />
              <div>✓</div>
              <span />
              <span />
            </div>
            <div className={styles.ballotBox}>cure.</div>
            <span className={styles.artSpark}>✳</span>
          </div>
        </div>
      </section>
      <section className={styles.loginPanel}>
        <div className={styles.loginFormWrap}>
          <span className={`${ui.eyebrow} ${styles.eyebrow}`}>
            CAMPAIGN STAFF
          </span>
          <h2>Sign in</h2>
          <LoginForm />
          <div className={styles.loginHelp}>
            Need access? Ask your campaign administrator
            <br />
            to create your staff account.
          </div>
        </div>
        <p className={styles.loginPanelFooter}>
          Volunteering? Open the batch link shared with you.
        </p>
      </section>
    </main>
  );
}
